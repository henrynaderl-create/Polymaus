"""Market ORM model – cached market metadata."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Market(Base):
    __tablename__ = "markets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    condition_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    question: Mapped[str] = mapped_column(String, default="")
    yes_token_id: Mapped[str] = mapped_column(String, default="", index=True)
    no_token_id: Mapped[str] = mapped_column(String, default="", index=True)
    category: Mapped[str] = mapped_column(String, default="")
    end_date_iso: Mapped[str] = mapped_column(String, default="")
    yes_price: Mapped[float] = mapped_column(Float, default=0.5)
    no_price: Mapped[float] = mapped_column(Float, default=0.5)
    volume_24h: Mapped[float] = mapped_column(Float, default=0.0)
    liquidity: Mapped[float] = mapped_column(Float, default=0.0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
