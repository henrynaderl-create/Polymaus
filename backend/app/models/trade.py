"""Trade ORM model – one record per executed fill."""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TradeSide(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class TradeOutcome(str, enum.Enum):
    YES = "YES"
    NO = "NO"


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    market_id: Mapped[str] = mapped_column(String, index=True)
    market_question: Mapped[str] = mapped_column(String, default="")
    token_id: Mapped[str] = mapped_column(String, index=True)
    outcome: Mapped[str] = mapped_column(String)          # YES / NO
    side: Mapped[str] = mapped_column(String)              # BUY / SELL
    price: Mapped[float] = mapped_column(Float)            # 0.0 – 1.0
    size: Mapped[float] = mapped_column(Float)             # USDC amount
    shares: Mapped[float] = mapped_column(Float, default=0.0)
    strategy: Mapped[str] = mapped_column(String, default="")
    order_id: Mapped[str] = mapped_column(String, default="", index=True)
    is_demo: Mapped[bool] = mapped_column(default=True)
    pnl: Mapped[float] = mapped_column(Float, default=0.0)  # realised on close
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), index=True
    )
