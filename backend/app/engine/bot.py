"""Main bot orchestrator.

Runs all strategies on a schedule, executes trades (demo or live),
persists state, and broadcasts via WebSocket.
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
from app.strategies import (
    AdaptiveStrategy, ContrarianStrategy, MarketMakerStrategy, SignalStrategy
)
from app.strategies.base import Signal, SignalType
from app.strategies.edge_scorer import EdgeScorer

logger = logging.getLogger("polymaus.bot")
settings = get_settings()

BroadcastFn = Callable[[dict], Awaitable[None]]


class BotOrchestrator:
    """Central trading loop. One instance per process."""

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
        self.leaderboard = LeaderboardTracker(self.client)
        self.copy_engine = CopyTradingEngine(self.leaderboard)
        self.edge_scorer = EdgeScorer()

        self.strategies: dict[str, Any] = {
            StrategyName.CONTRARIAN:   ContrarianStrategy(),
            StrategyName.MARKET_MAKER: MarketMakerStrategy(),
            StrategyName.SIGNAL:       SignalStrategy(),
            StrategyName.ADAPTIVE:     AdaptiveStrategy(),
        }
        self.active_strategy: str = settings.default_strategy.value

        self._running = False
        self._markets: list[dict] = []
        self._prices: dict[str, float] = {}
        self._last_signals: list[dict] = []
        self._last_edge_markets: list[dict] = []
        self._broadcast: BroadcastFn | None = None
        self._restart_count = 0
        self._test_trade_countdown: int = settings.test_trade_interval_cycles
        # Activity enforcer: seconds since last trade
        self._last_trade_ts: float = time.time()
        self._activity_enforce_secs: float = 300.0  # force trade if idle 5 min

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
        logger.info("Bot starting. mode=%s strategy=%s", settings.bot_mode, self.active_strategy)
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
                logger.warning("Bot crashed (restart %d/%d), back-off %ds: %s",
                               self._restart_count, self.MAX_RESTARTS, backoff, exc)
                await asyncio.sleep(backoff)

    async def _main_loop(self) -> None:
        market_refresh_countdown = 0
        lb_refresh_countdown = 0

        while self._running:
            try:
                if market_refresh_countdown <= 0:
                    await self._refresh_markets()
                    market_refresh_countdown = settings.market_refresh_secs

                if lb_refresh_countdown <= 0:
                    asyncio.create_task(self._refresh_leaderboard())
                    lb_refresh_countdown = self.leaderboard.REFRESH_SECS

                await self._refresh_prices()
                await self.portfolio.update_prices(self._prices)
                await self._check_exits()

                # ── Main intelligence loop ────────────────────────────────
                await self._run_copy_trading()
                await self._run_strategy_cycle()
                await self._run_activity_enforcer()

                # ── Score markets for edge display ────────────────────────
                self._last_edge_markets = self.edge_scorer.get_top_edges(
                    self._markets, self._prices, min_score=0.10, top_n=10
                )
                if self._last_edge_markets:
                    logger.info(
                        "Edge markets: top=%s score=%.3f",
                        (self._last_edge_markets[0].get("question") or "")[:40],
                        self._last_edge_markets[0].get("edgeScore", 0),
                    )

                await self._broadcast_state()

                market_refresh_countdown -= settings.price_poll_secs
                lb_refresh_countdown -= settings.price_poll_secs
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
                active=True, limit=100, min_volume=200.0
            )
            logger.info("Markets refreshed: %d active", len(self._markets))
        except Exception as exc:
            logger.warning("Market refresh failed: %s", exc)

    async def _refresh_prices(self) -> None:
        if not self._markets:
            return
        try:
            # Step 1: seed from Gamma API outcomePrices (instant)
            seeded = 0
            for m in self._markets:
                yes_id = m.get("yes_token_id") or ""
                no_id  = m.get("no_token_id") or ""
                yes_p  = m.get("yes_price")
                no_p   = m.get("no_price")
                if yes_id and yes_p is not None and yes_id not in self._prices:
                    self._prices[yes_id] = float(yes_p)
                    seeded += 1
                if no_id and no_p is not None and no_id not in self._prices:
                    self._prices[no_id] = float(no_p)
                    seeded += 1
            logger.info("Prices seeded from Gamma: %d new | total: %d", seeded, len(self._prices))

            # Step 2: live CLOB update for top 20 (best-effort)
            token_ids: list[str] = []
            for m in self._markets[:20]:
                for key in ("yes_token_id", "no_token_id"):
                    tid = m.get(key) or ""
                    if tid:
                        token_ids.append(tid)

            if token_ids:
                sem = asyncio.Semaphore(5)

                async def fetch_price(tid: str) -> tuple[str, float]:
                    async with sem:
                        try:
                            return tid, await self.client.get_price(tid, "buy")
                        except Exception:
                            return tid, self._prices.get(tid, 0.5)

                results = await asyncio.gather(*[fetch_price(tid) for tid in token_ids])
                self._prices.update(dict(results))
                logger.debug("CLOB prices updated: %d tokens", len(token_ids))

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
                    logger.info("EXIT %s @ %.3f: %s pnl=%.2f",
                                token_id[:8], price, reason, trade.get("pnl", 0))
                    self._last_trade_ts = time.time()
                    await self._emit("trade", {**trade, "exitReason": reason})

    # ── Copy trading ──────────────────────────────────────────────────────

    async def _run_copy_trading(self) -> None:
        """Detect new positions from top traders and replicate them."""
        if not self._markets or not self.leaderboard._leaders:
            return
        try:
            copy_signals = await self.copy_engine.detect_new_entries(
                self._markets, self._prices
            )
            logger.info("Copy engine: %d new signals from top traders", len(copy_signals))

            # Broadcast updated copy history to UI
            await self._emit("copy_trades", self.copy_engine.get_copy_history(30))
            # Broadcast updated trader profiles
            await self._emit("traders", self.leaderboard.get_leaders_snapshot())

            executed = 0
            for sig in copy_signals:
                if executed >= 2:
                    break
                if sig.token_id in self.portfolio.positions:
                    continue
                logger.info("COPY TRADE attempt: %s '%s' @ %.3f conf=%.2f | %s",
                            sig.outcome, sig.question[:40], sig.price,
                            sig.confidence, sig.reason)
                trade = await self.demo_engine.execute_buy(
                    token_id=sig.token_id,
                    market_id=sig.market_id,
                    question=sig.question,
                    outcome=sig.outcome,
                    market_price=sig.price,
                    strategy="copy_trader",
                )
                if trade:
                    executed += 1
                    self._last_trade_ts = time.time()
                    logger.info("COPY TRADE executed: %s @ %.3f size=$%.2f",
                                sig.outcome, sig.price, trade.get("size_usd", 0))
                    await self._emit("trade", trade)
                else:
                    logger.warning("COPY TRADE rejected by risk: %s @ %.3f",
                                   sig.outcome, sig.price)
        except Exception as exc:
            logger.warning("Copy trading cycle error: %s", exc)

    # ── Strategy cycle ────────────────────────────────────────────────────

    async def _run_strategy_cycle(self) -> None:
        if not self._markets:
            logger.debug("Strategy skipped: no markets")
            return

        strategy = self.strategies.get(self.active_strategy)
        if not strategy:
            return

        # TEST MODE forced trade
        if settings.test_mode:
            self._test_trade_countdown -= 1
            if self._test_trade_countdown <= 0:
                self._test_trade_countdown = settings.test_trade_interval_cycles
                await self._execute_test_trade()

        priced = sum(1 for m in self._markets
                     if self._prices.get(m.get("yes_token_id") or "x") is not None)
        logger.info("Strategy cycle: %s | markets=%d priced=%d | prices=%d",
                    self.active_strategy, len(self._markets), priced, len(self._prices))

        if self.active_strategy == StrategyName.ADAPTIVE:
            strategy.update_hot_tokens(self.leaderboard.hot_tokens)

        try:
            signals = await strategy.analyze(self._markets, self._prices)
        except Exception as exc:
            logger.error("Strategy error: %s", exc)
            return

        logger.info("'%s' → %d signals", self.active_strategy, len(signals))
        for sig in signals[:5]:
            logger.info("  SIG %s | %s @ %.3f conf=%.2f | %s",
                        sig.signal, sig.question[:40], sig.price, sig.confidence, sig.reason)

        self._last_signals = [s.to_dict() for s in signals[:20]]

        executed = 0
        for sig in signals:
            if executed >= 3:
                break
            if sig.signal not in (SignalType.BUY_YES, SignalType.BUY_NO):
                continue
            if sig.token_id in self.portfolio.positions:
                continue
            logger.info("Trade attempt: %s '%s' @ %.3f conf=%.2f",
                        sig.outcome, sig.question[:40], sig.price, sig.confidence)
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
                logger.info("TRADE EXECUTED: %s '%s' @ %.3f size=$%.2f",
                            sig.outcome, sig.question[:40], sig.price,
                            trade.get("size_usd", 0))
                await self._emit("trade", trade)
            else:
                logger.warning("REJECTED: %s '%s' @ %.3f (max_price=%.2f bal=$%.2f)",
                               sig.outcome, sig.question[:35], sig.price,
                               settings.max_entry_price,
                               self.portfolio.snapshot().balance)

    # ── Activity enforcer ─────────────────────────────────────────────────

    async def _run_activity_enforcer(self) -> None:
        """If bot has been idle for too long, force a trade to keep pipeline active."""
        idle_secs = time.time() - self._last_trade_ts
        if idle_secs < self._activity_enforce_secs:
            return
        logger.info("[ENFORCER] Idle for %.0fs — forcing activity trade", idle_secs)
        # First try: pick best edge market
        if self._last_edge_markets:
            top = self._last_edge_markets[0]
            cid = top.get("conditionId", "")
            market = next((m for m in self._markets
                           if (m.get("conditionId") or m.get("id")) == cid), None)
            if market:
                yes_id = market.get("yes_token_id") or ""
                no_id  = market.get("no_token_id") or ""
                # Buy NO on the most overpriced YES (contrarian edge)
                yes_price = top.get("yesPrice", 0.5)
                if no_id and yes_price > 0.50:
                    price = max(0.05, min(1 - yes_price, 0.60))
                    trade = await self.demo_engine.execute_buy(
                        token_id=no_id,
                        market_id=cid,
                        question=top.get("question", ""),
                        outcome="NO",
                        market_price=price,
                        strategy="edge_enforcer",
                    )
                    if trade:
                        self._last_trade_ts = time.time()
                        logger.info("[ENFORCER] Edge trade: NO '%s' @ %.3f edge=%.3f",
                                    top.get("question", "")[:40], price,
                                    top.get("edgeScore", 0))
                        await self._emit("trade", trade)
                        return

        # Fallback: random test trade
        await self._execute_test_trade()

    # ── Test trade ────────────────────────────────────────────────────────

    async def _execute_test_trade(self) -> None:
        import random
        if not self._markets:
            return
        candidates = [m for m in self._markets[:30]
                      if m.get("yes_token_id") and m.get("no_token_id")]
        if not candidates:
            logger.warning("[TEST] No candidates with token IDs")
            return

        m = random.choice(candidates)
        is_yes = random.random() > 0.5
        token_id = m["yes_token_id"] if is_yes else m["no_token_id"]
        price = self._prices.get(token_id)
        if price is None:
            raw = m.get("yes_price" if is_yes else "no_price", 0.5)
            price = float(raw) if raw is not None else 0.5
        price = max(0.05, min(price, 0.60))

        question = (m.get("question") or "TEST")[:60]
        logger.info("[TEST] Forcing: %s '%s' @ %.3f",
                    "YES" if is_yes else "NO", question, price)
        trade = await self.demo_engine.execute_buy(
            token_id=token_id,
            market_id=m.get("conditionId") or m.get("id", ""),
            question=question,
            outcome="YES" if is_yes else "NO",
            market_price=price,
            strategy="test_mode",
        )
        if trade:
            self._last_trade_ts = time.time()
            logger.info("[TEST] Executed: size=$%.2f", trade.get("size_usd", 0))
            await self._emit("trade", trade)
        else:
            logger.warning("[TEST] Rejected by risk (price=%.3f)", price)

    # ── Leaderboard ───────────────────────────────────────────────────────

    async def _refresh_leaderboard(self) -> None:
        try:
            await self.leaderboard.refresh()
            followed = len(self.leaderboard.get_ranked_traders(min_trust=0.40))
            logger.info("Leaderboard: %d traders, %d followed, %d hot tokens",
                        len(self.leaderboard._leaders),
                        followed,
                        len(self.leaderboard.hot_tokens))
        except Exception as exc:
            logger.warning("Leaderboard refresh failed: %s", exc)

    # ── Broadcast ─────────────────────────────────────────────────────────

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
                "question": (m.get("question") or "")[:80],
                "yesPrice": self._prices.get(
                    m.get("yes_token_id") or "", m.get("yes_price", 0.5)),
                "noPrice": self._prices.get(
                    m.get("no_token_id") or "", m.get("no_price", 0.5)),
                "volume24h": float(m.get("volume24hr") or 0),
                "liquidity": float(m.get("liquidity") or 0),
            }
            for m in self._markets[:20]
        ])
        await self._emit("traders", self.leaderboard.get_leaders_snapshot())
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
        idle_secs = int(time.time() - self._last_trade_ts)
        return {
            "running": self._running,
            "mode": settings.bot_mode.value,
            "strategy": self.active_strategy,
            "strategies": list(self.strategies.keys()),
            "portfolio": snap.to_dict(),
            "positions": self.portfolio.get_positions(),
            "recentTrades": self.portfolio.get_recent_trades(20),
            "signals": self._last_signals,
            "markets": [
                {
                    "conditionId": m.get("conditionId") or m.get("id", ""),
                    "question": (m.get("question") or "")[:80],
                    "yesPrice": self._prices.get(
                        m.get("yes_token_id") or "", m.get("yes_price", 0.5)),
                    "noPrice": self._prices.get(
                        m.get("no_token_id") or "", m.get("no_price", 0.5)),
                    "volume24h": float(m.get("volume24hr") or 0),
                }
                for m in self._markets[:20]
            ],
            "traders": self.leaderboard.get_leaders_snapshot(),
            "copyTrades": self.copy_engine.get_copy_history(30),
            "edgeMarkets": self._last_edge_markets,
            "leaderboard": self.leaderboard.get_leaders_snapshot(),
            "hotTokens": len(self.leaderboard.hot_tokens),
            "restarts": self._restart_count,
            "idleSecs": idle_secs,
            "updatedAt": datetime.utcnow().isoformat(),
        }
