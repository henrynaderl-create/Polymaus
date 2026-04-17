"""In-memory + DB portfolio state."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.database import AsyncSession


@dataclass
class PortfolioState:
    """Snapshot broadcast to WebSocket clients."""
    balance: float
    equity: float               # balance + unrealised pnl
    unrealised_pnl: float
    realised_pnl: float
    daily_pnl: float
    total_trades: int
    win_trades: int
    open_positions: int
    win_rate: float
    is_demo: bool
    updated_at: str = ""

    def to_dict(self) -> dict:
        return {
            "balance": round(self.balance, 2),
            "equity": round(self.equity, 2),
            "unrealisedPnl": round(self.unrealised_pnl, 2),
            "realisedPnl": round(self.realised_pnl, 2),
            "dailyPnl": round(self.daily_pnl, 2),
            "totalTrades": self.total_trades,
            "winTrades": self.win_trades,
            "openPositions": self.open_positions,
            "winRate": round(self.win_rate * 100, 1),
            "isDemo": self.is_demo,
            "updatedAt": self.updated_at or datetime.utcnow().isoformat(),
        }


class Portfolio:
    """Thread-safe portfolio tracker."""

    def __init__(self, starting_balance: float, is_demo: bool) -> None:
        self._lock = asyncio.Lock()
        self.balance = starting_balance
        self.starting_balance = starting_balance
        self.is_demo = is_demo

        # positions: token_id -> {shares, avg_cost, current_price, question, outcome, strategy}
        self.positions: dict[str, dict] = {}

        # trade history
        self.trades: list[dict] = []
        self.daily_realised: dict[date, float] = {}

    async def open_position(
        self,
        token_id: str,
        outcome: str,
        question: str,
        price: float,
        size_usd: float,
        strategy: str,
        market_id: str,
    ) -> dict:
        shares = size_usd / price if price > 0 else 0
        async with self._lock:
            if token_id in self.positions:
                # Average down / up
                pos = self.positions[token_id]
                total_cost = pos["avg_cost"] * pos["shares"] + price * shares
                pos["shares"] += shares
                pos["avg_cost"] = total_cost / pos["shares"] if pos["shares"] else price
            else:
                self.positions[token_id] = {
                    "token_id": token_id,
                    "market_id": market_id,
                    "question": question,
                    "outcome": outcome,
                    "shares": shares,
                    "avg_cost": price,
                    "current_price": price,
                    "unrealised_pnl": 0.0,
                    "strategy": strategy,
                    "opened_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
                }
            self.balance -= size_usd
            trade = {
                "side": "BUY",
                "token_id": token_id,
                "market_id": market_id,
                "question": question,
                "outcome": outcome,
                "price": round(price, 4),
                "size": round(size_usd, 2),
                "size_usd": round(size_usd, 2),
                "shares": round(shares, 4),
                "strategy": strategy,
                "ts": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            }
            self.trades.append(trade)
            return trade

    async def close_position(
        self, token_id: str, close_price: float, close_shares: float | None = None
    ) -> dict | None:
        async with self._lock:
            pos = self.positions.get(token_id)
            if not pos:
                return None
            shares = close_shares or pos["shares"]
            proceeds = shares * close_price
            cost = shares * pos["avg_cost"]
            pnl = proceeds - cost
            today = date.today()
            self.daily_realised[today] = self.daily_realised.get(today, 0.0) + pnl
            self.balance += proceeds
            if shares >= pos["shares"]:
                del self.positions[token_id]
            else:
                pos["shares"] -= shares
            trade = {
                "side": "SELL",
                "token_id": token_id,
                "market_id": pos["market_id"],
                "question": pos["question"],
                "outcome": pos["outcome"],
                "price": round(close_price, 4),
                "size": round(proceeds, 2),
                "size_usd": round(proceeds, 2),
                "shares": round(shares, 4),
                "pnl": round(pnl, 4),
                "strategy": pos["strategy"],
                "ts": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            }
            self.trades.append(trade)
            return trade

    async def update_prices(self, prices: dict[str, float]) -> None:
        async with self._lock:
            for token_id, price in prices.items():
                if token_id in self.positions:
                    pos = self.positions[token_id]
                    pos["current_price"] = price
                    pos["unrealised_pnl"] = (price - pos["avg_cost"]) * pos["shares"]

    def snapshot(self) -> PortfolioState:
        unrealised = sum(p["unrealised_pnl"] for p in self.positions.values())
        realised = sum(
            t["pnl"] for t in self.trades if t["side"] == "SELL" and "pnl" in t
        )
        today = date.today()
        daily = self.daily_realised.get(today, 0.0)
        wins = sum(1 for t in self.trades if t.get("pnl", 0) > 0)
        sells = sum(1 for t in self.trades if t.get("side") == "SELL")
        return PortfolioState(
            balance=self.balance,
            equity=self.balance + unrealised,
            unrealised_pnl=unrealised,
            realised_pnl=realised,
            daily_pnl=daily,
            total_trades=len(self.trades),
            win_trades=wins,
            open_positions=len(self.positions),
            win_rate=wins / sells if sells > 0 else 0.0,
            is_demo=self.is_demo,
        )

    def get_recent_trades(self, n: int = 50) -> list[dict]:
        return list(reversed(self.trades[-n:]))

    def get_positions(self) -> list[dict]:
        return list(self.positions.values())
