"""Multi-signal fusion strategy.

Combines three independent signal detectors (inspired by BTC-15-min bot):
  1. Spike detector  – detects abnormal price velocity
  2. Momentum signal – short-term momentum reversal
  3. Discount signal  – statistical mispricing vs. similar markets

A trade fires only when `consensus_required` signals agree (default: 2).
"""
from __future__ import annotations

import math
import statistics
from dataclasses import dataclass

from app.config import get_settings
from app.strategies.base import BaseStrategy, Signal, SignalType

settings = get_settings()


@dataclass
class SubSignal:
    name: str
    direction: str  # "YES" | "NO" | "NONE"
    strength: float  # 0.0 – 1.0


class SignalStrategy(BaseStrategy):
    name = "signal"

    SPIKE_THRESHOLD = 0.15    # 15% price move triggers spike signal
    MOMENTUM_WINDOW = 5       # price samples for momentum calc
    DISCOUNT_THRESHOLD = 0.08 # 8% below category average = discount
    CONSENSUS = settings.signal_consensus_required

    def __init__(self) -> None:
        # price history buffer: token_id -> list of (price, timestamp)
        self._history: dict[str, list[float]] = {}

    async def analyze(self, markets: list[dict], prices: dict[str, float]) -> list[Signal]:
        # Update history
        for token_id, price in prices.items():
            if token_id not in self._history:
                self._history[token_id] = []
            buf = self._history[token_id]
            buf.append(price)
            if len(buf) > 20:
                buf.pop(0)

        # Compute category averages
        cat_prices: dict[str, list[float]] = {}
        for m in markets:
            cat = (m.get("category") or "general").lower()
            yes_token = m.get("yes_token_id") or ""
            if yes_token in prices:
                cat_prices.setdefault(cat, []).append(prices[yes_token])

        cat_avg = {c: statistics.mean(v) for c, v in cat_prices.items() if v}

        signals: list[Signal] = []
        for m in markets:
            try:
                sig = self._evaluate(m, prices, cat_avg)
                if sig:
                    signals.append(sig)
            except Exception:
                continue

        return sorted(signals, key=lambda s: s.confidence, reverse=True)[:15]

    def _evaluate(
        self, market: dict, prices: dict[str, float], cat_avg: dict[str, float]
    ) -> Signal | None:
        yes_token = market.get("yes_token_id") or (market.get("clobTokenIds", [""])[0])
        no_token = market.get("no_token_id") or (
            market.get("clobTokenIds", [None, None])[1]
            if len(market.get("clobTokenIds", [])) > 1
            else ""
        )

        if not yes_token or yes_token not in prices:
            return None

        yes_price = prices[yes_token]
        no_price = 1.0 - yes_price
        volume = float(market.get("volume24hr") or 0)

        if volume < 1_000:
            return None

        sub_signals = [
            self._spike_signal(yes_token, yes_price),
            self._momentum_signal(yes_token, yes_price),
            self._discount_signal(
                yes_price,
                market.get("category", "general"),
                cat_avg,
            ),
        ]

        # Count directional votes
        yes_votes = [s for s in sub_signals if s.direction == "NO"]  # buy NO when YES spikes
        no_votes = [s for s in sub_signals if s.direction == "YES"]

        best_votes = yes_votes if len(yes_votes) >= len(no_votes) else no_votes
        direction = "NO" if best_votes is yes_votes else "YES"

        if len(best_votes) < self.CONSENSUS:
            return None

        strength = sum(s.strength for s in best_votes) / len(best_votes)
        confidence = min(0.3 + strength * 0.6, 0.92)
        token_id = no_token if direction == "NO" else yes_token
        trade_price = no_price if direction == "NO" else yes_price

        if not token_id or trade_price < 0.02 or trade_price > settings.max_entry_price:
            return None

        reasons = " + ".join(f"{s.name}({s.strength:.2f})" for s in best_votes)

        return Signal(
            signal=SignalType.BUY_NO if direction == "NO" else SignalType.BUY_YES,
            token_id=token_id,
            market_id=market.get("conditionId") or market.get("id", ""),
            outcome=direction,
            question=market.get("question", ""),
            price=trade_price,
            confidence=confidence,
            reason=f"consensus={len(best_votes)}/{self.CONSENSUS}: {reasons}",
            strategy_name=self.name,
        )

    def _spike_signal(self, token_id: str, current: float) -> SubSignal:
        history = self._history.get(token_id, [])
        if len(history) < 3:
            return SubSignal("spike", "NONE", 0.0)
        prev = history[-3]
        change = abs(current - prev) / max(prev, 0.01)
        if change >= self.SPIKE_THRESHOLD:
            # Spike in YES → contrarian → signal NO
            direction = "NO" if current > prev else "YES"
            return SubSignal("spike", direction, min(change / 0.30, 1.0))
        return SubSignal("spike", "NONE", 0.0)

    def _momentum_signal(self, token_id: str, current: float) -> SubSignal:
        history = self._history.get(token_id, [])
        if len(history) < self.MOMENTUM_WINDOW:
            return SubSignal("momentum", "NONE", 0.0)
        window = history[-self.MOMENTUM_WINDOW:]
        slope = (window[-1] - window[0]) / self.MOMENTUM_WINDOW
        if abs(slope) < 0.005:
            return SubSignal("momentum", "NONE", 0.0)
        # Trend reversal signal: strong up-trend → likely to mean-revert
        direction = "NO" if slope > 0 else "YES"
        strength = min(abs(slope) / 0.03, 1.0)
        return SubSignal("momentum", direction, strength)

    def _discount_signal(
        self, yes_price: float, category: str, cat_avg: dict[str, float]
    ) -> SubSignal:
        avg = cat_avg.get((category or "general").lower())
        if avg is None or avg <= 0:
            return SubSignal("discount", "NONE", 0.0)
        deviation = (yes_price - avg) / avg
        if deviation >= self.DISCOUNT_THRESHOLD:
            # YES overpriced vs category → buy NO
            strength = min(deviation / 0.20, 1.0)
            return SubSignal("discount", "NO", strength)
        if deviation <= -self.DISCOUNT_THRESHOLD:
            # YES discounted vs category → buy YES
            strength = min(abs(deviation) / 0.20, 1.0)
            return SubSignal("discount", "YES", strength)
        return SubSignal("discount", "NONE", 0.0)
