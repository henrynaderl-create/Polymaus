"""FastAPI application entry point."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.api.router import router
from app.api.ws import manager, ws_router
from app.config import get_settings
from app.database import init_db
from app.engine.bot import BotOrchestrator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("polymaus")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    bot = BotOrchestrator()
    bot.set_broadcast(manager.broadcast)
    app.state.bot = bot

    # Auto-start bot
    task = asyncio.create_task(bot.start())
    app.state.bot_task = task
    logger.info("Polymaus bot started in %s mode", settings.bot_mode.value.upper())

    yield

    # Shutdown
    await bot.stop()
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    logger.info("Polymaus bot stopped.")


app = FastAPI(
    title="Polymaus – Polymarket Trading Bot",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS – allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(ws_router)

# Serve React build in production
static_dir = "/app/frontend/dist"
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level="info",
    )
