"""Copy trading engine — detects new positions from top traders and generates signals."""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from app.strategies.base import Signal, SignalType

if TYPE_CHECKING:
    from app.leaderboard.tracker import LeaderboardTracker

logger = logging.getLogger("polymaus.copy")

# Maximum history entries kept in memory
_MAX_HISTORY = 50


def _trust_score(rank: int) -> float:
    """Compute a proxy trust score from leaderboard rank.

    rank 1  → 1.00
    rank 10 → 0.28  (but floored at 0.30 per spec)
    rank 11+ → clamped to floor
    """
    raw = 1.0 - (rank - 1) * 0.08
    return max(0.30, raw)


class CopyTradingEngine:
    """Detects when top Polymarket traders enter new positions and generates copy signals."""

    # Minimum trust score to follow a trader
    MIN_TRUST = 0.40
    # Maximum confidence cap for copy signals
    MAX_CONFIDENCE = 0.82
    # Late-entry threshold: skip if price has moved more than 15 % from avg cost
    LATE_ENTRY_THRESHOLD = 0.15

    def __init__(self, tracker: LeaderboardTracker) -> None:
        self._tracker = tracker
        # trader address → set of token_ids seen in the previous cycle
        self._prev_positions: dict[str, set[str]] = {}
        # rolling log of the last _MAX_HISTORY copy events (new entries + skips)
        self._copy_history: list[dict] = []

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    async def detect_new_entries(
        self,
        markets: list[dict],
        prices: dict[str, float],
    ) -> list[Signal]:
        """Scan top traders for new position entries and return copy signals.

        Args:
            markets: Normalised market dicts (from PolymarketClient.get_markets).
            prices:  token_id → current price mapping.

        Returns:
            Deduplicated list of BUY_YES / BUY_NO signals.
        """
        signals: list[Signal] = []
        seen_token_ids: set[str] = set()  # deduplicate across traders

        for snap in self._tracker._leaders:
            try:
                trust = _trust_score(snap.rank)
                if trust < self.MIN_TRUST:
                    logger.debug(
                        "Skipping trader #%d (%s) — trust=%.2f below threshold",
                        snap.rank,
                        snap.address[:8],
                        trust,
                    )
                    # Still update prev_positions so we track state consistently
                    current_ids = self._extract_token_ids(snap.positions)
                    self._prev_positions[snap.address] = current_ids
                    continue

                current_ids = self._extract_token_ids(snap.positions)
                prev_ids = self._prev_positions.get(snap.address, set())
                new_ids = current_ids - prev_ids

                for token_id in new_ids:
                    try:
                        sig = self._build_signal(
                            token_id=token_id,
                            snap=snap,
                            trust=trust,
                            markets=markets,
                            prices=prices,
                        )
                        if sig is not None and token_id not in seen_token_ids:
                            signals.append(sig)
                            seen_token_ids.add(token_id)
                    except Exception:
                        logger.exception(
                            "Unexpected error building signal for token %s from trader %s",
                            token_id,
                            snap.address[:8],
                        )

                # Always advance the snapshot for this trader
                self._prev_positions[snap.address] = current_ids

            except Exception:
                logger.exception(
                    "Unexpected error processing trader %s", snap.address[:8]
                )

        return signals

    def get_copy_history(self, n: int = 30) -> list[dict]:
        """Return the most recent *n* copy-trade log entries (newest first)."""
        return list(reversed(self._copy_history[-n:]))

    # ─────────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _extract_token_ids(positions: list[dict]) -> set[str]:
        """Return the set of token_ids present in a positions list."""
        ids: set[str] = set()
        for pos in positions:
            tid = pos.get("tokenId") or pos.get("asset") or ""
            if tid:
                ids.add(tid)
        return ids

    def _find_market(
        self, token_id: str, markets: list[dict]
    ) -> tuple[dict | None, str | None]:
        """Return (market_dict, outcome) for the given token_id, or (None, None)."""
        for m in markets:
            if m.get("yes_token_id") == token_id:
                return m, "YES"
            if m.get("no_token_id") == token_id:
                return m, "NO"
        return None, None

    def _get_position_for_token(
        self, token_id: str, positions: list[dict]
    ) -> dict | None:
        """Find the position dict that owns a given token_id."""
        for pos in positions:
            if (pos.get("tokenId") or pos.get("asset") or "") == token_id:
                return pos
        return None

    def _append_history(self, entry: dict) -> None:
        """Append an entry to copy history, capping at _MAX_HISTORY."""
        self._copy_history.append(entry)
        if len(self._copy_history) > _MAX_HISTORY:
            self._copy_history = self._copy_history[-_MAX_HISTORY:]

    def _build_signal(
        self,
        token_id: str,
        snap,  # TraderSnapshot — imported lazily via TYPE_CHECKING
        trust: float,
        markets: list[dict],
        prices: dict[str, float],
    ) -> Signal | None:
        """Attempt to construct a copy-trade Signal. Returns None if entry should be skipped."""
        from app.leaderboard.tracker import TraderSnapshot  # noqa: F401 — runtime guard

        address = snap.address

        # ── Market lookup ─────────────────────────────────────────────────
        market, outcome = self._find_market(token_id, markets)

        # We still want to log even if market is unknown, but we can't build a signal
        if market is None:
            logger.debug(
                "COPY: token %s from trader %s not found in markets list — skipping",
                token_id,
                address[:8],
            )
            return None

        # ── Price resolution ──────────────────────────────────────────────
        if token_id in prices:
            current_price = prices[token_id]
        elif outcome == "YES":
            current_price = float(market.get("yes_price") or 0.5)
        else:
            current_price = float(market.get("no_price") or 0.5)

        # ── Position metadata ─────────────────────────────────────────────
        pos = self._get_position_for_token(token_id, snap.positions)
        size = float(
            (pos or {}).get("size")
            or (pos or {}).get("currentValue")
            or (pos or {}).get("value")
            or 0
        ) if pos else 0.0

        # ── Late-entry guard ──────────────────────────────────────────────
        avg_cost: float | None = None
        if pos:
            raw_cost = pos.get("avgCost") or pos.get("averageCost") or pos.get("avgPrice")
            if raw_cost is not None:
                try:
                    avg_cost = float(raw_cost)
                except (ValueError, TypeError):
                    avg_cost = None

        late_skipped = False
        if avg_cost is not None and avg_cost > 0:
            price_move = abs(current_price - avg_cost) / avg_cost
            if price_move > self.LATE_ENTRY_THRESHOLD:
                late_skipped = True
                logger.debug(
                    "COPY LATE-ENTRY SKIP: token=%s outcome=%s avg_cost=%.3f "
                    "current=%.3f move=%.1f%% trader=#%d (%s)",
                    token_id,
                    outcome,
                    avg_cost,
                    current_price,
                    price_move * 100,
                    snap.rank,
                    address[:8],
                )

        # ── Always log to history (including skips) ───────────────────────
        history_entry = {
            "traderAddress": address,
            "traderRank": snap.rank,
            "trustScore": round(trust, 3),
            "question": market.get("question", ""),
            "outcome": outcome,
            "price": round(current_price, 4),
            "size": round(size, 2),
            "ts": int(time.time()),
            "tokenId": token_id,
            "marketId": market.get("conditionId", ""),
            "late_skipped": late_skipped,
        }
        self._append_history(history_entry)

        if late_skipped:
            return None

        # ── Build Signal ──────────────────────────────────────────────────
        signal_type = SignalType.BUY_YES if outcome == "YES" else SignalType.BUY_NO
        confidence = min(self.MAX_CONFIDENCE, trust * 0.85)
        reason = f"COPY: {address[:8]}... rank #{snap.rank} | size=${size:.0f}"
        question = market.get("question", "")
        market_id = market.get("conditionId", "")

        logger.info(
            "COPY SIGNAL: %s @ %.3f from trader #%d (%s)",
            outcome,
            current_price,
            snap.rank,
            address[:8],
        )

        return Signal(
            signal=signal_type,
            token_id=token_id,
            market_id=market_id,
            outcome=outcome,
            question=question,
            price=current_price,
            confidence=confidence,
            reason=reason,
            strategy_name="copy_trader",
        )
