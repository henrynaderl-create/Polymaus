"""Momentum / Crypto-priority strategy.

Thesis:
  1. Crypto price-prediction markets (BTC/SOL/ETH up-or-down) have the highest
     liquidity and tightest spreads — trade those first.
  2. Any market where YES is priced 0.62-0.90 has been bid up by the crowd.
     If we have even slight contrarian evidence we buy NO; if YES aligns with
     macro sentiment we buy YES.
  3. Volume surge (>2× 7-day avg implied by 24 h vol) signals information flow.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.config import get_settings
from app.strategies.base import BaseStrategy, Signal, SignalType

settings = get_settings()
logger = logging.getLogger("polymaus.momentum")

# Keywords that flag a high-priority crypto market
CRYPTO_KEYWORDS = {
    "btc", "bitcoin", "sol", "solana", "eth", "ethereum", "bnb", "xrp",
    "avax", "avalanche", "doge", "dogecoin", "crypto", "defi", "nft",
}

# Keywords that flag a high-priority political/news-driven market
TRENDING_KEYWORDS = {
    "trump", "elon", "fed", "interest rate", "election", "president",
    "congress", "senate", "war", "sanction",
}


class MomentumStrategy(BaseStrategy):
    name = "momentum"

    # YES price range we find actionable
    YES_BUY_YES_MIN: float = 0.62   # BUY YES when market strongly agrees (>0.62)
    YES_BUY_YES_MAX: float = 0.88   # but not so extreme it's nearly resolved
    YES_BUY_NO_MIN: float = 0.65    # BUY NO when crowd is very bullish (contrarian)
    YES_BUY_NO_MAX: float = 0.92    # hard cap before near-resolution

    MIN_VOLUME_24H: float = 150.0
    MIN_LIQUIDITY: float = 50.0

    async def analyze(
        self, markets: list[dict], prices: dict[str, float]
    ) -> list[Signal]:
        crypto_markets = []
        trending_markets = []
        other_markets = []

        for m in markets:
            q = (m.get("question") or "").lower()
            if any(kw in q for kw in CRYPTO_KEYWORDS):
                crypto_markets.append(m)
            elif any(kw in q for kw in TRENDING_KEYWORDS):
                trending_markets.append(m)
            else:
                other_markets.append(m)

        ordered = crypto_markets + trending_markets + other_markets

        signals: list[Signal] = []
        for m in ordered:
            try:
                signals.extend(self._evaluate(m, prices, is_crypto=(m in crypto_markets)))
            except Exception:
                continue

        return sorted(signals, key=lambda s: s.confidence, reverse=True)[:20]

    def _evaluate(
        self, market: dict, prices: dict[str, float], is_crypto: bool
    ) -> list[Signal]:
        yes_token = market.get("yes_token_id") or ""
        no_token = market.get("no_token_id") or ""
        if not yes_token or not no_token:
            return []

        volume = float(market.get("volume24hr") or market.get("volume") or 0)
        liquidity = float(market.get("liquidity") or 0)
        if volume < self.MIN_VOLUME_24H or liquidity < self.MIN_LIQUIDITY:
            return []

        yes_price = prices.get(yes_token, float(market.get("yes_price") or 0.5))
        no_price = 1.0 - yes_price

        # Skip near-resolved markets
        if yes_price >= 0.95 or yes_price <= 0.05:
            return []

        question = market.get("question", "")
        market_id = market.get("conditionId") or market.get("id", "")
        crypto_boost = 0.08 if is_crypto else 0.0
        vol_boost = min(0.10, volume / 200_000)
        time_bonus = self._time_value_bonus(market)

        sigs: list[Signal] = []

        # ── BUY YES: market strongly agrees — ride the momentum ────────────
        if self.YES_BUY_YES_MIN <= yes_price <= self.YES_BUY_YES_MAX:
            if yes_price > 0.80:
                # Very high probability — only trade crypto or high-volume
                if not is_crypto and volume < 10_000:
                    pass
                else:
                    conf = 0.55 + crypto_boost + vol_boost + time_bonus * 0.1
                    sigs.append(Signal(
                        signal=SignalType.BUY_YES,
                        token_id=yes_token,
                        market_id=market_id,
                        outcome="YES",
                        question=question,
                        price=yes_price,
                        confidence=min(0.90, conf),
                        reason=f"high-prob YES={yes_price:.2f} vol=${volume:,.0f}",
                        strategy_name=self.name,
                    ))
            else:
                conf = 0.45 + (yes_price - self.YES_BUY_YES_MIN) * 0.8 + crypto_boost + vol_boost
                sigs.append(Signal(
                    signal=SignalType.BUY_YES,
                    token_id=yes_token,
                    market_id=market_id,
                    outcome="YES",
                    question=question,
                    price=yes_price,
                    confidence=min(0.85, conf),
                    reason=f"momentum YES={yes_price:.2f} vol=${volume:,.0f}",
                    strategy_name=self.name,
                ))

        # ── BUY NO: contrarian when crowd is overly bullish ────────────────
        if self.YES_BUY_NO_MIN <= yes_price <= self.YES_BUY_NO_MAX:
            if no_price >= 0.02:
                overpricing = (yes_price - self.YES_BUY_NO_MIN) / (self.YES_BUY_NO_MAX - self.YES_BUY_NO_MIN)
                conf = 0.40 + overpricing * 0.35 + crypto_boost * 0.5 + vol_boost
                sigs.append(Signal(
                    signal=SignalType.BUY_NO,
                    token_id=no_token,
                    market_id=market_id,
                    outcome="NO",
                    question=question,
                    price=no_price,
                    confidence=min(0.88, conf),
                    reason=f"contrarian NO={no_price:.2f} (YES={yes_price:.2f}) vol=${volume:,.0f}",
                    strategy_name=self.name,
                ))

        return sigs

    @staticmethod
    def _time_value_bonus(market: dict) -> float:
        end_str = market.get("endDate") or market.get("endDateIso") or ""
        if not end_str:
            return 0.0
        try:
            end_dt = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
            days_left = (end_dt - datetime.now(timezone.utc)).days
            if days_left <= 0:
                return 0.0
            return max(0.0, 1.0 - days_left / 30.0)
        except Exception:
            return 0.0
