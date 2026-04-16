"""Multi-factor edge scorer for Polymarket markets."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

logger = logging.getLogger("polymaus.edge")


class EdgeScorer:
    """Scores each market for trading edge using contrarian, volume, drift, and liquidity factors.

    Factor weights
    --------------
    A — Contrarian    0.35
    B — Volume spike  0.25
    C — Price drift   0.25
    D — Liquidity     0.15
    """

    def __init__(self) -> None:
        # token_id / conditionId → last seen yes_price
        self._prev_prices: dict[str, float] = {}
        # conditionId → last seen 24 h volume
        self._prev_volumes: dict[str, float] = {}

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    def score_markets(
        self,
        markets: list[dict],
        prices: dict[str, float],
    ) -> list[dict]:
        """Score every market and return results sorted by edge_score descending.

        Args:
            markets: Normalised market dicts (from PolymarketClient.get_markets).
            prices:  token_id → current price mapping (used as authoritative yes_price
                     when available).

        Returns:
            List of scored market dicts, sorted by ``edgeScore`` descending.
        """
        results: list[dict] = []

        for market in markets:
            try:
                scored = self._score_one(market, prices)
                if scored is not None:
                    results.append(scored)
            except Exception:
                logger.exception(
                    "EdgeScorer: unexpected error scoring market %s",
                    market.get("conditionId", "<unknown>"),
                )

        results.sort(key=lambda x: x["edgeScore"], reverse=True)
        return results

    def get_top_edges(
        self,
        markets: list[dict],
        prices: dict[str, float],
        min_score: float = 0.20,
        top_n: int = 10,
    ) -> list[dict]:
        """Score markets, filter by minimum edge score, and return the top *top_n*.

        Args:
            markets:   Normalised market dicts.
            prices:    token_id → price mapping.
            min_score: Minimum ``edgeScore`` to include (default 0.20).
            top_n:     Maximum number of results to return (default 10).

        Returns:
            Up to *top_n* markets with ``edgeScore >= min_score``, best first.
        """
        scored = self.score_markets(markets, prices)
        filtered = [m for m in scored if m["edgeScore"] >= min_score]
        return filtered[:top_n]

    # ─────────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _resolve_yes_price(self, market: dict, prices: dict[str, float]) -> float:
        """Return the best available YES price for a market."""
        yes_token = market.get("yes_token_id", "")
        if yes_token and yes_token in prices:
            return float(prices[yes_token])
        raw = market.get("yes_price")
        if raw is not None:
            try:
                return float(raw)
            except (ValueError, TypeError):
                pass
        # Last-resort: first element of outcomePrices
        outcome_prices = market.get("outcomePrices") or []
        if outcome_prices:
            try:
                return float(outcome_prices[0])
            except (ValueError, TypeError):
                pass
        return 0.5

    def _score_one(
        self,
        market: dict,
        prices: dict[str, float],
    ) -> dict | None:
        condition_id: str = market.get("conditionId", "")
        question: str = market.get("question", "")

        # ── Resolve current values ────────────────────────────────────────
        yes_price = self._resolve_yes_price(market, prices)
        vol: float = float(market.get("volume24hr") or 0)
        liquidity: float = float(market.get("liquidity") or 0)

        # ── Previous values (default to current on first call) ────────────
        prev_yes_price = self._prev_prices.get(condition_id, yes_price)
        prev_vol = self._prev_volumes.get(condition_id, vol)

        # ── Factor A: Contrarian (weight 0.35) ────────────────────────────
        # YES > 0.55 → partial; YES > 0.70 → higher; scaled 0 → 1
        contrarian_score = max(0.0, (yes_price - 0.55) / 0.45)
        contrarian_score = min(1.0, contrarian_score)

        # ── Factor B: Volume spike (weight 0.25) ──────────────────────────
        # spike = vol more than 1.5× previous volume
        if vol > prev_vol:
            vol_score = min(
                1.0,
                max(0.0, (vol / max(prev_vol, 1.0)) - 1.5) / 1.5,
            )
        else:
            vol_score = 0.0

        # ── Factor C: Price drift (weight 0.25) ───────────────────────────
        # significant move = > 5 cent change in yes_price
        drift = abs(yes_price - prev_yes_price)
        if drift > 0.05:
            drift_score = min(1.0, drift / 0.20)
        else:
            drift_score = 0.0

        # ── Factor D: Liquidity quality (weight 0.15) ─────────────────────
        # $50 k → 1.0;  $10 k → 0.2;  < $1 k → near 0
        liq_score = min(1.0, liquidity / 50_000.0)

        # ── Composite edge score ──────────────────────────────────────────
        edge_score = (
            0.35 * contrarian_score
            + 0.25 * vol_score
            + 0.25 * drift_score
            + 0.15 * liq_score
        )

        # ── Update state for next cycle ───────────────────────────────────
        self._prev_prices[condition_id] = yes_price
        self._prev_volumes[condition_id] = vol

        return {
            "conditionId": condition_id,
            "question": question,
            "edgeScore": round(edge_score, 3),
            "yesPrice": round(yes_price, 4),
            "noPrice": round(1.0 - yes_price, 4),
            "volume24h": vol,
            "factors": {
                "contrarian": round(contrarian_score, 3),
                "volumeSpike": round(vol_score, 3),
                "priceDrift": round(drift_score, 3),
                "liquidity": round(liq_score, 3),
            },
        }
