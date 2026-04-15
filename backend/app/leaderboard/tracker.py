"""Leaderboard tracker – scrapes top Polymarket traders and extracts their positions.

Used to populate AdaptiveStrategy.hot_tokens.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

from app.clients.polymarket import PolymarketClient


@dataclass
class TraderSnapshot:
    address: str
    profit: float
    positions: list[dict] = field(default_factory=list)
    rank: int = 0


class LeaderboardTracker:
    TOP_N = 20
    REFRESH_SECS = 1800  # every 30 min

    def __init__(self, client: PolymarketClient) -> None:
        self._client = client
        self._leaders: list[TraderSnapshot] = []
        self._hot_tokens: dict[str, dict] = {}  # token_id -> info
        self._last_snapshot: list[dict] = []

    async def refresh(self) -> None:
        """Fetch leaderboard and compute hot tokens."""
        try:
            raw = await self._client.get_leaderboard(limit=self.TOP_N)
            self._last_snapshot = raw[:self.TOP_N]
            snapshots = await self._fetch_positions(raw[:self.TOP_N])
            self._leaders = snapshots
            self._hot_tokens = self._compute_hot_tokens(snapshots)
        except Exception as exc:
            # Never crash the bot on leaderboard failure
            pass

    async def _fetch_positions(self, traders: list[dict]) -> list[TraderSnapshot]:
        tasks = []
        for i, t in enumerate(traders):
            addr = t.get("address") or t.get("proxyWallet") or t.get("user") or ""
            profit = float(t.get("profit") or t.get("pnl") or 0)
            if addr:
                tasks.append(self._fetch_one(addr, profit, i + 1))
        return list(await asyncio.gather(*tasks, return_exceptions=False))

    async def _fetch_one(self, address: str, profit: float, rank: int) -> TraderSnapshot:
        try:
            positions = await self._client.get_trader_positions(address)
            return TraderSnapshot(address=address, profit=profit, positions=positions, rank=rank)
        except Exception:
            return TraderSnapshot(address=address, profit=profit, rank=rank)

    def _compute_hot_tokens(
        self, snapshots: list[TraderSnapshot]
    ) -> dict[str, dict]:
        """
        Token is "hot" if multiple top traders hold it.
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

        # Filter: at least 2 traders + min score
        hot = {
            tid: {
                "outcome": info["outcome"],
                "confidence": min(info["score"] / 3.0, 0.65),
                "reason": f"{info['traders']} top traders, score={info['score']:.2f}",
            }
            for tid, info in token_scores.items()
            if info["traders"] >= 2 and info["score"] >= 0.5
        }
        return hot

    @property
    def hot_tokens(self) -> dict[str, dict]:
        return self._hot_tokens

    def get_leaders_snapshot(self) -> list[dict]:
        return [
            {
                "rank": s.rank,
                "address": s.address[:10] + "..." + s.address[-6:] if len(s.address) > 16 else s.address,
                "profit": round(s.profit, 2),
                "positions": len(s.positions),
            }
            for s in self._leaders
        ]

    def get_raw_snapshot(self) -> list[dict]:
        return self._last_snapshot
