"""Main bot orchestrator.

Trading sources (in priority order):
  1. Copy trading from WalletTracker (real Polymarket whale wallets)
  2. Strategy signals (momentum, contrarian) on live market data
  3. Pulse fallback (fires if idle > IDLE_FORCE_SECS to keep activity flowing)

No test mode. No fake trades. Every trade is real signal-driven or a
deliberate pulse on a real market.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Callable, Awaitable

from app.clients.polymarket import PolymarketClient
from app.config import BotMode, StrategyName, get_settings
from app.engine.demo import DemoEngine
from app.engine.portfolio import Portfolio
from app.engine.risk import RiskEngine
from app.leaderboard.tracker import LeaderboardTracker
from app.leaderboard.copy_engine import CopyTradingEngine
from app.leaderboard.wallet_tracker import WalletTracker
from app.strategies import (
    AdaptiveStrategy, ContrarianStrategy, MarketMakerStrategy,
    MomentumStrategy, SignalStrategy,
)
from app.strategies.base import Signal, SignalType
from app.strategies.edge_scorer import EdgeScorer

logger = logging.getLogger("polymaus.bot")
settings = get_settings()

BroadcastFn = Callable[[dict], Awaitable[None]]

# If no trade happens within this many seconds, fire a pulse trade
IDLE_FORCE_SECS = 30.0


class BotOrchestrator:

    MAX_RESTARTS = 50
    RESTART_BACKOFF = [2, 4, 8, 16, 32]

    def __init__(self) -> None:
        self.client = PolymarketClient()
        self.portfolio = Portfolio(
            starting_balance=settings.demo_starting_balance,
            is_demo=settings.bot_mode == BotMode.DEMO,
        )
        self.risk = RiskEngine(self.portfolio)
        self.demo_engine = DemoEngine(self.portfolio, self.risk)

        # Real wallet tracker (primary copy trading source)
        self.wallet_tracker = WalletTracker(self.client)

        # Legacy tracker (hot_tokens for AdaptiveStrategy)
        self.leaderboard = LeaderboardTracker(self.client)
        self.copy_engine = CopyTradingEngine(self.leaderboard)

        self.edge_scorer = EdgeScorer()

        self.strategies: dict[str, Any] = {
            StrategyName.CONTRARIAN:   ContrarianStrategy(),
            StrategyName.MARKET_MAKER: MarketMakerStrategy(),
            StrategyName.SIGNAL:       SignalStrategy(),
            StrategyName.ADAPTIVE:     AdaptiveStrategy(),
            StrategyName.MOMENTUM:     MomentumStrategy(),
        }
        self.active_strategy: str = settings.default_strategy.value

        self._running = False
        self._markets: list[dict] = []
        self._prices: dict[str, float] = {}
        self._last_signals: list[dict] = []
        self._last_edge_markets: list[dict] = []
        self._broadcast: BroadcastFn | None = None
        self._restart_count = 0
        self._last_trade_ts: float = time.time()

    def set_broadcast(self, fn: BroadcastFn) -> None:
        self._broadcast = fn

    def set_strategy(self, name: str) -> bool:
        if name in self.strategies:
            self.active_strategy = name
            logger.info("Strategy switched to %s", name)
            return True
        return False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._restart_count = 0
        logger.info(
            "Bot starting. mode=%s strategy=%s poll=%ds",
            settings.bot_mode, self.active_strategy, settings.price_poll_secs
        )
        await self._run_with_supervision()

    async def stop(self) -> None:
        self._running = False
        await self.client.close()
        logger.info("Bot stopped.")

    # ── Supervision ───────────────────────────────────────────────────────

    async def _run_with_supervision(self) -> None:
        while self._running:
            try:
                await self._main_loop()
            except Exception as exc:
                if not self._running:
                    break
                self._restart_count += 1
                if self._restart_count > self.MAX_RESTARTS:
                    logger.critical("Max restarts exceeded. Stopping.")
                    self._running = False
                    break
                backoff = self.RESTART_BACKOFF[
                    min(self._restart_count - 1, len(self.RESTART_BACKOFF) - 1)
                ]
                logger.warning(
                    "Bot crashed (restart %d/%d) backoff=%ds: %s",
                    self._restart_count, self.MAX_RESTARTS, backoff, exc,
                    exc_info=True
                )
                await asyncio.sleep(backoff)

    async def _main_loop(self) -> None:
        market_refresh_countdown = 0
        lb_refresh_countdown = 0
        wallet_refresh_countdown = 0
        first_boot = True

        while self._running:
            try:
                # ── Market refresh ────────────────────────────────────────
                if market_refresh_countdown <= 0:
                    await self._refresh_markets()
                    market_refresh_countdown = settings.market_refresh_secs

                    if first_boot and self._markets:
                        first_boot = False
                        logger.info(
                            "[BOOT] Markets loaded (%d). Firing boot pulse trade.",
                            len(self._markets)
                        )
                        await self._pulse_trade()

                # ── Leaderboard / wallet refresh ──────────────────────────
                if lb_refresh_countdown <= 0:
                    asyncio.create_task(self._refresh_leaderboard())
                    lb_refresh_countdown = self.leaderboard.REFRESH_SECS

                if wallet_refresh_countdown <= 0:
                    asyncio.create_task(self._refresh_wallets())
                    wallet_refresh_countdown = 60  # check wallet activity every 60s

                # ── Price refresh ─────────────────────────────────────────
                await self._refresh_prices()
                await self.portfolio.update_prices(self._prices)

                # ── Exit checks ───────────────────────────────────────────
                await self._check_exits()

                # ── Copy trading (wallet tracker) ─────────────────────────
                await self._run_copy_trading()

                # ── Strategy cycle ────────────────────────────────────────
                await self._run_strategy_cycle()

                # ── Idle enforcer ─────────────────────────────────────────
                await self._enforce_activity()

                # ── Edge scoring ──────────────────────────────────────────
                self._last_edge_markets = self.edge_scorer.get_top_edges(
                    self._markets, self._prices, min_score=0.08, top_n=10
                )

                # ── Broadcast ─────────────────────────────────────────────
                await self._broadcast_state()

                market_refresh_countdown -= settings.price_poll_secs
                lb_refresh_countdown     -= settings.price_poll_secs
                wallet_refresh_countdown -= settings.price_poll_secs
                await asyncio.sleep(settings.price_poll_secs)

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("Loop error: %s", exc, exc_info=True)
                await asyncio.sleep(5)

    # ── Data refresh ──────────────────────────────────────────────────────

    async def _refresh_markets(self) -> None:
        try:
            self._markets = await self.client.get_markets(
                active=True, limit=150, min_volume=50.0
            )
            tokenized = sum(1 for m in self._markets if m.get("yes_token_id"))
            logger.info(
                "Markets refreshed: %d loaded, %d with token IDs",
                len(self._markets), tokenized
            )
        except Exception as exc:
            logger.warning("Market refresh failed: %s", exc)

    async def _refresh_prices(self) -> None:
        if not self._markets:
            return
        try:
            seeded = 0
            for m in self._markets:
                yes_id = m.get("yes_token_id") or ""
                no_id  = m.get("no_token_id") or ""
                if yes_id and m.get("yes_price") is not None and yes_id not in self._prices:
                    self._prices[yes_id] = float(m["yes_price"])
                    seeded += 1
                if no_id and m.get("no_price") is not None and no_id not in self._prices:
                    self._prices[no_id] = float(m["no_price"])
                    seeded += 1
            if seeded:
                logger.info("Prices seeded from Gamma: +%d (total %d)", seeded, len(self._prices))

            # Live CLOB for top 30
            token_ids = [
                tid
                for m in self._markets[:30]
                for key in ("yes_token_id", "no_token_id")
                if (tid := m.get(key))
            ]
            if token_ids:
                sem = asyncio.Semaphore(5)
                async def fetch_price(tid: str) -> tuple[str, float]:
                    async with sem:
                        try:
                            return tid, await self.client.get_price(tid, "buy")
                        except Exception:
                            return tid, self._prices.get(tid, 0.5)
                results = await asyncio.gather(*[fetch_price(t) for t in token_ids])
                self._prices.update(dict(results))
                live = sum(1 for _, p in results if p != 0.5)
                logger.debug("CLOB prices: %d tokens, %d live updates", len(token_ids), live)
        except Exception as exc:
            logger.warning("Price refresh failed: %s", exc)

    # ── Exit management ───────────────────────────────────────────────────

    async def _check_exits(self) -> None:
        for token_id in list(self.portfolio.positions.keys()):
            price = self._prices.get(token_id, 0.5)
            should_exit, reason = self.risk.check_exit(token_id, price)
            if should_exit:
                trade = await self.demo_engine.execute_sell(token_id, price)
                if trade:
                    logger.info(
                        "EXIT %s @ %.3f: %s pnl=%.2f",
                        token_id[:8], price, reason, trade.get("pnl", 0)
                    )
                    self._last_trade_ts = time.time()
                    await self._emit("trade", {**trade, "exitReason": reason})
                    await self._broadcast_portfolio()

    # ── Copy trading ──────────────────────────────────────────────────────

    async def _run_copy_trading(self) -> None:
        """
        Primary: use WalletTracker (real wallet monitoring).
        Secondary: legacy LeaderboardTracker → CopyTradingEngine.
        """
        if not self._markets:
            return

        # Primary: wallet tracker
        try:
            copy_signals = await self.wallet_tracker.detect_new_entries(
                self._markets, self._prices
            )
            if copy_signals:
                logger.info(
                    "[COPY] WalletTracker: %d new signal(s) from %d tracked wallets",
                    len(copy_signals), self.wallet_tracker.wallet_count
                )
            else:
                logger.debug(
                    "[COPY] WalletTracker: 0 new signals (%d wallets tracked)",
                    self.wallet_tracker.wallet_count
                )

            executed = 0
            for sig in copy_signals:
                if executed >= 3:
                    break
                token_id = sig["token_id"]
                if token_id in self.portfolio.positions:
                    continue
                trade = await self.demo_engine.execute_buy(
                    token_id=token_id,
                    market_id=sig["market_id"],
                    question=sig["question"],
                    outcome=sig["outcome"],
                    market_price=sig["price"],
                    strategy="copy_trader",
                )
                if trade:
                    executed += 1
                    self._last_trade_ts = time.time()
                    trade["traderAddress"] = sig["trader_address"]
                    logger.info(
                        "✓ COPY EXECUTED: %s '%s' @ %.3f size=$%.2f | from %s rank#%d",
                        sig["outcome"], sig["question"][:38], sig["price"],
                        trade.get("size", 0), sig["trader_address"][:10], sig["trader_rank"]
                    )
                    await self._emit("trade", trade)
                    await self._broadcast_portfolio()
                else:
                    logger.warning(
                        "✗ COPY REJECTED: %s @ %.3f | %s",
                        sig["outcome"], sig["price"], sig["reason"][:40]
                    )
        except Exception as exc:
            logger.warning("WalletTracker copy cycle error: %s", exc, exc_info=True)

        # Broadcast updated copy history and trader list
        await self._emit("copy_trades", self.wallet_tracker.get_copy_history(30))
        await self._emit("traders", self.wallet_tracker.get_snapshot())

    # ── Strategy cycle ────────────────────────────────────────────────────

    async def _run_strategy_cycle(self) -> None:
        if not self._markets:
            logger.warning("Strategy skipped: no markets loaded")
            return

        strategy = self.strategies.get(self.active_strategy)
        if not strategy:
            return

        snap = self.portfolio.snapshot()
        priced = sum(
            1 for m in self._markets
            if self._prices.get(m.get("yes_token_id") or "x") is not None
        )
        logger.info(
            "Strategy '%s': markets=%d priced=%d balance=$%.2f idle=%.0fs",
            self.active_strategy, len(self._markets), priced,
            snap.balance, time.time() - self._last_trade_ts
        )

        if self.active_strategy == StrategyName.ADAPTIVE:
            strategy.update_hot_tokens(self.wallet_tracker.hot_tokens or self.leaderboard.hot_tokens)

        try:
            signals = await strategy.analyze(self._markets, self._prices)
        except Exception as exc:
            logger.error("Strategy error: %s", exc, exc_info=True)
            return

        logger.info("'%s' → %d signal(s)", self.active_strategy, len(signals))
        for sig in signals[:5]:
            logger.info(
                "  SIG %s %s @ %.3f conf=%.2f | %s",
                sig.signal, sig.question[:35], sig.price, sig.confidence, sig.reason[:40]
            )

        self._last_signals = [s.to_dict() for s in signals[:20]]

        executed = 0
        for sig in signals:
            if executed >= 5:
                break
            if sig.signal not in (SignalType.BUY_YES, SignalType.BUY_NO):
                continue
            if sig.token_id in self.portfolio.positions:
                continue
            trade = await self.demo_engine.execute_buy(
                token_id=sig.token_id,
                market_id=sig.market_id,
                question=sig.question,
                outcome=sig.outcome,
                market_price=sig.price,
                strategy=self.active_strategy,
            )
            if trade:
                executed += 1
                self._last_trade_ts = time.time()
                logger.info(
                    "✓ TRADE: %s '%s' @ %.3f size=$%.2f strat=%s",
                    sig.outcome, sig.question[:38], sig.price,
                    trade.get("size", 0), self.active_strategy
                )
                await self._emit("trade", trade)
                await self._broadcast_portfolio()
            else:
                logger.warning(
                    "✗ REJECTED: %s '%s' @ %.3f (max_entry=%.2f bal=$%.2f)",
                    sig.outcome, sig.question[:35], sig.price,
                    settings.max_entry_price, snap.balance
                )

        if executed:
            logger.info("Strategy cycle: %d trade(s) executed", executed)

    # ── Activity enforcer ─────────────────────────────────────────────────

    async def _enforce_activity(self) -> None:
        idle = time.time() - self._last_trade_ts
        if idle < IDLE_FORCE_SECS:
            return
        logger.info("[ENFORCER] Idle %.0fs ≥ %.0fs — firing pulse", idle, IDLE_FORCE_SECS)
        await self._pulse_trade()

    # ── Pulse trade ───────────────────────────────────────────────────────

    async def _pulse_trade(self) -> None:
        """
        Force-execute one trade immediately.

        Tries top-20 markets by volume. For each market, picks YES or NO
        based on current price (buy the less-crowded side). Executes the
        first that the risk engine approves.
        """
        if not self._markets:
            logger.warning("[PULSE] No markets — cannot trade")
            return

        candidates = [
            m for m in self._markets
            if m.get("yes_token_id") and m.get("no_token_id")
        ]
        if not candidates:
            logger.warning("[PULSE] No markets with token IDs")
            return

        candidates.sort(key=lambda m: float(m.get("volume24hr") or 0), reverse=True)
        logger.info(
            "[PULSE] %d candidates | top: '%s' vol=$%.0f",
            len(candidates),
            (candidates[0].get("question") or "")[:40],
            float(candidates[0].get("volume24hr") or 0)
        )

        for m in candidates[:20]:
            yes_id = m.get("yes_token_id", "")
            no_id  = m.get("no_token_id", "")
            yes_p  = self._prices.get(yes_id, float(m.get("yes_price") or 0.5))

            if yes_id in self.portfolio.positions or no_id in self.portfolio.positions:
                continue

            if yes_p >= 0.60:
                token_id, outcome, price = no_id, "NO", max(0.05, 1.0 - yes_p)
            else:
                token_id, outcome, price = yes_id, "YES", max(0.05, yes_p)

            price = min(price, settings.max_entry_price)

            trade = await self.demo_engine.execute_buy(
                token_id=token_id,
                market_id=m.get("conditionId") or m.get("id", ""),
                question=(m.get("question") or "PULSE")[:60],
                outcome=outcome,
                market_price=price,
                strategy="pulse",
            )
            if trade:
                self._last_trade_ts = time.time()
                logger.info(
                    "[PULSE] ✓ %s '%s' @ %.3f size=$%.2f",
                    outcome, (m.get("question") or "")[:40], price, trade.get("size", 0)
                )
                await self._emit("trade", trade)
                await self._broadcast_portfolio()
                return

        logger.warning(
            "[PULSE] All %d candidates rejected. balance=$%.2f",
            min(len(candidates), 20), self.portfolio.snapshot().balance
        )

    # ── Leaderboard / wallet refresh ──────────────────────────────────────

    async def _refresh_leaderboard(self) -> None:
        try:
            await self.leaderboard.refresh()
            logger.info(
                "Legacy leaderboard: %d traders, %d hot tokens",
                len(self.leaderboard._leaders), len(self.leaderboard.hot_tokens)
            )
        except Exception as exc:
            logger.warning("Legacy leaderboard refresh failed: %s", exc)

    async def _refresh_wallets(self) -> None:
        try:
            await self.wallet_tracker.refresh(self._markets)
            logger.info(
                "WalletTracker: %d wallets tracked",
                self.wallet_tracker.wallet_count
            )
            await self._emit("traders", self.wallet_tracker.get_snapshot())
        except Exception as exc:
            logger.warning("WalletTracker refresh failed: %s", exc, exc_info=True)

    # ── Broadcast helpers ─────────────────────────────────────────────────

    async def _broadcast_portfolio(self) -> None:
        snap = self.portfolio.snapshot()
        await self._emit("portfolio", snap.to_dict())
        await self._emit("positions", self.portfolio.get_positions())

    async def _broadcast_state(self) -> None:
        if not self._broadcast:
            return
        snap = self.portfolio.snapshot()
        await self._emit("portfolio", snap.to_dict())
        await self._emit("positions", self.portfolio.get_positions())
        await self._emit("signals", self._last_signals)
        await self._emit("markets", [
            {
                "conditionId": m.get("conditionId") or m.get("id", ""),
                "question":  (m.get("question") or "")[:80],
                "yesPrice":  self._prices.get(m.get("yes_token_id") or "", m.get("yes_price", 0.5)),
                "noPrice":   self._prices.get(m.get("no_token_id")  or "", m.get("no_price",  0.5)),
                "volume24h": float(m.get("volume24hr") or 0),
                "liquidity": float(m.get("liquidity") or 0),
            }
            for m in self._markets[:20]
        ])
        await self._emit("traders",      self.wallet_tracker.get_snapshot())
        await self._emit("copy_trades",  self.wallet_tracker.get_copy_history(30))
        await self._emit("edge_markets", self._last_edge_markets)

    async def _emit(self, event: str, data: Any) -> None:
        if self._broadcast:
            try:
                await self._broadcast({"event": event, "data": data})
            except Exception:
                pass

    # ── Public accessors ──────────────────────────────────────────────────

    def is_running(self) -> bool:
        return self._running

    def get_status(self) -> dict:
        snap = self.portfolio.snapshot()
        idle = int(time.time() - self._last_trade_ts)
        return {
            "running":      self._running,
            "mode":         settings.bot_mode.value,
            "strategy":     self.active_strategy,
            "strategies":   list(self.strategies.keys()),
            "portfolio":    snap.to_dict(),
            "positions":    self.portfolio.get_positions(),
            "recentTrades": self.portfolio.get_recent_trades(50),
            "signals":      self._last_signals,
            "markets": [
                {
                    "conditionId": m.get("conditionId") or m.get("id", ""),
                    "question":  (m.get("question") or "")[:80],
                    "yesPrice":  self._prices.get(m.get("yes_token_id") or "", m.get("yes_price", 0.5)),
                    "noPrice":   self._prices.get(m.get("no_token_id")  or "", m.get("no_price",  0.5)),
                    "volume24h": float(m.get("volume24hr") or 0),
                    "liquidity": float(m.get("liquidity") or 0),
                }
                for m in self._markets[:20]
            ],
            "traders":     self.wallet_tracker.get_snapshot(),
            "copyTrades":  self.wallet_tracker.get_copy_history(30),
            "edgeMarkets": self._last_edge_markets,
            "leaderboard": self.wallet_tracker.get_snapshot(),
            "hotTokens":   len(self.wallet_tracker.hot_tokens),
            "walletsTracked": self.wallet_tracker.wallet_count,
            "restarts":    self._restart_count,
            "idleSecs":    idle,
            "updatedAt":   datetime.utcnow().isoformat() + "Z",
        }
