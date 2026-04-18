import React, { useCallback, useState } from 'react';
import { Sidebar }          from './ui/Sidebar';
import { DashTopBar }       from './terminal/TopBar';
import { MempoolFeed }      from './terminal/MempoolFeed';
import { MarketGrid }       from './terminal/MarketGrid';
import { ActivePositions }  from './terminal/ActivePositions';
import { EquityChart }      from './terminal/EquityChart';
import { PerformancePanel } from './terminal/PerformancePanel';
import { AgentPanel }       from './terminal/AgentPanel';
import { TopTraderPanel }   from './terminal/TopTraderPanel';
import { BotController }    from './terminal/BotController';
import { useStore }         from '@/hooks/useStore';
import { useWebSocket }     from '@/hooks/useWebSocket';
import { api }              from '@/services/api';

function KpiCard({
  label, value, sub, subPos, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  subPos?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className="card p-5 flex flex-col gap-2"
      style={accent ? { background: 'linear-gradient(135deg, rgba(255,107,53,0.12) 0%, rgba(255,140,0,0.06) 100%)' } : {}}
    >
      <div className="kpi-label">{label}</div>
      <div
        className={`text-3xl font-bold leading-none ${accent ? 'gradient-text' : 'text-white'}`}
      >
        {value}
      </div>
      {sub && (
        <div className={`text-xs font-medium ${
          subPos === true ? 'text-emerald-400' : subPos === false ? 'text-red-400' : 'text-white/40'
        }`}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const { state, handleWsMessage, setConnected } = useStore();
  const [activeView, setActiveView] = useState('home');

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
      <div className="h-screen flex items-center justify-center bg-surface-bg">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl"
            style={{ background: 'linear-gradient(135deg, #FF4500, #FF8C00)' }}
          >
            P
          </div>
          <div className="text-white/50 text-sm font-medium tracking-wide animate-pulse">
            Initializing Polymaus...
          </div>
        </div>
      </div>
    );
  }

  const p = state.portfolio;
  const startBalance = state.status?.portfolio
    ? (state.status.portfolio.balance - (state.status.portfolio.realisedPnl || 0))
    : 10000;

  const totalPnl  = (p?.realisedPnl ?? 0) + (p?.unrealisedPnl ?? 0);
  const dailyPnl  = p?.dailyPnl ?? 0;
  const equity    = p?.equity ?? startBalance;
  const winRate   = p?.winRate ?? 0;
  const openPos   = p?.openPositions ?? 0;

  return (
    <div className="h-screen flex bg-surface-bg overflow-hidden font-sans">
      {/* ── Sidebar ── */}
      <Sidebar status={state.status} activeView={activeView} onViewChange={setActiveView} />

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* TopBar */}
        <DashTopBar
          status={state.status}
          portfolio={state.portfolio}
          connected={state.connected}
        />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Row 1: KPI cards ── */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              label="Portfolio Value"
              value={`$${equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              sub={`${dailyPnl >= 0 ? '+' : ''}$${dailyPnl.toFixed(2)} today`}
              subPos={dailyPnl >= 0}
              accent
            />
            <KpiCard
              label="Total P&L"
              value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`}
              sub={`${((totalPnl / startBalance) * 100).toFixed(2)}% all time`}
              subPos={totalPnl >= 0}
            />
            <KpiCard
              label="Win Rate"
              value={`${winRate.toFixed(1)}%`}
              sub={`${p?.winTrades ?? 0} / ${p?.totalTrades ?? 0} trades`}
              subPos={winRate >= 50}
            />
            <KpiCard
              label="Open Positions"
              value={String(openPos)}
              sub={`$${(p?.balance ?? 0).toFixed(0)} available`}
            />
          </div>

          {/* ── Row 2: Equity chart + AI signals ── */}
          <div className="grid grid-cols-3 gap-4" style={{ height: '260px' }}>
            <div className="col-span-2 card" style={{ minHeight: 0 }}>
              <EquityChart
                trades={state.trades}
                startBalance={startBalance}
                portfolio={state.portfolio}
              />
            </div>
            <div className="card" style={{ minHeight: 0 }}>
              <PerformancePanel portfolio={state.portfolio} status={state.status} />
            </div>
          </div>

          {/* ── Row 3: Active positions ── */}
          <div className="card" style={{ minHeight: '160px', maxHeight: '220px' }}>
            <ActivePositions positions={state.positions} />
          </div>

          {/* ── Row 4: Markets ── */}
          <div className="card" style={{ height: '260px' }}>
            <MarketGrid
              markets={state.markets}
              signals={state.signals}
              edgeMarkets={state.edgeMarkets}
            />
          </div>

          {/* ── Row 5: Trade feed + Agents + Traders ── */}
          <div className="grid grid-cols-3 gap-4" style={{ height: '360px' }}>
            <div className="card" style={{ minHeight: 0 }}>
              <MempoolFeed trades={state.trades} />
            </div>
            <div className="card" style={{ minHeight: 0 }}>
              <AgentPanel
                status={state.status}
                portfolio={state.portfolio}
                onStrategyChange={refresh}
              />
            </div>
            <div className="card" style={{ minHeight: 0 }}>
              <TopTraderPanel
                traders={state.traders}
                copyTrades={state.copyTrades}
              />
            </div>
          </div>

          {/* Bottom spacer */}
          <div className="h-2" />
        </div>

        {/* ── Bot control bar ── */}
        <BotController status={state.status} onRefresh={refresh} />
      </div>
    </div>
  );
}
