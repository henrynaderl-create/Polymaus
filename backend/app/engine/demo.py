"""Demo / paper-trading engine.

Simulates order fills with realistic slippage so strategies can be
tested without risking real funds.
"""
from __future__ import annotations

import random
from typing import Any

from app.config import get_settings
from app.engine.portfolio import Portfolio
from app.engine.risk import RiskEngine

settings = get_settings()


class DemoEngine:
    """Executes simulated orders against the portfolio."""

    def __init__(self, portfolio: Portfolio, risk: RiskEngine) -> None:
        self.portfolio = portfolio
        self.risk = risk

    async def execute_buy(
        self,
        token_id: str,
        market_id: str,
        question: str,
        outcome: str,
        market_price: float,
        strategy: str,
    ) -> dict | None:
        """
        Simulate buying `outcome` shares at current market price + slippage.
        Returns trade dict or None if blocked.
        """
        equity = self.portfolio.snapshot().equity
        target_usd = equity * settings.portfolio_alloc_pct

        check = self.risk.check_entry(market_price, target_usd, token_id)
        if not check.allowed:
            return None

        fill_price = self._apply_slippage(market_price, side="buy")
        trade = await self.portfolio.open_position(
            token_id=token_id,
            outcome=outcome,
            question=question,
            price=fill_price,
            size_usd=check.recommended_size,
            strategy=strategy,
            market_id=market_id,
        )
        trade["fill_price"] = fill_price
        trade["demo"] = True
        return trade

    async def execute_sell(
        self,
        token_id: str,
        market_price: float,
    ) -> dict | None:
        """Simulate closing a position."""
        if token_id not in self.portfolio.positions:
            return None
        fill_price = self._apply_slippage(market_price, side="sell")
        trade = await self.portfolio.close_position(token_id, fill_price)
        if trade:
            trade["fill_price"] = fill_price
            trade["demo"] = True
        return trade

    @staticmethod
    def _apply_slippage(price: float, side: str) -> float:
        slippage = settings.demo_slippage_bps / 10_000
        noise = random.uniform(0, slippage)
        if side == "buy":
            return min(price + noise, 0.999)
        return max(price - noise, 0.001)
