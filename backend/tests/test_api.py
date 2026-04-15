"""Integration tests for FastAPI endpoints."""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


class TestAPI:
    @pytest.mark.asyncio
    async def test_status_endpoint(self, client):
        r = await client.get("/api/v1/status")
        assert r.status_code == 200
        data = r.json()
        assert "running" in data
        assert "portfolio" in data
        assert "mode" in data

    @pytest.mark.asyncio
    async def test_portfolio_endpoint(self, client):
        r = await client.get("/api/v1/portfolio")
        assert r.status_code == 200
        data = r.json()
        assert "balance" in data
        assert "equity" in data
        assert "winRate" in data

    @pytest.mark.asyncio
    async def test_config_endpoint(self, client):
        r = await client.get("/api/v1/config")
        assert r.status_code == 200
        data = r.json()
        assert "mode" in data
        assert data["mode"] == "demo"

    @pytest.mark.asyncio
    async def test_set_strategy(self, client):
        r = await client.post("/api/v1/strategy", json={"strategy": "contrarian"})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_invalid_strategy(self, client):
        r = await client.post("/api/v1/strategy", json={"strategy": "nonexistent"})
        assert r.status_code == 400
