import type { BotStatus, Trader, CopyTrade, MarketEdge } from '@/types';

const BASE = '/api/v1';

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!r.ok) throw new Error(`API ${path} → ${r.status}`);
  return r.json();
}

export const api = {
  getStatus: () => req<BotStatus>('/status'),
  startBot:  () => req<{ ok: boolean }>('/start', { method: 'POST' }),
  stopBot:   () => req<{ ok: boolean }>('/stop',  { method: 'POST' }),
  setStrategy: (strategy: string) =>
    req<{ ok: boolean }>('/strategy', {
      method: 'POST',
      body: JSON.stringify({ strategy }),
    }),
  getLeaderboard: () =>
    req<{ leaders: any[]; hotTokens: number }>('/leaderboard'),
  getTraders: () =>
    req<{ traders: Trader[]; followed: number; hotTokens: number; copyHistory: CopyTrade[] }>('/traders'),
  getEdgeMarkets: () =>
    req<MarketEdge[]>('/edge-markets'),
  getPriceHistory: (tokenId: string, interval = '1d') =>
    req<Array<{ t: number; p: number }>>(`/price-history/${tokenId}?interval=${interval}`),
};
