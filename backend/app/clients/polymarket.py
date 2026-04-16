"""Polymarket REST + WebSocket client.

Wraps both:
  - Gamma API  (https://gamma-api.polymarket.com) – market metadata, leaderboard
  - CLOB API   (https://clob.polymarket.com)       – order books, order placement
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass, field
from typing import Any

import httpx
from eth_account import Account
from eth_account.messages import encode_defunct

from app.config import get_settings

settings = get_settings()

TIMEOUT = httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)


@dataclass
class OrderBook:
    token_id: str
    bids: list[dict] = field(default_factory=list)   # [{price, size}, …]
    asks: list[dict] = field(default_factory=list)
    best_bid: float = 0.0
    best_ask: float = 0.0
    mid: float = 0.0
    spread: float = 0.0

    @classmethod
    def from_raw(cls, token_id: str, raw: dict) -> "OrderBook":
        bids = sorted(
            [{"price": float(b["price"]), "size": float(b["size"])} for b in raw.get("bids", [])],
            key=lambda x: x["price"],
            reverse=True,
        )
        asks = sorted(
            [{"price": float(a["price"]), "size": float(a["size"])} for a in raw.get("asks", [])],
            key=lambda x: x["price"],
        )
        best_bid = bids[0]["price"] if bids else 0.0
        best_ask = asks[0]["price"] if asks else 1.0
        mid = (best_bid + best_ask) / 2 if bids and asks else 0.5
        spread = best_ask - best_bid
        return cls(token_id=token_id, bids=bids, asks=asks,
                   best_bid=best_bid, best_ask=best_ask, mid=mid, spread=spread)


class PolymarketClient:
    """Async HTTP client for Polymarket APIs."""

    def __init__(self) -> None:
        self._http = httpx.AsyncClient(timeout=TIMEOUT)
        raw_key = settings.poly_private_key or ""
        _valid_key = raw_key.startswith("0x") and len(raw_key) == 66
        self._account = Account.from_key(raw_key) if _valid_key else None

    # ── Gamma API ─────────────────────────────────────────────────────────

    async def get_markets(
        self,
        active: bool = True,
        limit: int = 100,
        offset: int = 0,
        min_volume: float = 1000.0,
    ) -> list[dict]:
        params = {
            "active": str(active).lower(),
            "limit": limit,
            "offset": offset,
            "order": "volume24hr",
            "ascending": "false",
        }
        resp = await self._http.get(f"{settings.gamma_url}/markets", params=params)
        resp.raise_for_status()
        data = resp.json()
        markets = data if isinstance(data, list) else data.get("markets", [])
        filtered = [m for m in markets if float(m.get("volume24hr", 0) or 0) >= min_volume]
        return [self._normalize_market(m) for m in filtered]

    @staticmethod
    def _normalize_market(m: dict) -> dict:
        """Normalize Gamma API response: extract token IDs and prices into standard fields."""
        import json as _json

        # ── Token IDs ──────────────────────────────────────────────────────
        clob_ids = m.get("clobTokenIds") or []
        if isinstance(clob_ids, str):
            try:
                clob_ids = _json.loads(clob_ids)
            except Exception:
                clob_ids = []

        if not m.get("yes_token_id") and len(clob_ids) >= 1:
            m["yes_token_id"] = clob_ids[0]
        if not m.get("no_token_id") and len(clob_ids) >= 2:
            m["no_token_id"] = clob_ids[1]

        # ── Prices ────────────────────────────────────────────────────────
        outcome_prices = m.get("outcomePrices") or []
        if isinstance(outcome_prices, str):
            try:
                outcome_prices = _json.loads(outcome_prices)
            except Exception:
                outcome_prices = []

        if len(outcome_prices) >= 2:
            try:
                m["yes_price"] = float(outcome_prices[0])
                m["no_price"] = float(outcome_prices[1])
            except (ValueError, TypeError):
                pass
        elif len(outcome_prices) == 1:
            try:
                m["yes_price"] = float(outcome_prices[0])
                m["no_price"] = round(1.0 - m["yes_price"], 4)
            except (ValueError, TypeError):
                pass

        return m

    async def get_market(self, condition_id: str) -> dict:
        resp = await self._http.get(f"{settings.gamma_url}/markets/{condition_id}")
        resp.raise_for_status()
        return resp.json()

    async def get_leaderboard(self, limit: int = 50) -> list[dict]:
        """Fetch top traders by P&L. Falls back to synthetic if all APIs fail."""
        endpoints = [
            ("https://data-api.polymarket.com/leaderboard", {"window": "all", "limit": limit}),
            ("https://data-api.polymarket.com/leaderboard", {"window": "1m", "limit": limit}),
            ("https://data-api.polymarket.com/leaderboard", {"window": "1w", "limit": limit}),
            (f"{settings.gamma_url}/leaderboard", {"limit": limit, "timeframe": "all"}),
            ("https://data-api.polymarket.com/rankings", {"window": "all", "limit": limit}),
        ]
        for url, params in endpoints:
            try:
                resp = await self._http.get(url, params=params, timeout=8.0)
                if resp.status_code == 200:
                    data = resp.json()
                    result = (
                        data if isinstance(data, list)
                        else data.get("data") or data.get("leaderboard") or data.get("results") or []
                    )
                    if result:
                        return result[:limit]
            except Exception:
                pass
        return await self._synthetic_leaderboard(limit)

    async def _synthetic_leaderboard(self, limit: int = 50) -> list[dict]:
        """Synthesize a leaderboard from the largest active position holders."""
        try:
            resp = await self._http.get(
                f"{settings.gamma_url}/positions",
                params={
                    "sizeThreshold": "50",
                    "order": "currentValue",
                    "ascending": "false",
                    "limit": 200,
                },
                timeout=10.0,
            )
            if resp.status_code == 200:
                positions = resp.json()
                if isinstance(positions, list):
                    by_user: dict[str, dict] = {}
                    for p in positions:
                        addr = (
                            p.get("user") or p.get("proxyWallet")
                            or p.get("address") or ""
                        )
                        if not addr or len(addr) < 10:
                            continue
                        if addr not in by_user:
                            by_user[addr] = {
                                "address": addr,
                                "profit": 0.0,
                                "positions": 0,
                                "winRate": 0.0,
                            }
                        val = float(p.get("currentValue") or p.get("value") or 0)
                        by_user[addr]["profit"] += val
                        by_user[addr]["positions"] += 1
                    ranked = sorted(
                        by_user.values(), key=lambda x: x["profit"], reverse=True
                    )
                    return ranked[:limit]
        except Exception as exc:
            import logging
            logging.getLogger("polymaus.client").warning(
                "Synthetic leaderboard failed: %s", exc
            )
        return []

    async def get_trader_positions(self, address: str) -> list[dict]:
        """Get open positions for a trader address."""
        try:
            resp = await self._http.get(
                f"{settings.gamma_url}/positions",
                params={"user": address, "sizeThreshold": "0.01"},
            )
            if resp.status_code == 200:
                data = resp.json()
                return data if isinstance(data, list) else []
        except Exception:
            pass
        return []

    # ── CLOB API ──────────────────────────────────────────────────────────

    async def get_order_book(self, token_id: str) -> OrderBook:
        resp = await self._http.get(
            f"{settings.clob_url}/order-book/{token_id}",
        )
        if resp.status_code != 200:
            # retry with smaller depth
            resp = await self._http.get(
                f"{settings.clob_url}/book",
                params={"token_id": token_id},
            )
        resp.raise_for_status()
        return OrderBook.from_raw(token_id, resp.json())

    async def get_price(self, token_id: str, side: str = "buy") -> float:
        """Get best price for a token. side = 'buy' | 'sell'."""
        try:
            resp = await self._http.get(
                f"{settings.clob_url}/price",
                params={"token_id": token_id, "side": side},
            )
            if resp.status_code == 200:
                return float(resp.json().get("price", 0.5))
        except Exception:
            pass
        book = await self.get_order_book(token_id)
        return book.best_ask if side == "buy" else book.best_bid

    async def get_prices_history(
        self, token_id: str, interval: str = "1d", fidelity: int = 60
    ) -> list[dict]:
        """Returns [{t: timestamp, p: price}, …]."""
        try:
            resp = await self._http.get(
                f"{settings.clob_url}/prices-history",
                params={"market": token_id, "interval": interval, "fidelity": fidelity},
            )
            if resp.status_code == 200:
                return resp.json().get("history", [])
        except Exception:
            pass
        return []

    async def get_my_orders(self) -> list[dict]:
        headers = self._auth_headers("GET", "/orders")
        resp = await self._http.get(f"{settings.clob_url}/orders", headers=headers)
        resp.raise_for_status()
        return resp.json()

    async def get_my_trades(self) -> list[dict]:
        headers = self._auth_headers("GET", "/trades")
        resp = await self._http.get(f"{settings.clob_url}/trades", headers=headers)
        resp.raise_for_status()
        return resp.json()

    async def place_order(
        self,
        token_id: str,
        side: str,  # "BUY" | "SELL"
        price: float,
        size: float,
        order_type: str = "GTC",
    ) -> dict:
        """Place a limit order on the CLOB."""
        if not settings.is_live_trading:
            raise RuntimeError("Live trading not enabled – use DemoEngine instead")

        body = {
            "tokenID": token_id,
            "price": round(price, 4),
            "side": side.upper(),
            "size": round(size, 2),
            "type": order_type,
            "funder": settings.poly_funder_address,
            "expiration": 0,
        }
        body["signature"] = self._sign_order(body)
        headers = self._auth_headers("POST", "/order", body=json.dumps(body))
        resp = await self._http.post(
            f"{settings.clob_url}/order", json=body, headers=headers
        )
        resp.raise_for_status()
        return resp.json()

    async def cancel_order(self, order_id: str) -> dict:
        headers = self._auth_headers("DELETE", f"/order/{order_id}")
        resp = await self._http.delete(
            f"{settings.clob_url}/order/{order_id}", headers=headers
        )
        resp.raise_for_status()
        return resp.json()

    async def get_collateral_balance(self) -> float:
        headers = self._auth_headers("GET", "/balance-allowance")
        try:
            resp = await self._http.get(
                f"{settings.clob_url}/balance-allowance",
                params={"asset_type": "USDC"},
                headers=headers,
            )
            if resp.status_code == 200:
                return float(resp.json().get("balance", 0))
        except Exception:
            pass
        return 0.0

    async def close(self) -> None:
        await self._http.aclose()

    # ── Auth helpers ──────────────────────────────────────────────────────

    def _auth_headers(
        self, method: str, path: str, body: str = ""
    ) -> dict[str, str]:
        if not self._account:
            return {}
        ts = str(int(time.time()))
        msg = ts + method.upper() + path + body
        signature = self._account.sign_message(
            encode_defunct(text=msg)
        ).signature.hex()
        return {
            "POLY_ADDRESS": self._account.address,
            "POLY_SIGNATURE": "0x" + signature,
            "POLY_TIMESTAMP": ts,
            "POLY_NONCE": "0",
        }

    def _sign_order(self, order: dict) -> str:
        if not self._account:
            return ""
        msg = json.dumps(order, sort_keys=True)
        signed = self._account.sign_message(encode_defunct(text=msg))
        return "0x" + signed.signature.hex()
