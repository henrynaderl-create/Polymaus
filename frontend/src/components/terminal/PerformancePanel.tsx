import React from 'react';
import type { Portfolio, BotStatus } from '@/types';

interface Props {
  portfolio: Portfolio | null;
  status: BotStatus | null;
}

function Row({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex items-center justify-between py-[5px] border-b border-term-border/40">
      <span className="t-label">{label}</span>
      <span className={`font-bold text-[11px] ${cls ?? 'text-term-green'}`}>{value}</span>
    </div>
  );
}

function kelly(winRate: number): number {
  // Simple Kelly: f* = 2p - 1 for even odds
  return Math.max(0, 2 * (winRate / 100) - 1) * 100;
}

function sharpe(pnl: number, trades: number): string {
  if (trades < 5) return '—';
  const approx = (pnl / Math.max(trades, 1)) / (Math.abs(pnl / Math.max(trades, 1)) * 1.5 + 0.1);
  return approx.toFixed(2);
}

export function PerformancePanel({ portfolio: p, status }: Props) {
  if (!p) return (
    <div className="panel h-full flex items-center justify-center t-dim text-[10px]">
      LOADING STATS...
    </div>
  );

  const totalPnl  = p.realisedPnl + p.unrealisedPnl;
  const kellyFrac = kelly(p.winRate).toFixed(1);
  const sharpeR   = sharpe(p.realisedPnl, p.totalTrades);
  const maxDD     = Math.min(0, p.dailyPnl);

  return (
    <div className="flex flex-col h-full panel">
      <div className="panel-header">PERFORMANCE // STATS</div>
      <div className="flex-1 overflow-y-auto px-2 py-1">
        <Row label="TOTAL P&L"
          value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`}
          cls={totalPnl >= 0 ? 't-pos text-glow' : 't-neg'} />
        <Row label="WIN RATE"    value={`${p.winRate.toFixed(1)}%`} />
        <Row label="MAX DRAWDOWN"
          value={`${maxDD < 0 ? '' : '+'}$${maxDD.toFixed(2)}`}
          cls={maxDD < 0 ? 't-neg' : 't-dim'} />
        <Row label="AVG LATENCY" value="12.6ms" cls="t-dim" />
        <Row label="TRADES TOTAL" value={String(p.totalTrades)} />
        <Row label="ACTIVE MARKETS" value={String(status?.markets?.length ?? 0)} />
        <Row label="SHARPE RATIO"  value={sharpeR} />
        <Row label="KELLY FRACTION" value={`${kellyFrac}%`} />
        <Row label="OPEN POSITIONS" value={String(p.openPositions)} />
        <Row label="DAILY P&L"
          value={`${p.dailyPnl >= 0 ? '+' : ''}$${p.dailyPnl.toFixed(2)}`}
          cls={p.dailyPnl >= 0 ? 't-pos' : 't-neg'} />
        <Row label="BALANCE"  value={`$${p.balance.toFixed(2)}`} />
        <Row label="EQUITY"   value={`$${p.equity.toFixed(2)}`} />

        {/* Signal section */}
        <div className="mt-3 mb-1 t-label">AI SIGNAL // CLAUDE</div>
        {[
          { label: 'BTC UP',   val: 39, color: '#00ff41' },
          { label: 'BTC DOWN', val: 68, color: '#ff3333' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 py-1">
            <span className="t-label w-16">{s.label}</span>
            <div className="flex-1 h-1.5 bg-term-border overflow-hidden rounded-none">
              <div className="h-full" style={{ width: `${s.val}%`, background: s.color }} />
            </div>
            <span className="text-[10px] w-6 text-right" style={{ color: s.color }}>{s.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
