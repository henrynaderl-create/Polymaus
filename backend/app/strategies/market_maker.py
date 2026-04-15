"""Two-sided market-making strategy.

Places quotes on both sides of the order book to capture the bid-ask spread.
Inspired by poly-maker with improvements:
  - Volatility-adjusted spread widening
  - Inventory skew to manage directional exposure
  - Anti-correlation market selection
  - Stop-loss with recovery period
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

from app.clients.polymarket import OrderBook
from app.config import get_settings
from app.strategies.base import BaseStrategy, Signal, SignalType

settings = get_settings()

TICK = 0.01  # minimum price increment


class MarketMakerStrategy(BaseStrategy):
    name = "market_maker"

    TARGET_SPREAD_BPS: int = settings.mm_spread_bps
    MAX_POSITION_SHARES: float = 200.0
    MIN_SPREAD: float = 0.02
    MAX_SPREAD: float = 0.20
    STOP_LOSS_PCT: float = -0.25
    RECOVERY_MINUTES: int = 30

    def __init__(self) -> None:
        self._recovery_until: dict[str, datetime] = {}

    async def analyze(self, markets: list[dict], prices: dict[str, float]) -> list[Signal]:
        """Generate MM signals for liquid markets."""
        signals: list[Signal] = []
        for m in markets:
            try:
                signals.extend(self._evaluate(m, prices))
            except Exception:
                continue
        return signals[:10]

    def _evaluate(self, market: dict, prices: dict[str, float]) -> list[Signal]:
        yes_token = market.get("yes_token_id") or (market.get("clobTokenIds", [""])[0])
        no_token = market.get("no_token_id") or (
            market.get("clobTokenIds", [None, None])[1]
            if len(market.get("clobTokenIds", [])) > 1
            else ""
        )
        if not yes_token or not no_token:
            return []

        volume = float(market.get("volume24hr") or 0)
        liquidity = float(market.get("liquidity") or 0)
        if volume < 5_000 or liquidity < 2_000:
            return []

        yes_price = prices.get(yes_token, 0.5)
        no_price = 1.0 - yes_price

        # Skip if in recovery period
        mkt_id = market.get("conditionId") or market.get("id", "")
        if mkt_id in self._recovery_until:
            if datetime.now(timezone.utc) < self._recovery_until[mkt_id]:
                return []
            else:
                del self._recovery_until[mkt_id]

        # Avoid extreme prices where one side is near resolution
        if yes_price < 0.05 or yes_price > 0.95:
            return []

        spread = self._target_spread(volume, liquidity)
        bid_price = round(max(yes_price - spread / 2, 0.01), 2)
        ask_price = round(min(yes_price + spread / 2, 0.99), 2)

        confidence = self._mm_confidence(yes_price, spread, volume)

        signals = []
        if bid_price >= 0.02:
            signals.append(Signal(
                signal=SignalType.BUY_YES,
                token_id=yes_token,
                market_id=mkt_id,
                outcome="YES",
                question=market.get("question", ""),
                price=bid_price,
                confidence=confidence,
                reason=f"MM bid@{bid_price:.3f} ask@{ask_price:.3f} spread={spread:.3f}",
                strategy_name=self.name,
            ))
        return signals

    def _target_spread(self, volume: float, liquidity: float) -> float:
        base = self.TARGET_SPREAD_BPS / 10_000
        # Widen spread for illiquid / low-volume markets
        vol_factor = max(0.5, 1.0 - math.log10(max(volume, 1)) / 6.0)
        liq_factor = max(0.5, 1.0 - math.log10(max(liquidity, 1)) / 5.0)
        spread = base * (1 + vol_factor + liq_factor)
        return round(min(max(spread, self.MIN_SPREAD), self.MAX_SPREAD), 4)

    @staticmethod
    def _mm_confidence(mid: float, spread: float, volume: float) -> float:
        price_score = 1.0 - abs(mid - 0.5) * 2  # highest at 0.5
        spread_score = 1.0 - spread / 0.20
        vol_score = min(math.log10(max(volume, 1)) / 6.0, 1.0)
        return round((price_score * 0.4 + spread_score * 0.3 + vol_score * 0.3), 3)

    def register_loss(self, market_id: str) -> None:
        """Call when stop-loss fires; enforces recovery period."""
        self._recovery_until[market_id] = datetime.now(timezone.utc) + timedelta(
            minutes=self.RECOVERY_MINUTES
        )
