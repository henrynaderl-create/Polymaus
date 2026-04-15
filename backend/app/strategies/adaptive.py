"""Adaptive strategy – learns from top leaderboard traders.

Tracks the markets that top-N traders are active in,
then mirrors their positions with a delay and discount.
"""
from __future__ import annotations

from app.config import get_settings
from app.strategies.base import BaseStrategy, Signal, SignalType

settings = get_settings()


class AdaptiveStrategy(BaseStrategy):
    name = "adaptive"

    # Only mirror traders with these minimum stats
    MIN_PROFIT_USD = 5_000
    # Discount factor: enter at slightly worse price to avoid front-running
    PRICE_DISCOUNT = 0.03
    # Max confidence cap – we never blindly copy with high certainty
    MAX_CONFIDENCE = 0.65

    def __init__(self) -> None:
        # Populated by LeaderboardTracker
        self.hot_tokens: dict[str, dict] = {}  # token_id -> {direction, confidence, reason}

    async def analyze(self, markets: list[dict], prices: dict[str, float]) -> list[Signal]:
        if not self.hot_tokens:
            return []

        signals = []
        for m in markets:
            yes_token = m.get("yes_token_id") or (m.get("clobTokenIds", [""])[0])
            no_token = m.get("no_token_id") or (
                m.get("clobTokenIds", [None, None])[1]
                if len(m.get("clobTokenIds", [])) > 1
                else ""
            )

            for token_id in [yes_token, no_token]:
                if not token_id or token_id not in self.hot_tokens:
                    continue
                info = self.hot_tokens[token_id]
                outcome = info.get("outcome", "YES")
                price = prices.get(token_id, 0.5)

                if outcome == "NO":
                    # Apply discount: enter at slightly higher NO price
                    entry_price = min(price + self.PRICE_DISCOUNT, 0.95)
                else:
                    entry_price = min(price + self.PRICE_DISCOUNT, 0.95)

                if entry_price > settings.max_entry_price:
                    continue

                confidence = min(info.get("confidence", 0.5), self.MAX_CONFIDENCE)
                signals.append(Signal(
                    signal=SignalType.BUY_NO if outcome == "NO" else SignalType.BUY_YES,
                    token_id=token_id,
                    market_id=m.get("conditionId") or m.get("id", ""),
                    outcome=outcome,
                    question=m.get("question", ""),
                    price=entry_price,
                    confidence=confidence,
                    reason=info.get("reason", "leaderboard_mirror"),
                    strategy_name=self.name,
                ))

        return sorted(signals, key=lambda s: s.confidence, reverse=True)[:10]

    def update_hot_tokens(self, hot_tokens: dict[str, dict]) -> None:
        self.hot_tokens = hot_tokens
