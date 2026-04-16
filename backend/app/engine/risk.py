"""Risk management engine.

Implements:
  - Per-position USD limits
  - Daily drawdown limits
  - Max concurrent positions
  - Price range validation
  - Kelly Criterion position sizing
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import date

from app.config import get_settings
from app.engine.portfolio import Portfolio

logger = logging.getLogger("polymaus.risk")
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
            reason = f"Price {price:.3f} outside allowed range [0.02, {settings.max_entry_price}]"
            logger.debug("RISK BLOCK: %s | token=%s", reason, token_id[:12])
            return RiskCheckResult(False, reason)

        # 2. Daily loss limit
        today = date.today()
        if today not in self._daily_loss_start:
            self._daily_loss_start[today] = snap.equity
        daily_loss = self._daily_loss_start[today] - snap.equity
        if daily_loss >= settings.max_daily_loss_usd:
            reason = f"Daily loss limit hit: ${daily_loss:.2f} >= ${settings.max_daily_loss_usd}"
            logger.warning("RISK BLOCK: %s", reason)
            return RiskCheckResult(False, reason)

        # 3. Max positions
        if snap.open_positions >= settings.max_open_positions:
            if token_id not in self.portfolio.positions:
                reason = f"Max open positions ({settings.max_open_positions}) reached"
                logger.debug("RISK BLOCK: %s", reason)
                return RiskCheckResult(False, reason)

        # 4. Available balance
        available = snap.balance
        if available < settings.min_trade_usd:
            reason = "Insufficient balance"
            logger.warning("RISK BLOCK: %s ($%.2f available)", reason, available)
            return RiskCheckResult(False, reason)

        # 5. Kelly Criterion sizing
        kelly_size = self._kelly_size(price, snap.equity)
        size = min(
            requested_size_usd,
            kelly_size,
            settings.max_position_usd,
            available * 0.9,  # keep 10% buffer
        )
        if size < settings.min_trade_usd:
            reason = f"Sized-down trade ${size:.2f} below minimum ${settings.min_trade_usd}"
            logger.debug("RISK BLOCK: %s | kelly_size=%.2f price=%.3f equity=%.2f",
                         reason, kelly_size, price, snap.equity)
            return RiskCheckResult(False, reason)

        logger.debug("RISK OK: price=%.3f size=%.2f (kelly=%.2f, balance=%.2f)",
                     price, size, kelly_size, available)
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
        Kelly sizing for a Polymarket binary position.

        Pay `p` per share. Win: receive $1 (profit = 1-p). Lose: lose p.
        We assume an 8% edge over the market price (our true win prob = p + 0.08).
        Formula: f* = q - (1-q) * p/(1-p)   where q = estimated win probability.
        Quarter-Kelly applied for safety. Floor at 0.5% equity so small edges still trade.
        """
        if p <= 0 or p >= 1:
            return 0.0
        q = min(0.95, p + 0.08)       # assume 8% edge over market
        kelly = q - (1 - q) * p / (1 - p)
        if kelly <= 0:
            return 0.0
        quarter_kelly = kelly * 0.25
        return round(max(quarter_kelly, 0.005) * equity, 2)  # floor 0.5% equity
