import { useState, useCallback, useEffect, useRef } from 'react';
import type { BotStatus, Portfolio, Position, Trade, Signal, Market, Trader, CopyTrade, MarketEdge } from '@/types';
import { api } from '@/services/api';

export interface AppState {
  status: BotStatus | null;
  portfolio: Portfolio | null;
  positions: Position[];
  trades: Trade[];
  signals: Signal[];
  markets: Market[];
  traders: Trader[];
  copyTrades: CopyTrade[];
  edgeMarkets: MarketEdge[];
  connected: boolean;
  loading: boolean;
  error: string | null;
}

const INITIAL: AppState = {
  status: null,
  portfolio: null,
  positions: [],
  trades: [],
  signals: [],
  markets: [],
  traders: [],
  copyTrades: [],
  edgeMarkets: [],
  connected: false,
  loading: true,
  error: null,
};

export function useStore() {
  const [state, setState] = useState<AppState>(INITIAL);
  const tradesRef = useRef<Trade[]>([]);

  const setConnected = useCallback((v: boolean) =>
    setState(s => ({ ...s, connected: v })), []);

  const handleWsMessage = useCallback((raw: unknown) => {
    const msg = raw as { event: string; data: unknown };
    setState(s => {
      switch (msg.event) {
        case 'portfolio':
          return { ...s, portfolio: msg.data as Portfolio };
        case 'positions':
          return { ...s, positions: msg.data as Position[] };
        case 'trade': {
          const t = msg.data as Trade;
          const next = [t, ...tradesRef.current].slice(0, 200);
          tradesRef.current = next;
          return { ...s, trades: next };
        }
        case 'signals':
          return { ...s, signals: msg.data as Signal[] };
        case 'markets':
          return { ...s, markets: msg.data as Market[] };
        case 'traders':
          return { ...s, traders: msg.data as Trader[] };
        case 'copy_trades': {
          const ct = msg.data as CopyTrade;
          // single copy trade pushed as event
          if (ct && !Array.isArray(ct)) {
            const next = [ct, ...s.copyTrades].slice(0, 100);
            return { ...s, copyTrades: next };
          }
          return { ...s, copyTrades: msg.data as CopyTrade[] };
        }
        case 'edge_markets':
          return { ...s, edgeMarkets: msg.data as MarketEdge[] };
        default:
          return s;
      }
    });
  }, []);

  // Initial load
  useEffect(() => {
    api.getStatus()
      .then(status => {
        tradesRef.current = status.recentTrades;
        setState(s => ({
          ...s,
          status,
          portfolio: status.portfolio,
          positions: status.positions,
          trades: status.recentTrades,
          signals: status.signals,
          markets: status.markets,
          traders: status.traders ?? [],
          copyTrades: status.copyTrades ?? [],
          edgeMarkets: status.edgeMarkets ?? [],
          loading: false,
        }));
      })
      .catch(err => setState(s => ({ ...s, loading: false, error: err.message })));
  }, []);

  // Polling fallback (every 5s when WS is down)
  useEffect(() => {
    const id = setInterval(() => {
      if (!state.connected) {
        api.getStatus().then(status => {
          setState(s => ({
            ...s,
            status,
            portfolio: status.portfolio,
            positions: status.positions,
            signals: status.signals,
            markets: status.markets,
          }));
        }).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(id);
  }, [state.connected]);

  return { state, handleWsMessage, setConnected };
}
