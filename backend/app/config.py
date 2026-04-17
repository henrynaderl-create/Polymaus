"""Central configuration via Pydantic Settings – reads .env or env vars."""
from __future__ import annotations

from enum import Enum
from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class BotMode(str, Enum):
    DEMO = "demo"
    LIVE = "live"


class StrategyName(str, Enum):
    CONTRARIAN = "contrarian"
    MARKET_MAKER = "market_maker"
    SIGNAL = "signal"
    ADAPTIVE = "adaptive"
    MOMENTUM = "momentum"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # ── Bot Mode ──────────────────────────────────────────────
    bot_mode: BotMode = BotMode.DEMO
    live_trading_enabled: bool = False
    dry_run: bool = True

    # ── Polymarket Credentials ────────────────────────────────
    poly_private_key: str = ""
    poly_api_key: str = ""
    poly_api_secret: str = ""
    poly_api_passphrase: str = ""
    poly_funder_address: str = ""

    # ── API Endpoints ─────────────────────────────────────────
    clob_url: str = "https://clob.polymarket.com"
    gamma_url: str = "https://gamma-api.polymarket.com"
    chain_id: int = 137

    # ── Database ──────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./polymaus.db"

    # ── Risk Controls ─────────────────────────────────────────
    max_position_usd: float = 15.0
    max_daily_loss_usd: float = 75.0
    max_open_positions: int = 30
    portfolio_alloc_pct: float = 0.001
    min_trade_usd: float = 1.0
    max_entry_price: float = 0.92

    # ── Strategy Parameters ───────────────────────────────────
    default_strategy: StrategyName = StrategyName.MOMENTUM
    market_refresh_secs: int = 300
    price_poll_secs: int = 15
    mm_spread_bps: int = 200
    signal_consensus_required: int = 2

    # ── Demo Mode ─────────────────────────────────────────────
    demo_starting_balance: float = 10_000.0
    demo_slippage_bps: int = 10

    # ── Server ────────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000

    @property
    def is_live_trading(self) -> bool:
        """All three conditions must be satisfied for real orders."""
        return (
            self.bot_mode == BotMode.LIVE
            and self.live_trading_enabled
            and not self.dry_run
        )

    @field_validator("poly_private_key")
    @classmethod
    def _validate_key(cls, v: str) -> str:
        if v and not v.startswith("0x"):
            return "0x" + v
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
