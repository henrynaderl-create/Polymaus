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
            # Batch collect token IDs
            token_ids = []
            for m in self._markets[:50]:  # limit to top 50
                for key in ("yes_token_id", "no_token_id"):
                    tid = m.get(key) or ""
                    if tid:
                        token_ids.append(tid)

            # Fetch prices concurrently (max 10 at a time)
            sem = asyncio.Semaphore(10)

            async def fetch_price(tid: str) -> tuple[str, float]:
                async with sem:
                    try:
                        p = await self.client.get_price(tid, "buy")
                        return tid, p
                    except Exception:
                        return tid, self._prices.get(tid, 0.5)

            results = await asyncio.gather(*[fetch_price(tid) for tid in token_ids])
            self._prices.update(dict(results))
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

    async def _run_strategy_cycle(self) -> None:
        if not self._markets:
            return

        strategy = self.strategies.get(self.active_strategy)
        if not strategy:
            return

        # Update adaptive strategy with leaderboard data
        if self.active_strategy == StrategyName.ADAPTIVE:
            strategy.update_hot_tokens(self.leaderboard.hot_tokens)

        try:
            signals = await strategy.analyze(self._markets, self._prices)
        except Exception as exc:
            logger.error("Strategy error: %s", exc)
            return

        self._last_signals = [s.to_dict() for s in signals[:20]]

        # Execute top signals
        executed = 0
        for sig in signals:
            if executed >= 3:  # max 3 new trades per cycle
                break
            if sig.signal in (SignalType.BUY_YES, SignalType.BUY_NO):
                if sig.token_id in self.portfolio.positions:
                    continue  # Already in this position
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
                        "New position: %s %s @ %.3f conf=%.2f",
                        sig.outcome, sig.question[:40], sig.price, sig.confidence,
                    )
                    await self._emit("trade", trade)

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
                "yesPrice": self._prices.get(m.get("yes_token_id") or "", 0.5),
                "noPrice": self._prices.get(m.get("no_token_id") or "", 0.5),
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
                    "yesPrice": self._prices.get(m.get("yes_token_id") or "", 0.5),
                    "noPrice": self._prices.get(m.get("no_token_id") or "", 0.5),
                    "volume24h": float(m.get("volume24hr") or 0),
                }
                for m in self._markets[:20]
            ],
            "leaderboard": self.leaderboard.get_leaders_snapshot(),
            "hotTokens": len(self.leaderboard.hot_tokens),
            "restarts": self._restart_count,
            "updatedAt": datetime.utcnow().isoformat(),
        }
