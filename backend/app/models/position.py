"""Position ORM model – aggregated view per market/outcome."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    market_id: Mapped[str] = mapped_column(String, index=True)
    market_question: Mapped[str] = mapped_column(String, default="")
    token_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    outcome: Mapped[str] = mapped_column(String)
    shares: Mapped[float] = mapped_column(Float, default=0.0)
    avg_cost: Mapped[float] = mapped_column(Float, default=0.0)
    current_price: Mapped[float] = mapped_column(Float, default=0.0)
    unrealised_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    realised_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    strategy: Mapped[str] = mapped_column(String, default="")
    is_demo: Mapped[bool] = mapped_column(default=True)
    opened_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
