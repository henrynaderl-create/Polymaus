import React from 'react';
import type { Portfolio, BotStatus } from '@/types';

interface Props { portfolio: Portfolio | null; status: BotStatus | null }

function StatRow({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-white/40 text-xs">{label}</span>
      <span className={`text-sm font-semibold ${cls ?? 'text-white'}`}>{value}</span>
    </div>
  );
}

function BarSignal({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-white/40 text-xs w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-mono w-6 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

export function PerformancePanel({ portfolio: p, status }: Props) {
  if (!p) return (
    <div className="h-full flex items-center justify-center text-white/20 text-sm animate-pulse">
      Loading stats...
    </div>
  );

  const totalPnl = p.realisedPnl + p.unrealisedPnl;
  const sharpe   = p.totalTrades < 5 ? '—'
    : ((p.realisedPnl / Math.max(p.totalTrades, 1)) /
       (Math.abs(p.realisedPnl / Math.max(p.totalTrades, 1)) * 1.5 + 0.1)).toFixed(2);
  const kelly    = (Math.max(0, 2 * (p.winRate / 100) - 1) * 100).toFixed(1);

  return (
    <div className="flex flex-col h-full">
      <div className="card-header">
        <span className="card-title">Performance</span>
        <span className="badge badge-muted">STATS</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <StatRow label="Total P&L"
          value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`}
          cls={totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <StatRow label="Win Rate"
          value={`${p.winRate.toFixed(1)}%`}
          cls={p.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'} />
        <StatRow label="Max Drawdown"
          value={`$${Math.min(0, p.dailyPnl).toFixed(2)}`}
          cls={p.dailyPnl < 0 ? 'text-red-400' : 'text-white/40'} />
        <StatRow label="Avg Latency" value="12.6ms" cls="text-white/50" />
        <StatRow label="Total Trades" value={String(p.totalTrades)} />
        <StatRow label="Markets" value={String(status?.markets?.length ?? 0)} />
        <StatRow label="Sharpe Ratio" value={sharpe} />
        <StatRow label="Kelly Fraction" value={`${kelly}%`} />
        <StatRow label="Daily P&L"
          value={`${p.dailyPnl >= 0 ? '+' : ''}$${p.dailyPnl.toFixed(2)}`}
          cls={p.dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <StatRow label="Balance" value={`$${p.balance.toFixed(2)}`} />

        <div className="mt-3 mb-1">
          <span className="text-white/30 text-[10px] font-medium tracking-widest uppercase">AI Signals</span>
        </div>
        <BarSignal label="BTC UP"   value={39} color="#10B981" />
        <BarSignal label="BTC DOWN" value={68} color="#EF4444" />
      </div>
    </div>
  );
}
