"""Lightweight CoinGecko price feed for BTC signal strategy."""
from __future__ import annotations

import httpx

TIMEOUT = httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=5.0)


class CoinGeckoClient:
    BASE = "https://api.coingecko.com/api/v3"

    def __init__(self) -> None:
        self._http = httpx.AsyncClient(timeout=TIMEOUT)

    async def get_btc_price(self) -> float:
        resp = await self._http.get(
            f"{self.BASE}/simple/price",
            params={"ids": "bitcoin", "vs_currencies": "usd"},
        )
        resp.raise_for_status()
        return float(resp.json()["bitcoin"]["usd"])

    async def get_btc_ohlc(self, days: int = 1) -> list[dict]:
        """Returns [{t, o, h, l, c}, …] in 15-min buckets."""
        resp = await self._http.get(
            f"{self.BASE}/coins/bitcoin/ohlc",
            params={"vs_currency": "usd", "days": days},
        )
        resp.raise_for_status()
        raw = resp.json()
        return [
            {"t": int(r[0] / 1000), "o": r[1], "h": r[2], "l": r[3], "c": r[4]}
            for r in raw
        ]

    async def close(self) -> None:
        await self._http.aclose()
