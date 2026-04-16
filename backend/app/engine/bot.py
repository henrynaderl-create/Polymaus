"""Main bot orchestrator.

Runs all strategies on a schedule, executes trades (demo or live),
persists state, and broadcasts via WebSocket.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any, Callable, Awaitable

from app.clients.polymarket import PolymarketClient
from app.config import BotMode, StrategyName, get_settings
from app.engine.demo import DemoEngine
from app.engine.portfolio import Portfolio
from app.engine.risk import RiskEngine
from app.leaderboard.tracker import LeaderboardTracker
from app.strategies import (
    AdaptiveStrategy, ContrarianStrategy, MarketMakerStrategy, SignalStrategy
)
from app.strategies.base import Signal, SignalType

logger = logging.getLogger("polymaus.bot")
settings = get_settings()

# Type for WebSocket broadcast callback
BroadcastFn = Callable[[dict], Awaitable[None]]


class BotOrchestrator:
    """Central trading loop. One instance per process."""

    MAX_RESTARTS = 50
    RESTART_BACKOFF = [2, 4, 8, 16, 32]  # seconds

    def __init__(self) -> None:
        self.client = PolymarketClient()
        self.portfolio = Portfolio(
            starting_balance=settings.demo_starting_balance,
            is_demo=settings.bot_mode == BotMode.DEMO,
        )
        self.risk = RiskEngine(self.portfolio)
        self.demo_engine = DemoEngine(self.portfolio, self.risk)
        self.leaderboard = LeaderboardTracker(self.client)

        # Strategy registry
        self.strategies: dict[str, Any] = {
            StrategyName.CONTRARIAN: ContrarianStrategy(),
            StrategyName.MARKET_MAKER: MarketMakerStrategy(),
            StrategyName.SIGNAL: SignalStrategy(),
            StrategyName.ADAPTIVE: AdaptiveStrategy(),
        }
        self.active_strategy: str = settings.default_strategy.value

        # State
        self._running = False
        self._markets: list[dict] = []
        self._prices: dict[str, float] = {}
        self._last_signals: list[dict] = []
        self._broadcast: BroadcastFn | None = None
        self._restart_count = 0
        self._test_trade_countdown: int = settings.test_trade_interval_cycles

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

    # ── Internal ──────────────────────────────────────────────────────────

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
                    "Bot crashed (restart %d/%d), restarting in %ds: %s",
                    self._restart_count, self.MAX_RESTARTS, backoff, exc,
                )
                await asyncio.sleep(backoff)

    async def _main_loop(self) -> None:
        """Core trading loop."""
        market_refresh_countdown = 0
        lb_refresh_countdown = 0

        while self._running:
            try:
                # Market refresh
                if market_refresh_countdown <= 0:
                    await self._refresh_markets()
                    market_refresh_countdown = settings.market_refresh_secs

                # Leaderboard refresh
                if lb_refresh_countdown <= 0:
                    asyncio.create_task(self._refresh_leaderboard())
                    lb_refresh_countdown = self.leaderboard.REFRESH_SECS

                # Price update
                await self._refresh_prices()
                await self.portfolio.update_prices(self._prices)

                # Check exit conditions on open positions
                await self._check_exits()

                # Generate and execute signals
                await self._run_strategy_cycle()

                # Broadcast state
                await self._broadcast_state()

                market_refresh_countdown -= settings.price_poll_secs
                lb_refresh_countdown -= settings.price_poll_secs

                await asyncio.sleep(settings.price_poll_secs)

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("Loop error: %s", exc, exc_info=True)
                await asyncio.sleep(5)

    async def _refresh_markets(self) -> None:
        try:
            self._markets = await self.client.get_markets(
                active=True, limit=100, min_volume=500.0
            )
            logger.info("Markets refreshed: %d active", len(self._markets))
        except Exception as exc:
            logger.warning("Market refresh failed: %s", exc)

    async def _refresh_prices(self) -> None:
        if not self._markets:
            return
        try:
            # ── Step 1: Seed prices from Gamma API outcomePrices (instant, no CLOB) ──
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

            logger.info(
                "Prices seeded from Gamma API: %d tokens | total tracked: %d",
                seeded, len(self._prices),
            )

            # ── Step 2: Refresh top-20 via CLOB for real-time accuracy (best-effort) ──
            token_ids: list[str] = []
            for m in self._markets[:20]:
                yes_id = m.get("yes_token_id") or ""
                no_id  = m.get("no_token_id") or ""
                if yes_id:
                    token_ids.append(yes_id)
                if no_id:
                    token_ids.append(no_id)

            if token_ids:
                sem = asyncio.Semaphore(5)

                async def fetch_price(tid: str) -> tuple[str, float]:
                    async with sem:
                        try:
                            p = await self.client.get_price(tid, "buy")
                            return tid, p
                        except Exception:
                            return tid, self._prices.get(tid, 0.5)

                results = await asyncio.gather(*[fetch_price(tid) for tid in token_ids])
                clob_updates = {tid: p for tid, p in results}
                self._prices.update(clob_updates)
                logger.debug("CLOB price update: %d tokens refreshed", len(clob_updates))

        except Exception as exc:
            logger.warning("Price refresh failed: %s", exc)

    async def _check_exits(self) -> None:
        for token_id in list(self.portfolio.positions.keys()):
            price = self._prices.get(token_id, 0.5)
            should_exit, reason = self.risk.check_exit(token_id, price)
            if should_exit:
                trade = await self.demo_engine.execute_sell(token_id, price)
                if trade:
                    logger.info("Exit %s @ %.3f: %s pnl=%.2f", token_id[:8], price, reason, trade.get("pnl", 0))
                    await self._emit("trade", {**trade, "exitReason": reason})

    async def _execute_test_trade(self) -> None:
        """TEST MODE: force a random demo trade to validate the full pipeline."""
        import random
        if not self._markets:
            return
        candidates = [
            m for m in self._markets[:30]
            if m.get("yes_token_id") and m.get("no_token_id")
        ]
        if not candidates:
            logger.warning("[TEST MODE] No candidates with token IDs — normalization may have failed")
            return

        m = random.choice(candidates)
        is_yes = random.random() > 0.5
        token_id = m["yes_token_id"] if is_yes else m["no_token_id"]
        price = self._prices.get(token_id)
        if price is None:
            raw = m.get("yes_price" if is_yes else "no_price", 0.5)
            price = float(raw) if raw is not None else 0.5
        # Clamp to tradeable range
        price = max(0.05, min(price, 0.60))

        question = (m.get("question") or "TEST TRADE")[:60]
        logger.info("[TEST MODE] Injecting trade: %s '%s' @ %.3f",
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
            logger.info("[TEST MODE] Trade EXECUTED: size=$%.2f token=%s",
                        trade.get("size_usd", 0), token_id[:12])
            await self._emit("trade", trade)
        else:
            logger.warning("[TEST MODE] Trade REJECTED by risk engine (price=%.3f)", price)

    async def _run_strategy_cycle(self) -> None:
        if not self._markets:
            logger.debug("Strategy cycle skipped: no markets loaded yet")
            return

        strategy = self.strategies.get(self.active_strategy)
        if not strategy:
            return

        # ── TEST MODE: inject a forced trade every N cycles ───────────────
        if settings.test_mode:
            self._test_trade_countdown -= 1
            logger.debug("[TEST MODE] countdown=%d", self._test_trade_countdown)
            if self._test_trade_countdown <= 0:
                self._test_trade_countdown = settings.test_trade_interval_cycles
                await self._execute_test_trade()

        # ── Log current price coverage ─────────────────────────────────────
        priced = sum(
            1 for m in self._markets
            if self._prices.get(m.get("yes_token_id") or "x", None) is not None
        )
        logger.info(
            "Strategy cycle: strategy=%s markets=%d priced=%d/%d prices_total=%d",
            self.active_strategy, len(self._markets), priced, len(self._markets),
            len(self._prices),
        )

        # Update adaptive strategy with leaderboard data
        if self.active_strategy == StrategyName.ADAPTIVE:
            strategy.update_hot_tokens(self.leaderboard.hot_tokens)

        try:
            signals = await strategy.analyze(self._markets, self._prices)
        except Exception as exc:
            logger.error("Strategy error: %s", exc)
            return

        logger.info("Strategy '%s' generated %d signals", self.active_strategy, len(signals))
        for sig in signals[:5]:
            logger.info(
                "  SIGNAL %s | %s @ %.3f conf=%.2f | %s",
                sig.signal, sig.question[:45], sig.price, sig.confidence, sig.reason,
            )

        self._last_signals = [s.to_dict() for s in signals[:20]]

        # Execute top signals
        executed = 0
        for sig in signals:
            if executed >= 3:  # max 3 new trades per cycle
                break
            if sig.signal in (SignalType.BUY_YES, SignalType.BUY_NO):
                if sig.token_id in self.portfolio.positions:
                    logger.debug("Skip: already in position %s", sig.token_id[:12])
                    continue
                logger.info(
                    "Attempting trade: %s '%s' @ %.3f conf=%.2f",
                    sig.outcome, sig.question[:45], sig.price, sig.confidence,
                )
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
                    logger.info(
                        "TRADE EXECUTED: %s '%s' @ %.3f size=$%.2f",
                        sig.outcome, sig.question[:45], sig.price,
                        trade.get("size_usd", 0),
                    )
                    await self._emit("trade", trade)
                else:
                    logger.warning(
                        "Trade REJECTED: %s '%s' @ %.3f (price range [0.02, %.2f], balance=$%.2f)",
                        sig.outcome, sig.question[:40], sig.price,
                        settings.max_entry_price,
                        self.portfolio.snapshot().balance,
                    )

    async def _refresh_leaderboard(self) -> None:
        try:
            await self.leaderboard.refresh()
            logger.info("Leaderboard refreshed: %d hot tokens", len(self.leaderboard.hot_tokens))
        except Exception as exc:
            logger.warning("Leaderboard refresh failed: %s", exc)

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
                    m.get("yes_token_id") or "",
                    m.get("yes_price", 0.5)
                ),
                "noPrice": self._prices.get(
                    m.get("no_token_id") or "",
                    m.get("no_price", 0.5)
                ),
                "volume24h": float(m.get("volume24hr") or 0),
                "liquidity": float(m.get("liquidity") or 0),
            }
            for m in self._markets[:20]
        ])

    async def _emit(self, event: str, data: Any) -> None:
        if self._broadcast:
            try:
                await self._broadcast({"event": event, "data": data})
            except Exception:
                pass

    # ── Public state accessors ────────────────────────────────────────────

    def is_running(self) -> bool:
        return self._running

    def get_status(self) -> dict:
        snap = self.portfolio.snapshot()
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
                        m.get("yes_token_id") or "",
                        m.get("yes_price", 0.5)
                    ),
                    "noPrice": self._prices.get(
                        m.get("no_token_id") or "",
                        m.get("no_price", 0.5)
                    ),
                    "volume24h": float(m.get("volume24hr") or 0),
                }
                for m in self._markets[:20]
            ],
            "leaderboard": self.leaderboard.get_leaders_snapshot(),
            "hotTokens": len(self.leaderboard.hot_tokens),
            "restarts": self._restart_count,
            "updatedAt": datetime.utcnow().isoformat(),
        }
