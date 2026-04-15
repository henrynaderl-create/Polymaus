"""REST API endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1")


def get_bot(request: Request):
    return request.app.state.bot


# ── Status & control ──────────────────────────────────────────────────────

@router.get("/status")
async def get_status(bot=Depends(get_bot)):
    return bot.get_status()


@router.post("/start")
async def start_bot(request: Request, bot=Depends(get_bot)):
    import asyncio
    if not bot.is_running():
        asyncio.create_task(bot.start())
    return {"ok": True, "running": True}


@router.post("/stop")
async def stop_bot(bot=Depends(get_bot)):
    await bot.stop()
    return {"ok": True, "running": False}


class StrategyRequest(BaseModel):
    strategy: str


@router.post("/strategy")
async def set_strategy(body: StrategyRequest, bot=Depends(get_bot)):
    ok = bot.set_strategy(body.strategy)
    if not ok:
        raise HTTPException(400, f"Unknown strategy '{body.strategy}'")
    return {"ok": True, "strategy": body.strategy}


# ── Portfolio ────────────────────────────────────────────────────────────

@router.get("/portfolio")
async def get_portfolio(bot=Depends(get_bot)):
    return bot.portfolio.snapshot().to_dict()


@router.get("/positions")
async def get_positions(bot=Depends(get_bot)):
    return bot.portfolio.get_positions()


@router.get("/trades")
async def get_trades(n: int = 50, bot=Depends(get_bot)):
    return bot.portfolio.get_recent_trades(n)


# ── Market data ──────────────────────────────────────────────────────────

@router.get("/markets")
async def get_markets(bot=Depends(get_bot)):
    return bot.get_status().get("markets", [])


@router.get("/signals")
async def get_signals(bot=Depends(get_bot)):
    return bot._last_signals


# ── Leaderboard ───────────────────────────────────────────────────────────

@router.get("/leaderboard")
async def get_leaderboard(bot=Depends(get_bot)):
    return {
        "leaders": bot.leaderboard.get_leaders_snapshot(),
        "hotTokens": len(bot.leaderboard.hot_tokens),
        "rawSnapshot": bot.leaderboard.get_raw_snapshot()[:10],
    }


# ── Config ────────────────────────────────────────────────────────────────

@router.get("/config")
async def get_config():
    from app.config import get_settings
    s = get_settings()
    return {
        "mode": s.bot_mode.value,
        "isLive": s.is_live_trading,
        "strategy": s.default_strategy.value,
        "maxPositionUsd": s.max_position_usd,
        "maxDailyLossUsd": s.max_daily_loss_usd,
        "maxOpenPositions": s.max_open_positions,
        "portfolioAllocPct": s.portfolio_alloc_pct,
        "minTradeUsd": s.min_trade_usd,
        "maxEntryPrice": s.max_entry_price,
        "demoStartingBalance": s.demo_starting_balance,
    }


# ── Price history for charts ─────────────────────────────────────────────

@router.get("/price-history/{token_id}")
async def get_price_history(token_id: str, interval: str = "1d", bot=Depends(get_bot)):
    try:
        history = await bot.client.get_prices_history(token_id, interval)
        return history
    except Exception as exc:
        raise HTTPException(500, str(exc))
