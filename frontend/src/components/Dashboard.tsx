import React, { useCallback } from 'react';
import { PortfolioCard } from './cards/PortfolioCard';
import { PnLChart } from './cards/PnLChart';
import { PositionsCard } from './cards/PositionsCard';
import { TradesCard } from './cards/TradesCard';
import { MarketsCard } from './cards/MarketsCard';
import { SignalsCard } from './cards/SignalsCard';
import { LeaderboardCard } from './cards/LeaderboardCard';
import { BotControls } from './controls/BotControls';
import { useStore } from '@/hooks/useStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { api } from '@/services/api';

export function Dashboard() {
  const { state, handleWsMessage, setConnected } = useStore();

  const onMessage = useCallback((msg: unknown) => {
    setConnected(true);
    handleWsMessage(msg);
  }, [handleWsMessage, setConnected]);

  useWebSocket(onMessage);

  const refresh = useCallback(() => {
    api.getStatus().then(s => handleWsMessage({ event: 'portfolio', data: s.portfolio }));
  }, [handleWsMessage]);

  if (state.loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center">
            <span className="text-2xl">🐭</span>
          </div>
          <div className="text-muted text-sm">Connecting to Polymaus…</div>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-danger text-sm">API Error: {state.error}</div>
      </div>
    );
  }

  const leaderboard = state.status?.leaderboard ?? [];
  const hotTokens = state.status?.hotTokens ?? 0;

  return (
    <div className="min-h-screen bg-surface text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur border-b border-white/5 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐭</span>
            <span className="font-bold text-white tracking-tight">Polymaus</span>
            <span className="hidden sm:block text-xs text-muted">Polymarket Bot</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
              state.status?.mode === 'demo'
                ? 'bg-warn/10 text-warn border-warn/30'
                : 'bg-danger/10 text-danger border-danger/30'
            }`}>
              {state.status?.mode?.toUpperCase() ?? 'DEMO'}
            </span>
            {state.connected && (
              <span className="flex items-center gap-1 text-xs text-success">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse2" />
                Live
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main grid */}
      <main className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
        {/* Mobile: single column  |  Tablet: 2-col  |  Desktop: 3-col */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">

          {/* Row 1: Portfolio (full) + PnL chart */}
          <div className="sm:col-span-2 xl:col-span-2">
            <PortfolioCard portfolio={state.portfolio} />
          </div>
          <div>
            <BotControls
              status={state.status}
              connected={state.connected}
              onRefresh={refresh}
            />
          </div>

          {/* Row 2: PnL chart (wide) */}
          <div className="sm:col-span-2 xl:col-span-3">
            <PnLChart trades={state.trades} />
          </div>

          {/* Row 3: 3-column cards */}
          <PositionsCard positions={state.positions} />
          <TradesCard trades={state.trades} />
          <SignalsCard signals={state.signals} />

          {/* Row 4 */}
          <div className="sm:col-span-2">
            <MarketsCard markets={state.markets} />
          </div>
          <LeaderboardCard leaders={leaderboard} hotTokens={hotTokens} />
        </div>

        <p className="mt-8 text-center text-[10px] text-muted/50">
          Polymaus v1.0 · {state.status?.mode === 'demo' ? '🟡 Demo mode – no real money' : '🔴 Live mode'} · Not financial advice
        </p>
      </main>
    </div>
  );
}
