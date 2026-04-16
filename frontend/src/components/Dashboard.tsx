import React, { useCallback } from 'react';
import { TopBar }          from './terminal/TopBar';
import { MempoolFeed }     from './terminal/MempoolFeed';
import { MarketGrid }      from './terminal/MarketGrid';
import { ActivePositions } from './terminal/ActivePositions';
import { EquityChart }     from './terminal/EquityChart';
import { PerformancePanel } from './terminal/PerformancePanel';
import { AgentPanel }      from './terminal/AgentPanel';
import { TopTraderPanel }  from './terminal/TopTraderPanel';
import { BotController }   from './terminal/BotController';
import { useStore }        from '@/hooks/useStore';
import { useWebSocket }    from '@/hooks/useWebSocket';
import { api }             from '@/services/api';

export function Dashboard() {
  const { state, handleWsMessage, setConnected } = useStore();

  const onMessage = useCallback((msg: unknown) => {
    setConnected(true);
    handleWsMessage(msg);
  }, [handleWsMessage, setConnected]);

  const onDisconnect = useCallback(() => setConnected(false), [setConnected]);

  useWebSocket(onMessage, onDisconnect);

  const refresh = useCallback(() => {
    api.getStatus().then(s => {
      handleWsMessage({ event: 'portfolio',   data: s.portfolio });
      handleWsMessage({ event: 'positions',   data: s.positions });
      handleWsMessage({ event: 'signals',     data: s.signals });
      handleWsMessage({ event: 'markets',     data: s.markets });
      handleWsMessage({ event: 'traders',     data: s.traders ?? [] });
      handleWsMessage({ event: 'copy_trades', data: s.copyTrades ?? [] });
    }).catch(() => {});
  }, [handleWsMessage]);

  if (state.loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-term-bg">
        <div className="text-term-green text-[12px] tracking-widest animate-blink">
          INITIALIZING POLYMAUS TERMINAL...
        </div>
      </div>
    );
  }

  const startBalance = state.status?.portfolio
    ? (state.status.portfolio.balance - (state.status.portfolio.realisedPnl || 0))
    : 10000;

  return (
    <div className="h-screen flex flex-col bg-term-bg overflow-hidden">
      {/* ── Top bar ── */}
      <TopBar
        status={state.status}
        portfolio={state.portfolio}
        connected={state.connected}
      />

      {/* ── Main 4-column grid: feed | markets | right-stats | traders ── */}
      <div className="flex-1 grid grid-cols-[200px_1fr_190px_210px] gap-px bg-term-border overflow-hidden">

        {/* LEFT: Mempool feed with source badges */}
        <MempoolFeed trades={state.trades} />

        {/* CENTER: Market cards + chart + positions */}
        <div className="flex flex-col gap-px bg-term-border overflow-hidden">

          {/* Market sparkline cards — top 40% */}
          <div className="h-[40%] min-h-0">
            <MarketGrid markets={state.markets} signals={state.signals} edgeMarkets={state.edgeMarkets} />
          </div>

          {/* Equity chart — middle 28% */}
          <div className="h-[28%] min-h-0">
            <EquityChart trades={state.trades} startBalance={startBalance} />
          </div>

          {/* Active positions — bottom 32% */}
          <div className="h-[32%] min-h-0">
            <ActivePositions positions={state.positions} />
          </div>
        </div>

        {/* RIGHT-A: Performance + agents */}
        <div className="flex flex-col gap-px bg-term-border overflow-hidden">
          <div className="h-[55%] min-h-0">
            <PerformancePanel portfolio={state.portfolio} status={state.status} />
          </div>
          <div className="h-[45%] min-h-0">
            <AgentPanel
              status={state.status}
              portfolio={state.portfolio}
              onStrategyChange={refresh}
            />
          </div>
        </div>

        {/* RIGHT-B: Top traders + copy trades feed */}
        <TopTraderPanel
          traders={state.traders}
          copyTrades={state.copyTrades}
        />
      </div>

      {/* ── Bottom control bar ── */}
      <BotController status={state.status} onRefresh={refresh} />
    </div>
  );
}
