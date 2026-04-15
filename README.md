# 🐭 Polymaus — High-Performance Polymarket Trading Bot

> A production-grade automated trading system for Polymarket prediction markets.
> Built with FastAPI, React, and real-time WebSocket streaming.

---

## Architecture

```
Polymaus/
├── backend/          Python + FastAPI trading engine
│   ├── app/
│   │   ├── clients/      Polymarket CLOB + Gamma API clients
│   │   ├── strategies/   4 trading strategies
│   │   ├── engine/       Bot orchestrator, risk, demo, portfolio
│   │   ├── leaderboard/  Top-trader scraping & hot-token detection
│   │   └── api/          REST + WebSocket endpoints
│   └── tests/            Pytest test suite
└── frontend/         React + TypeScript + Tailwind dashboard
    └── src/
        ├── components/   Modular card UI
        ├── hooks/        WebSocket + state management
        └── services/     API client
```

## Strategies

| Strategy | Edge | Source Inspiration |
|----------|------|-------------------|
| **Contrarian** | Buy NO when YES > 70%; most predicted rare events don't happen | `nothing-ever-happens` |
| **Market Maker** | Two-sided spread capture with volatility-adjusted widening | `poly-maker` |
| **Signal Fusion** | Spike detection + momentum reversal + category discount; trades only on 2+ signal consensus | `BTC-15-min` |
| **Adaptive** | Mirror positions of top leaderboard traders with price discount | Original |

## Risk Controls

- **Kelly Criterion** position sizing (¼ Kelly for safety)
- Per-position USD cap (`MAX_POSITION_USD=50`)
- Daily loss limit (`MAX_DAILY_LOSS_USD=200`)
- Max concurrent positions (`MAX_OPEN_POSITIONS=20`)
- Automatic stop-loss at –30%, take-profit at +40%
- 3-condition live trading gate: `BOT_MODE=live` + `LIVE_TRADING_ENABLED=true` + `DRY_RUN=false`

## Quick Start — Demo Mode

```bash
# 1. Clone and configure
cp .env.example .env          # defaults to DEMO mode

# 2. Start with Docker Compose
docker compose up -d

# 3. Open dashboard
open http://localhost:3000
```

## Local Development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

## Run Tests

```bash
cd backend
pytest -v
```

## Dashboard Features

- **Portfolio card**: equity, P&L, win rate, daily stats
- **P&L chart**: cumulative return over all closed trades
- **Open positions**: unrealised P&L, entry vs current price
- **Live trades feed**: real-time buy/sell stream via WebSocket
- **Market scanner**: top 20 markets with YES probability bars
- **Signal cards**: active strategy signals with confidence scores
- **Leaderboard**: top Polymarket traders + hot-token tracker
- **Bot controls**: start/stop, strategy selector, mode indicator
- **Fully responsive** — works on iPhone

## Transitioning to Live Trading

1. Create a Polymarket account and get API credentials
2. Set in `.env`:
   ```
   BOT_MODE=live
   LIVE_TRADING_ENABLED=true
   DRY_RUN=false
   POLY_PRIVATE_KEY=0x...
   POLY_API_KEY=...
   ```
3. Start with small `MAX_POSITION_USD=5` and monitor for 24h
4. Increase limits gradually as you validate strategy performance

## Disclaimer

This software is for educational and research purposes. Prediction market trading
involves substantial risk of loss. Past demo performance does not guarantee live results.
Never risk more than you can afford to lose.
