"""Risk management engine.

Implements:
  - Per-position USD limits
  - Daily drawdown limits
  - Max concurrent positions
  - Price range validation
  - Kelly Criterion position sizing
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date

from app.config import get_settings
from app.engine.portfolio import Portfolio

settings = get_settings()


@dataclass
class RiskCheckResult:
    allowed: bool
    reason: str = ""
    recommended_size: float = 0.0


class RiskEngine:
    def __init__(self, portfolio: Portfolio) -> None:
        self.portfolio = portfolio
        self._daily_loss_start: dict[date, float] = {}

    def check_entry(
        self,
        price: float,
        requested_size_usd: float,
        token_id: str,
    ) -> RiskCheckResult:
        snap = self.portfolio.snapshot()

        # 1. Price sanity – never buy near 0 or 1
        if not (0.02 <= price <= settings.max_entry_price):
            return RiskCheckResult(
                False,
                f"Price {price:.3f} outside allowed range [0.02, {settings.max_entry_price}]",
            )

        # 2. Daily loss limit
        today = date.today()
        if today not in self._daily_loss_start:
            self._daily_loss_start[today] = snap.equity
        daily_loss = self._daily_loss_start[today] - snap.equity
        if daily_loss >= settings.max_daily_loss_usd:
            return RiskCheckResult(
                False,
                f"Daily loss limit hit: ${daily_loss:.2f} >= ${settings.max_daily_loss_usd}",
            )

        # 3. Max positions
        if snap.open_positions >= settings.max_open_positions:
            # Allow adding to existing positions
            if token_id not in self.portfolio.positions:
                return RiskCheckResult(
                    False,
                    f"Max open positions ({settings.max_open_positions}) reached",
                )

        # 4. Available balance
        available = snap.balance
        if available < settings.min_trade_usd:
            return RiskCheckResult(False, "Insufficient balance")

        # 5. Kelly Criterion sizing
        kelly_size = self._kelly_size(price, snap.equity)
        size = min(
            requested_size_usd,
            kelly_size,
            settings.max_position_usd,
            available * 0.9,  # keep 10% buffer
        )
        if size < settings.min_trade_usd:
            return RiskCheckResult(
                False, f"Sized-down trade ${size:.2f} below minimum ${settings.min_trade_usd}"
            )

        return RiskCheckResult(True, "OK", round(size, 2))

    def check_exit(self, token_id: str, current_price: float) -> tuple[bool, str]:
        """Returns (should_exit, reason)."""
        pos = self.portfolio.positions.get(token_id)
        if not pos:
            return False, "no position"

        pnl_pct = (current_price - pos["avg_cost"]) / pos["avg_cost"]

        # Stop loss: -30%
        if pnl_pct <= -0.30:
            return True, f"stop_loss ({pnl_pct:.1%})"

        # Take profit: +40%
        if pnl_pct >= 0.40:
            return True, f"take_profit ({pnl_pct:.1%})"

        # Price near resolution (> 0.95 or < 0.05)
        if current_price >= 0.95:
            return True, "near_resolution_yes"
        if current_price <= 0.05:
            return True, "near_resolution_no"

        return False, ""

    @staticmethod
    def _kelly_size(p: float, equity: float) -> float:
        """
        Kelly fraction for binary outcome bet.
        f* = p - (1-p)/b  where b = (1/p - 1) are the odds.
        We apply 1/4 Kelly for safety (fractional Kelly).
        """
        if p <= 0 or p >= 1:
            return 0.0
        b = (1.0 - p) / p  # payout odds
        kelly = (p - (1 - p) / b) if b > 0 else 0
        quarter_kelly = max(kelly * 0.25, 0)
        return round(quarter_kelly * equity, 2)
