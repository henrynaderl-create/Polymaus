"""Tests for the risk engine."""
import pytest
from app.engine.portfolio import Portfolio
from app.engine.risk import RiskEngine


@pytest.fixture
def portfolio():
    return Portfolio(starting_balance=10_000.0, is_demo=True)


@pytest.fixture
def risk(portfolio):
    return RiskEngine(portfolio)


class TestRiskEngine:
    def test_price_too_high_rejected(self, risk):
        result = risk.check_entry(price=0.80, requested_size_usd=100, token_id="tok1")
        assert not result.allowed
        assert "Price" in result.reason

    def test_price_too_low_rejected(self, risk):
        result = risk.check_entry(price=0.01, requested_size_usd=100, token_id="tok1")
        assert not result.allowed

    def test_valid_price_allowed(self, risk):
        result = risk.check_entry(price=0.30, requested_size_usd=100, token_id="tok1")
        assert result.allowed
        assert result.recommended_size > 0

    def test_kelly_sizing(self, risk):
        # At price=0.3 on a $10k portfolio, recommended size should be meaningful
        result = risk.check_entry(price=0.30, requested_size_usd=500, token_id="tok1")
        assert result.allowed
        # Kelly at 0.3 on $10k: f* = 0.3 - 0.7/2.33 = 0.3 - 0.3 ≈ 0 ... quarter Kelly
        # but we cap at max_position_usd=50
        assert result.recommended_size <= 50.0

    def test_stop_loss_triggers(self, risk, portfolio):
        portfolio.positions["tok1"] = {
            "avg_cost": 0.50,
            "current_price": 0.30,
            "shares": 100,
            "unrealised_pnl": -20,
        }
        should_exit, reason = risk.check_exit("tok1", 0.30)
        assert should_exit
        assert "stop_loss" in reason

    def test_take_profit_triggers(self, risk, portfolio):
        portfolio.positions["tok1"] = {
            "avg_cost": 0.30,
            "current_price": 0.50,
            "shares": 100,
            "unrealised_pnl": 20,
        }
        should_exit, reason = risk.check_exit("tok1", 0.50)
        assert should_exit
        assert "take_profit" in reason

    def test_hold_position(self, risk, portfolio):
        portfolio.positions["tok1"] = {
            "avg_cost": 0.40,
            "current_price": 0.42,
            "shares": 100,
            "unrealised_pnl": 2,
        }
        should_exit, reason = risk.check_exit("tok1", 0.42)
        assert not should_exit


class TestPortfolio:
    @pytest.mark.asyncio
    async def test_open_close_position(self, portfolio):
        await portfolio.open_position(
            token_id="tok1",
            outcome="NO",
            question="Will X happen?",
            price=0.25,
            size_usd=100.0,
            strategy="contrarian",
            market_id="mkt1",
        )
        assert "tok1" in portfolio.positions
        assert portfolio.balance == pytest.approx(9_900.0)

        trade = await portfolio.close_position("tok1", close_price=0.40)
        assert trade is not None
        assert "tok1" not in portfolio.positions
        # Bought 400 shares @ 0.25, sold @ 0.40: PnL = 400*(0.40-0.25) = $60
        assert trade["pnl"] == pytest.approx(60.0, abs=0.5)
