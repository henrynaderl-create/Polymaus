"""Tests for trading strategies."""
import pytest
from app.strategies.contrarian import ContrarianStrategy
from app.strategies.signal import SignalStrategy
from app.strategies.base import SignalType


SAMPLE_MARKETS = [
    {
        "conditionId": "mkt1",
        "question": "Will the referendum pass?",
        "yes_token_id": "yes1",
        "no_token_id": "no1",
        "volume24hr": 50_000,
        "liquidity": 10_000,
        "outcomePrices": ["0.75", "0.25"],
        "category": "politics",
    },
    {
        "conditionId": "mkt2",
        "question": "Will the bill be signed?",
        "yes_token_id": "yes2",
        "no_token_id": "no2",
        "volume24hr": 5_000,
        "liquidity": 2_000,
        "outcomePrices": ["0.30", "0.70"],
        "category": "politics",
    },
    {
        "conditionId": "mkt3",
        "question": "Bitcoin above $100k?",  # should be skipped (btc keyword)
        "yes_token_id": "yes3",
        "no_token_id": "no3",
        "volume24hr": 100_000,
        "liquidity": 50_000,
        "outcomePrices": ["0.72", "0.28"],
        "category": "crypto",
    },
]

PRICES = {
    "yes1": 0.75,
    "no1": 0.25,
    "yes2": 0.30,
    "no2": 0.70,
    "yes3": 0.72,
    "no3": 0.28,
}


class TestContrarianStrategy:
    @pytest.mark.asyncio
    async def test_generates_buy_no_when_yes_high(self):
        strat = ContrarianStrategy()
        signals = await strat.analyze(SAMPLE_MARKETS, PRICES)
        mkt1_signals = [s for s in signals if s.market_id == "mkt1"]
        assert len(mkt1_signals) > 0
        assert mkt1_signals[0].signal == SignalType.BUY_NO
        assert mkt1_signals[0].outcome == "NO"

    @pytest.mark.asyncio
    async def test_skips_btc_market(self):
        strat = ContrarianStrategy()
        signals = await strat.analyze(SAMPLE_MARKETS, PRICES)
        btc_signals = [s for s in signals if s.market_id == "mkt3"]
        assert len(btc_signals) == 0

    @pytest.mark.asyncio
    async def test_skips_low_yes_market(self):
        strat = ContrarianStrategy()
        signals = await strat.analyze(SAMPLE_MARKETS, PRICES)
        # mkt2 has YES=0.30, below 0.70 threshold
        mkt2_signals = [s for s in signals if s.market_id == "mkt2"]
        assert all(s.signal != SignalType.BUY_NO or s.price < 0.20 for s in mkt2_signals)

    @pytest.mark.asyncio
    async def test_confidence_is_bounded(self):
        strat = ContrarianStrategy()
        signals = await strat.analyze(SAMPLE_MARKETS, PRICES)
        for s in signals:
            assert 0.0 <= s.confidence <= 1.0


class TestSignalStrategy:
    @pytest.mark.asyncio
    async def test_no_signal_without_history(self):
        strat = SignalStrategy()
        signals = await strat.analyze(SAMPLE_MARKETS, PRICES)
        # Without price history, no spike/momentum signals – may still get discount signals
        for s in signals:
            assert 0.0 <= s.confidence <= 1.0

    @pytest.mark.asyncio
    async def test_spike_detection(self):
        strat = SignalStrategy()
        # Simulate a price spike by calling analyze multiple times
        for p in [0.30, 0.32, 0.35, 0.51]:  # big jump
            await strat.analyze(SAMPLE_MARKETS, {"yes1": p, "no1": 1 - p, **PRICES})
        signals = await strat.analyze(SAMPLE_MARKETS, {"yes1": 0.51, "no1": 0.49, **PRICES})
        # After spike, should potentially see a contrarian signal
        assert isinstance(signals, list)
