"""Abstract base for all trading strategies."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any


class SignalType(str, Enum):
    BUY_YES = "BUY_YES"
    BUY_NO = "BUY_NO"
    SELL = "SELL"
    HOLD = "HOLD"


@dataclass
class Signal:
    signal: SignalType
    token_id: str
    market_id: str
    outcome: str         # YES | NO
    question: str
    price: float
    confidence: float    # 0.0 – 1.0
    reason: str
    strategy_name: str

    def to_dict(self) -> dict:
        return {
            "signal": self.signal.value,
            "tokenId": self.token_id,
            "marketId": self.market_id,
            "outcome": self.outcome,
            "question": self.question[:80],
            "price": round(self.price, 4),
            "confidence": round(self.confidence, 3),
            "reason": self.reason,
            "strategyName": self.strategy_name,
        }


class BaseStrategy(ABC):
    name: str = "base"

    @abstractmethod
    async def analyze(self, markets: list[dict], prices: dict[str, float]) -> list[Signal]:
        """Return trade signals for the given markets."""
        ...

    @staticmethod
    def _get_token_price(market: dict, outcome: str, prices: dict[str, float]) -> float:
        key = "yes_token_id" if outcome == "YES" else "no_token_id"
        token_id = market.get(key, "")
        if token_id in prices:
            return prices[token_id]
        # Fallback to market embedded price
        p = market.get("outcomePrices") or []
        if outcome == "YES" and p:
            return float(p[0]) if p else 0.5
        if outcome == "NO" and len(p) > 1:
            return float(p[1])
        return 0.5
