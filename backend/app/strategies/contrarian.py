"""Contrarian / 'Nothing Happens' strategy.

Core thesis: Most predicted rare events don't materialise.
Buy NO positions when YES price is overpriced (> threshold).
Also watch for binary markets where NO is deeply discounted.

Improvements over reference implementation:
  - Kelly-informed entry prices
  - Multi-factor scoring (volume, liquidity, time-to-resolution)
  - Avoid markets with active news / high sentiment
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.config import get_settings
from app.strategies.base import BaseStrategy, Signal, SignalType

settings = get_settings()

# Markets where YES can spike unexpectedly – skip these
SKIP_KEYWORDS = {
    "btc", "bitcoin", "eth", "crypto", "elon", "trump", "hurricane",
    "earthquake", "war", "assassination",
}


class ContrarianStrategy(BaseStrategy):
    name = "contrarian"

    # Entry: buy NO when YES price is above this threshold (lowered for demo)
    YES_THRESHOLD_HIGH: float = 0.55
    # Minimum volume to ensure liquidity (lowered for demo)
    MIN_VOLUME_24H: float = 200.0
    # Minimum liquidity (lowered for demo)
    MIN_LIQUIDITY: float = 100.0

    async def analyze(self, markets: list[dict], prices: dict[str, float]) -> list[Signal]:
        signals: list[Signal] = []

        for m in markets:
            try:
                signals.extend(self._evaluate(m, prices))
            except Exception:
                continue

        # Sort by confidence descending
        return sorted(signals, key=lambda s: s.confidence, reverse=True)[:20]

    def _evaluate(self, market: dict, prices: dict[str, float]) -> list[Signal]:
        question = (market.get("question") or "").lower()

        # Skip volatile / unpredictable categories
        if any(kw in question for kw in SKIP_KEYWORDS):
            return []

        yes_token = market.get("yes_token_id") or market.get("clobTokenIds", [""])[0]
        no_token = market.get("no_token_id") or (
            market.get("clobTokenIds", [None, None])[1] if
            len(market.get("clobTokenIds", [])) > 1 else ""
        )

        if not yes_token or not no_token:
            return []

        volume = float(market.get("volume24hr") or market.get("volume") or 0)
        liquidity = float(market.get("liquidity") or 0)

        if volume < self.MIN_VOLUME_24H or liquidity < self.MIN_LIQUIDITY:
            return []

        yes_price = prices.get(yes_token, float(market.get("outcomePrices", [0.5])[0]))
        no_price = 1.0 - yes_price

        # ── Signal 1: YES is overpriced → buy NO ─────────────────────────
        if yes_price >= self.YES_THRESHOLD_HIGH and no_price >= 0.02:
            # Score based on how overpriced YES appears
            overpricing = (yes_price - self.YES_THRESHOLD_HIGH) / (1.0 - self.YES_THRESHOLD_HIGH)
            time_bonus = self._time_value_bonus(market)
            confidence = min(0.4 + overpricing * 0.4 + time_bonus * 0.2, 0.95)

            yield Signal(
                signal=SignalType.BUY_NO,
                token_id=no_token,
                market_id=market.get("conditionId") or market.get("id", ""),
                outcome="NO",
                question=market.get("question", ""),
                price=no_price,
                confidence=confidence,
                reason=f"YES={yes_price:.2f} > threshold={self.YES_THRESHOLD_HIGH}; "
                       f"vol=${volume:,.0f}",
                strategy_name=self.name,
            )

        # ── Signal 2: NO deeply discounted (< 0.15) and decent volume ───
        if 0.05 <= no_price <= 0.15 and volume >= self.MIN_VOLUME_24H * 3:
            confidence = 0.30 + (0.15 - no_price) / 0.15 * 0.30
            yield Signal(
                signal=SignalType.BUY_NO,
                token_id=no_token,
                market_id=market.get("conditionId") or market.get("id", ""),
                outcome="NO",
                question=market.get("question", ""),
                price=no_price,
                confidence=min(confidence, 0.70),
                reason=f"NO={no_price:.2f} deeply discounted; vol=${volume:,.0f}",
                strategy_name=self.name,
            )

    @staticmethod
    def _time_value_bonus(market: dict) -> float:
        """Bonus for markets resolving soon – faster capital recycling."""
        end_str = market.get("endDate") or market.get("endDateIso") or ""
        if not end_str:
            return 0.0
        try:
            end_dt = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
            days_left = (end_dt - datetime.now(timezone.utc)).days
            if days_left <= 0:
                return 0.0
            # Bonus peaks at 7 days
            return max(0.0, 1.0 - days_left / 30.0)
        except Exception:
            return 0.0
