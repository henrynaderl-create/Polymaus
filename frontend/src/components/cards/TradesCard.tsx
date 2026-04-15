import React from 'react';
import { Zap } from 'lucide-react';
import type { Trade } from '@/types';

interface Props { trades: Trade[] }

export function TradesCard({ trades }: Props) {
  const recent = trades.slice(0, 30);

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-brand" />
        </div>
        <span className="font-semibold text-white">Live Trades</span>
        <span className="ml-auto flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse2" />
          <span className="text-xs text-muted">live</span>
        </span>
      </div>

      {recent.length === 0 ? (
        <div className="py-8 text-center text-muted text-sm">Waiting for first trade…</div>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto scrollbar-thin">
          {recent.map((t, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-2 text-xs animate-fade-in">
              <span className={`shrink-0 font-bold w-8 ${t.side === 'BUY' ? 'text-success' : 'text-danger'}`}>
                {t.side}
              </span>
              <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-semibold ${t.outcome === 'YES' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                {t.outcome}
              </span>
              <span className="flex-1 text-white/70 truncate">{t.question}</span>
              <span className="shrink-0 font-mono text-white">{t.price.toFixed(3)}</span>
              {t.pnl !== undefined && (
                <span className={`shrink-0 font-mono ${t.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                  {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
