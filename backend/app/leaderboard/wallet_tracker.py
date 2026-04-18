"""Real Polymarket wallet tracker.

Discovery pipeline (tried in order until addresses found):
  1. Official leaderboard API (multiple endpoint/param variants)
  2. CLOB trades for top markets (extract maker/taker addresses)
  3. Global activity feed (data-api.polymarket.com/activity)
  4. Top position holders (gamma-api.polymarket.com/positions)

Per-wallet tracking:
  - Poll each wallet's positions every WALLET_POLL_INTERVAL seconds
  - Compare current vs previous token set → delta = new trades
  - Generate copy signals for each new position
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.clients.polymarket import PolymarketClient

logger = logging.getLogger("polymaus.wallets")

WALLET_POLL_INTERVAL = 60   # seconds between wallet polls
MAX_WALLETS = 50            # max wallets to track simultaneously
LATE_ENTRY_MAX_MOVE = 0.15  # skip copy if price moved >15% from trader's avg cost


@dataclass
class TrackedWallet:
    address: str
    rank: int = 0
    profit: float = 0.0
    trust_score: float = 0.5
    current_positions: dict[str, dict] = field(default_factory=dict)  # token_id → pos
    prev_token_ids: set[str] = field(default_factory=set)
    copy_count: int = 0
    last_polled_ts: float = 0.0
    last_action: str = ""
    last_market: str = ""


class WalletTracker:
    """Discovers and actively tracks top Polymarket trader wallets."""

    DISCOVERY_INTERVAL = 900.0  # re-run discovery every 15 min

    def __init__(self, client: "PolymarketClient") -> None:
        self._client = client
        self._wallets: dict[str, TrackedWallet] = {}
        self._last_discovery_ts: float = 0.0
        self._copy_history: list[dict] = []

    # ── Public API ────────────────────────────────────────────────────────

    async def refresh(self, markets: list[dict] | None = None) -> None:
        """Discover wallets if needed, then poll all tracked wallets."""
        now = time.time()
        needs_discovery = (
            not self._wallets
            or now - self._last_discovery_ts > self.DISCOVERY_INTERVAL
        )
        if needs_discovery:
            await self._discover_wallets(markets or [])
            self._last_discovery_ts = now
        if self._wallets:
            await self._poll_wallets()

    async def detect_new_entries(
        self,
        markets: list[dict],
        prices: dict[str, float],
    ) -> list[dict]:
        """
        Return copy signals for new positions detected since last poll.

        Each signal dict contains:
          token_id, market_id, question, outcome, price,
          confidence, trader_address, trader_rank, trust_score, reason
        """
        signals: list[dict] = []
        seen: set[str] = set()

        for addr, wallet in self._wallets.items():
            new_ids = set(wallet.current_positions.keys()) - wallet.prev_token_ids
            if not new_ids:
                continue

            logger.info("[COPY] %s: %d new position(s) detected", addr[:10], len(new_ids))

            for token_id in new_ids:
                if token_id in seen:
                    continue

                market = _find_market(token_id, markets)
                if not market:
                    logger.debug("[COPY] token %s not found in tracked markets", token_id[:8])
                    continue

                outcome = "YES" if market.get("yes_token_id") == token_id else "NO"

                price = prices.get(token_id)
                if price is None:
                    price_key = "yes_price" if outcome == "YES" else "no_price"
                    price = float(market.get(price_key) or 0.5)

                # Skip near-resolution prices
                if price < 0.03 or price > 0.95:
                    logger.debug("[COPY] skip %s @ %.3f (near resolution)", token_id[:8], price)
                    continue

                # Late-entry guard
                pos = wallet.current_positions[token_id]
                avg_cost = float(
                    pos.get("avgCost") or pos.get("averageCost")
                    or pos.get("avgPrice") or price
                )
                if avg_cost > 0:
                    move = abs(price - avg_cost) / avg_cost
                    if move > LATE_ENTRY_MAX_MOVE:
                        logger.info(
                            "[COPY] LATE-ENTRY SKIP %s: avg=%.3f now=%.3f move=%.1f%%",
                            token_id[:8], avg_cost, price, move * 100
                        )
                        continue

                seen.add(token_id)
                wallet.copy_count += 1
                wallet.last_action = f"BUY {outcome}"
                wallet.last_market = (market.get("question") or "")[:40]

                question = market.get("question", "")
                logger.info(
                    "[COPY] SIGNAL ✓ %s %s '%s' @ %.3f | trust=%.2f rank=%d",
                    addr[:10], outcome, question[:40],
                    price, wallet.trust_score, wallet.rank
                )

                signals.append({
                    "token_id": token_id,
                    "market_id": market.get("conditionId") or market.get("id", ""),
                    "question": question,
                    "outcome": outcome,
                    "price": price,
                    "confidence": min(0.85, wallet.trust_score),
                    "trader_address": addr,
                    "trader_rank": wallet.rank,
                    "trust_score": wallet.trust_score,
                    "reason": f"COPY {addr[:8]}… rank#{wallet.rank} trust={wallet.trust_score:.2f}",
                })

                self._copy_history.append({
                    "traderAddress": addr,
                    "traderRank": wallet.rank,
                    "trustScore": round(wallet.trust_score, 3),
                    "question": question,
                    "outcome": outcome,
                    "price": round(price, 4),
                    "size": 0,
                    "ts": int(time.time()),
                    "tokenId": token_id,
                    "marketId": market.get("conditionId", ""),
                })

        # Keep history bounded
        if len(self._copy_history) > 200:
            self._copy_history = self._copy_history[-200:]

        return signals

    def get_snapshot(self) -> list[dict]:
        """Trader list for UI (matches Trader interface)."""
        now = time.time()
        wallets = sorted(
            self._wallets.values(),
            key=lambda w: (w.trust_score, -w.rank),
            reverse=True,
        )
        return [
            {
                "rank": w.rank,
                "address": (
                    w.address[:8] + "…" + w.address[-4:]
                    if len(w.address) > 12 else w.address
                ),
                "profit": round(w.profit, 2),
                "positions": len(w.current_positions),
                "trustScore": round(w.trust_score, 3),
                "winRate": 0.0,
                "recentPnl": 0.0,
                "copyCount": w.copy_count,
                "isFollowed": True,
                "isActive": w.last_polled_ts > 0 and (now - w.last_polled_ts) < 300,
                "lastAction": w.last_action,
                "lastMarket": w.last_market,
            }
            for w in wallets[:20]
        ]

    def get_copy_history(self, n: int = 30) -> list[dict]:
        return list(reversed(self._copy_history[-n:]))

    @property
    def wallet_count(self) -> int:
        return len(self._wallets)

    @property
    def hot_tokens(self) -> dict[str, dict]:
        """Tokens held by tracked wallets (for AdaptiveStrategy)."""
        result: dict[str, dict] = {}
        for wallet in sorted(
            self._wallets.values(), key=lambda w: w.trust_score, reverse=True
        ):
            weight = 1.0 / max(wallet.rank, 1)
            for token_id, pos in wallet.current_positions.items():
                outcome = pos.get("outcome") or "YES"
                size = float(pos.get("size") or pos.get("currentValue") or 0)
                if size < 5:
                    continue
                if token_id not in result:
                    result[token_id] = {"outcome": outcome, "score": 0.0,
                                        "confidence": 0.0, "reason": ""}
                result[token_id]["score"] += weight
                result[token_id]["confidence"] = min(
                    result[token_id]["score"] / 3.0, 0.65
                )
        return result

    # ── Discovery ─────────────────────────────────────────────────────────

    async def _discover_wallets(self, markets: list[dict]) -> None:
        logger.info(
            "[WALLETS] Discovery starting. Markets available: %d. Currently tracking: %d",
            len(markets), len(self._wallets)
        )
        candidates: list[dict] = []  # each dict must have 'address' key

        # 1. Official leaderboard API
        lb = await self._try_leaderboard_api()
        if lb:
            logger.info("[WALLETS] Leaderboard API: %d entries", len(lb))
            candidates.extend(lb)

        # 2. CLOB trade history
        if len(candidates) < 10 and markets:
            clob_addrs = await self._discover_from_clob(markets)
            added = 0
            existing = {c.get("address", "") for c in candidates}
            for addr in clob_addrs:
                if addr not in existing:
                    candidates.append({"address": addr, "profit": 0.0})
                    existing.add(addr)
                    added += 1
            logger.info("[WALLETS] CLOB discovery: +%d addresses (total %d)", added, len(candidates))

        # 3. Global activity feed
        if len(candidates) < 10:
            act_addrs = await self._discover_from_activity()
            added = 0
            existing = {c.get("address", "") for c in candidates}
            for addr in act_addrs:
                if addr not in existing:
                    candidates.append({"address": addr, "profit": 0.0})
                    existing.add(addr)
                    added += 1
            logger.info("[WALLETS] Activity feed: +%d addresses (total %d)", added, len(candidates))

        # 4. Top position holders
        if len(candidates) < 5:
            pos_addrs = await self._discover_from_positions()
            added = 0
            existing = {c.get("address", "") for c in candidates}
            for addr in pos_addrs:
                if addr not in existing:
                    candidates.append({"address": addr, "profit": 0.0})
                    existing.add(addr)
                    added += 1
            logger.info("[WALLETS] Positions API: +%d addresses (total %d)", added, len(candidates))

        if not candidates:
            logger.warning(
                "[WALLETS] *** ALL DISCOVERY METHODS FAILED — no wallets found ***\n"
                "  Tried: leaderboard API, CLOB trades, activity feed, positions API\n"
                "  Copy trading will be inactive until next discovery cycle."
            )
            return

        # Register / update wallets
        for i, c in enumerate(candidates[:MAX_WALLETS]):
            addr = (
                c.get("address") or c.get("proxyWallet")
                or c.get("user") or ""
            )
            if not addr or len(addr) < 10:
                continue
            profit = float(c.get("profit") or c.get("pnl") or 0)
            rank = i + 1
            trust = max(0.30, 1.0 - i * 0.018)

            if addr in self._wallets:
                self._wallets[addr].rank = rank
                self._wallets[addr].trust_score = trust
                if profit:
                    self._wallets[addr].profit = profit
            else:
                self._wallets[addr] = TrackedWallet(
                    address=addr, rank=rank, profit=profit, trust_score=trust,
                )
                logger.info(
                    "[WALLETS] NEW wallet #%d: %s trust=%.2f profit=$%.0f",
                    rank, addr[:14], trust, profit
                )

        logger.info("[WALLETS] Discovery done — tracking %d wallets", len(self._wallets))

    async def _try_leaderboard_api(self) -> list[dict]:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, */*",
            "Referer": "https://polymarket.com/leaderboard",
            "Origin": "https://polymarket.com",
        }
        endpoints = [
            ("https://data-api.polymarket.com/leaderboard", {"window": "all",  "limit": 50}),
            ("https://data-api.polymarket.com/leaderboard", {"window": "1m",   "limit": 50}),
            ("https://data-api.polymarket.com/leaderboard", {"window": "1w",   "limit": 50}),
            ("https://data-api.polymarket.com/leaderboard", {"window": "1d",   "limit": 50}),
            ("https://gamma-api.polymarket.com/leaderboard", {"limit": 50, "timeframe": "all"}),
        ]
        for url, params in endpoints:
            try:
                resp = await self._client._http.get(
                    url, params=params, headers=headers, timeout=10.0
                )
                logger.debug("[WALLETS] Leaderboard %s → HTTP %d", url.split(".com")[1][:30], resp.status_code)
                if resp.status_code == 200:
                    data = resp.json()
                    items = (
                        data if isinstance(data, list)
                        else (
                            data.get("data") or data.get("leaderboard")
                            or data.get("results") or []
                        )
                    )
                    valid = [
                        i for i in items
                        if i.get("address") or i.get("proxyWallet") or i.get("user")
                    ]
                    if valid:
                        logger.info("[WALLETS] Leaderboard hit %s → %d traders", url, len(valid))
                        return valid
            except Exception as exc:
                logger.debug("[WALLETS] Leaderboard %s error: %s", url, exc)
        logger.warning("[WALLETS] All leaderboard API variants returned 404/empty")
        return []

    async def _discover_from_clob(self, markets: list[dict]) -> list[str]:
        """Extract active trader addresses from CLOB trade history of top markets."""
        freq: dict[str, int] = {}
        top = sorted(
            markets, key=lambda m: float(m.get("volume24hr") or 0), reverse=True
        )[:15]

        sem = asyncio.Semaphore(4)

        async def fetch_market(market: dict) -> None:
            token_id = market.get("yes_token_id", "")
            if not token_id:
                return
            async with sem:
                try:
                    resp = await self._client._http.get(
                        "https://clob.polymarket.com/trades",
                        params={"token_id": token_id, "limit": 200},
                        timeout=8.0,
                    )
                    if resp.status_code != 200:
                        return
                    raw = resp.json()
                    items = (
                        raw if isinstance(raw, list)
                        else raw.get("data") or raw.get("trades") or []
                    )
                    for t in items:
                        for field_name in (
                            "maker", "maker_address", "makerAddress",
                            "taker", "taker_address", "takerAddress",
                        ):
                            addr = t.get(field_name, "")
                            if addr and len(addr) > 10 and addr.lower().startswith("0x"):
                                freq[addr] = freq.get(addr, 0) + 1
                except Exception as exc:
                    logger.debug(
                        "[WALLETS] CLOB trades (%s): %s",
                        market.get("question", "?")[:20], exc
                    )

        await asyncio.gather(*[fetch_market(m) for m in top], return_exceptions=True)

        result = sorted(freq.items(), key=lambda x: x[1], reverse=True)
        addrs = [a for a, _ in result if freq[a] >= 1]
        logger.info("[WALLETS] CLOB: %d unique addresses across %d markets", len(addrs), len(top))
        return addrs[:50]

    async def _discover_from_activity(self) -> list[str]:
        for url in [
            "https://data-api.polymarket.com/activity",
            "https://gamma-api.polymarket.com/activity",
        ]:
            try:
                resp = await self._client._http.get(url, params={"limit": 200}, timeout=8.0)
                if resp.status_code == 200:
                    data = resp.json()
                    items = data if isinstance(data, list) else data.get("data", [])
                    addrs: list[str] = []
                    seen: set[str] = set()
                    for item in items:
                        addr = (
                            item.get("user") or item.get("proxyWallet")
                            or item.get("address") or ""
                        )
                        if addr and len(addr) > 10 and addr not in seen:
                            addrs.append(addr)
                            seen.add(addr)
                    if addrs:
                        logger.info("[WALLETS] Activity %s → %d addresses", url, len(addrs))
                        return addrs[:50]
                logger.debug("[WALLETS] Activity %s → HTTP %d", url, resp.status_code)
            except Exception as exc:
                logger.debug("[WALLETS] Activity %s error: %s", url, exc)
        return []

    async def _discover_from_positions(self) -> list[str]:
        param_sets = [
            {"sizeThreshold": "100", "limit": 200, "order": "currentValue", "ascending": "false"},
            {"sizeThreshold": "50",  "limit": 200, "order": "currentValue", "ascending": "false"},
            {"limit": 100},
        ]
        for params in param_sets:
            try:
                resp = await self._client._http.get(
                    "https://gamma-api.polymarket.com/positions",
                    params=params, timeout=10.0,
                )
                if resp.status_code == 200:
                    items = resp.json()
                    if not isinstance(items, list) or not items:
                        continue
                    by_addr: dict[str, float] = {}
                    for p in items:
                        addr = (
                            p.get("user") or p.get("proxyWallet")
                            or p.get("address") or p.get("userId") or ""
                        )
                        if not addr or len(addr) < 10:
                            continue
                        val = float(
                            p.get("currentValue") or p.get("value") or p.get("size") or 0
                        )
                        by_addr[addr] = by_addr.get(addr, 0) + val
                    if by_addr:
                        ranked = sorted(by_addr.items(), key=lambda x: x[1], reverse=True)
                        addrs = [a for a, _ in ranked[:50]]
                        logger.info("[WALLETS] Positions API → %d holders", len(addrs))
                        return addrs
                logger.debug("[WALLETS] Positions API → HTTP %d", resp.status_code)
            except Exception as exc:
                logger.debug("[WALLETS] Positions discovery error: %s", exc)
        return []

    # ── Per-wallet polling ─────────────────────────────────────────────────

    async def _poll_wallets(self) -> None:
        now = time.time()
        due = [
            w for w in self._wallets.values()
            if now - w.last_polled_ts >= WALLET_POLL_INTERVAL
        ]
        if not due:
            return
        logger.info("[WALLETS] Polling %d/%d wallets", len(due), len(self._wallets))
        sem = asyncio.Semaphore(5)
        async def poll_one(w: TrackedWallet) -> None:
            async with sem:
                await self._poll_wallet(w)
        await asyncio.gather(*[poll_one(w) for w in due], return_exceptions=True)

    async def _poll_wallet(self, wallet: TrackedWallet) -> None:
        positions = await self._fetch_positions(wallet.address)
        wallet.prev_token_ids = set(wallet.current_positions.keys())
        new_pos: dict[str, dict] = {}
        for pos in positions:
            tid = (
                pos.get("tokenId") or pos.get("asset")
                or pos.get("token_id") or ""
            )
            if tid:
                new_pos[tid] = pos
        wallet.current_positions = new_pos
        wallet.last_polled_ts = time.time()

        delta = len(set(new_pos.keys()) - wallet.prev_token_ids)
        if delta:
            logger.info(
                "[WALLET] %s: %d NEW position(s) | total=%d",
                wallet.address[:10], delta, len(new_pos)
            )
        else:
            logger.debug("[WALLET] %s: %d positions (unchanged)", wallet.address[:10], len(new_pos))

    async def _fetch_positions(self, address: str) -> list[dict]:
        sources = [
            ("https://data-api.polymarket.com/positions",  {"user": address}),
            ("https://gamma-api.polymarket.com/positions", {"user": address, "sizeThreshold": "0.01"}),
        ]
        for url, params in sources:
            try:
                resp = await self._client._http.get(url, params=params, timeout=8.0)
                if resp.status_code == 200:
                    data = resp.json()
                    result = data if isinstance(data, list) else data.get("data")
                    if result is not None:
                        logger.debug(
                            "[WALLET] %s @ %s: %d positions",
                            address[:10], url.split(".com")[0].split("//")[-1], len(result)
                        )
                        return result
            except Exception as exc:
                logger.debug("[WALLET] %s positions (%s): %s", address[:10], url, exc)

        # Fallback: activity feed as position proxy
        try:
            resp = await self._client._http.get(
                "https://data-api.polymarket.com/activity",
                params={"user": address, "limit": 50},
                timeout=8.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                items = data if isinstance(data, list) else data.get("data", [])
                positions: list[dict] = []
                for item in items:
                    side = (item.get("side") or item.get("type") or "").upper()
                    if side in ("BUY", ""):
                        tid = (
                            item.get("tokenId") or item.get("asset")
                            or item.get("token_id") or ""
                        )
                        if tid:
                            positions.append({
                                "tokenId": tid,
                                "outcome": item.get("outcome") or "YES",
                                "size": item.get("size") or item.get("amount") or 1,
                            })
                logger.debug("[WALLET] %s activity fallback: %d items", address[:10], len(positions))
                return positions
        except Exception:
            pass

        return []


def _find_market(token_id: str, markets: list[dict]) -> dict | None:
    for m in markets:
        if m.get("yes_token_id") == token_id or m.get("no_token_id") == token_id:
            return m
    return None
