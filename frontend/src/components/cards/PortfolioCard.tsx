import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Target, Percent, Activity } from 'lucide-react';
import type { Portfolio } from '@/types';

interface Props { portfolio: Portfolio | null }

function StatBox({ label, value, sub, up }: { label: string; value: string; sub?: string; up?: boolean }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-surface-2 border border-white/5">
      <span className="text-xs text-muted uppercase tracking-widest">{label}</span>
      <span className={`text-lg font-semibold font-mono ${up === undefined ? 'text-white' : up ? 'text-success' : 'text-danger'}`}>
        {value}
      </span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

export function PortfolioCard({ portfolio: p }: Props) {
  if (!p) return <div className="card animate-pulse h-40 rounded-2xl bg-surface-1" />;

  const dailyUp = p.dailyPnl >= 0;
  const totalUp = p.realisedPnl + p.unrealisedPnl >= 0;

  return (
    <div className="card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-brand" />
          </div>
          <span className="font-semibold text-white">Portfolio</span>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-mono ${p.isDemo ? 'bg-warn/20 text-warn' : 'bg-success/20 text-success'}`}>
          {p.isDemo ? 'DEMO' : 'LIVE'}
        </span>
      </div>

      <div className="text-center">
        <div className="text-3xl font-bold font-mono text-white">
          ${p.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div className={`flex items-center justify-center gap-1 text-sm mt-1 ${totalUp ? 'text-success' : 'text-danger'}`}>
          {totalUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span className="font-mono">
            {totalUp ? '+' : ''}{(p.realisedPnl + p.unrealisedPnl).toFixed(2)} all-time
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatBox label="Balance" value={`$${p.balance.toFixed(2)}`} />
        <StatBox
          label="Daily P&L"
          value={`${dailyUp ? '+' : ''}$${p.dailyPnl.toFixed(2)}`}
          up={dailyUp}
        />
        <StatBox
          label="Unrealised"
          value={`${p.unrealisedPnl >= 0 ? '+' : ''}$${p.unrealisedPnl.toFixed(2)}`}
          up={p.unrealisedPnl >= 0}
        />
        <StatBox label="Win Rate" value={`${p.winRate.toFixed(1)}%`} sub={`${p.winTrades}/${p.totalTrades} trades`} />
        <StatBox label="Open Pos." value={String(p.openPositions)} />
        <StatBox label="Total Trades" value={String(p.totalTrades)} />
      </div>
    </div>
  );
}
