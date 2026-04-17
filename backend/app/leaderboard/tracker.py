"""Leaderboard tracker – scrapes top Polymarket traders and extracts their positions.

Used to populate AdaptiveStrategy.hot_tokens.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from app.clients.polymarket import PolymarketClient

logger = logging.getLogger("polymaus.leaderboard")


@dataclass
class TraderSnapshot:
    address: str
    profit: float
    positions: list[dict] = field(default_factory=list)
    rank: int = 0
    trust_score: float = 0.0
    win_rate: float = 0.0
    recent_pnl: float = 0.0
    copy_count: int = 0
    is_followed: bool = False


class LeaderboardTracker:
    TOP_N = 50
    REFRESH_SECS = 900  # every 15 min

    def __init__(self, client: PolymarketClient) -> None:
        self._client = client
        self._leaders: list[TraderSnapshot] = []
        self._hot_tokens: dict[str, dict] = {}  # token_id -> info
        self._last_snapshot: list[dict] = []

    async def refresh(self) -> None:
        """Fetch leaderboard and compute hot tokens."""
        try:
            raw = await self._client.get_leaderboard(limit=self.TOP_N)
            if raw:
                logger.info("Leaderboard API returned %d traders", len(raw))
            else:
                logger.warning("Leaderboard API returned empty — using synthetic fallback")
            self._last_snapshot = raw[:self.TOP_N]
            snapshots = await self._fetch_positions(raw[:self.TOP_N])
            self._leaders = snapshots
            self._hot_tokens = self._compute_hot_tokens(snapshots)
            followed_count = sum(1 for s in snapshots if s.is_followed)
            logger.info(
                "Leaderboard refreshed: %d traders, %d followed (trust >= 0.40), "
                "%d hot tokens",
                len(snapshots),
                followed_count,
                len(self._hot_tokens),
            )
            for i, s in enumerate(snapshots[:5]):
                logger.info(
                    "  Trader #%d %s profit=$%.0f trust=%.2f positions=%d",
                    s.rank, s.address[:12], s.profit, s.trust_score, len(s.positions)
                )
        except Exception as exc:
            # Never crash the bot on leaderboard failure
            logger.warning("Leaderboard refresh failed: %s", exc, exc_info=True)

    async def _fetch_positions(self, traders: list[dict]) -> list[TraderSnapshot]:
        tasks = []
        for i, t in enumerate(traders):
            addr = t.get("address") or t.get("proxyWallet") or t.get("user") or ""
            profit = float(t.get("profit") or t.get("pnl") or 0)
            win_rate = float(t.get("winRate") or t.get("win_rate") or 0)
            recent_pnl = float(
                t.get("profit24h") or t.get("recentPnl") or t.get("profit7d") or 0
            )
            if addr:
                tasks.append(self._fetch_one(addr, profit, i + 1, win_rate, recent_pnl))
        return list(await asyncio.gather(*tasks, return_exceptions=False))

    async def _fetch_one(
        self,
        address: str,
        profit: float,
        rank: int,
        win_rate: float,
        recent_pnl: float,
    ) -> TraderSnapshot:
        # Base: rank-based (rank 1 = 1.0, rank 50 = 0.0)
        rank_score = max(0.0, 1.0 - (rank - 1) / 49)
        # Boost: if profitable recently
        recent_boost = min(0.2, abs(recent_pnl) / 50000) if recent_pnl > 0 else 0
        # Boost: win rate (if available)
        win_boost = (win_rate / 100) * 0.15 if win_rate > 0 else 0
        trust_score = min(1.0, rank_score * 0.65 + recent_boost + win_boost)
        is_followed = trust_score >= 0.40

        try:
            positions = await self._client.get_trader_positions(address)
            snap = TraderSnapshot(
                address=address,
                profit=profit,
                positions=positions,
                rank=rank,
            )
        except Exception:
            snap = TraderSnapshot(address=address, profit=profit, rank=rank)

        snap.trust_score = trust_score
        snap.win_rate = win_rate
        snap.recent_pnl = recent_pnl
        snap.is_followed = is_followed
        return snap

    def _compute_hot_tokens(
        self, snapshots: list[TraderSnapshot]
    ) -> dict[str, dict]:
        """
        Token is "hot" if top traders hold it.
        Weight by trader rank (rank 1 = highest weight).
        """
        token_scores: dict[str, dict] = {}
        for snap in snapshots:
            weight = 1.0 / snap.rank  # rank 1 gets weight 1.0, rank 2 gets 0.5, etc.
            for pos in snap.positions:
                token_id = pos.get("tokenId") or pos.get("asset") or ""
                outcome = pos.get("outcome") or "YES"
                size = float(pos.get("size") or pos.get("currentValue") or 0)
                if not token_id or size < 10:
                    continue
                if token_id not in token_scores:
                    token_scores[token_id] = {
                        "outcome": outcome,
                        "score": 0.0,
                        "traders": 0,
                        "total_size": 0.0,
                    }
                token_scores[token_id]["score"] += weight
                token_scores[token_id]["traders"] += 1
                token_scores[token_id]["total_size"] += size

        # Filter: at least 1 trader + min score
        hot = {
            tid: {
                "outcome": info["outcome"],
                "confidence": min(info["score"] / 3.0, 0.65),
                "reason": f"{info['traders']} top traders, score={info['score']:.2f}",
            }
            for tid, info in token_scores.items()
            if info["traders"] >= 1 and info["score"] >= 0.3
        }
        return hot

    @property
    def hot_tokens(self) -> dict[str, dict]:
        return self._hot_tokens

    def get_ranked_traders(self, min_trust: float = 0.30) -> list[TraderSnapshot]:
        """Return traders filtered by min_trust, sorted by trust_score descending."""
        return sorted(
            (s for s in self._leaders if s.trust_score >= min_trust),
            key=lambda s: s.trust_score,
            reverse=True,
        )

    def get_leaders_snapshot(self) -> list[dict]:
        return [
            {
                "rank": s.rank,
                "address": s.address[:8] + "..." + s.address[-4:] if len(s.address) > 12 else s.address,
                "profit": round(s.profit, 2),
                "positions": len(s.positions),
                "trustScore": round(s.trust_score, 3),
                "winRate": round(s.win_rate, 1),
                "recentPnl": round(s.recent_pnl, 2),
                "copyCount": s.copy_count,
                "isFollowed": s.is_followed,
            }
            for s in self._leaders
        ]

    def get_raw_snapshot(self) -> list[dict]:
        return self._last_snapshot
