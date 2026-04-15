import React from 'react';
import { Layers, TrendingUp, TrendingDown } from 'lucide-react';
import type { Position } from '@/types';

interface Props { positions: Position[] }

function PnlBadge({ pnl }: { pnl: number }) {
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${pnl >= 0 ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
    </span>
  );
}

export function PositionsCard({ positions }: Props) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center">
          <Layers className="w-4 h-4 text-brand" />
        </div>
        <span className="font-semibold text-white">Open Positions</span>
        <span className="ml-auto text-sm text-muted">{positions.length}</span>
      </div>

      {positions.length === 0 ? (
        <div className="py-8 text-center text-muted text-sm">No open positions</div>
      ) : (
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto scrollbar-thin">
          {positions.map(pos => {
            const pnlPct = pos.avg_cost > 0
              ? ((pos.current_price - pos.avg_cost) / pos.avg_cost) * 100
              : 0;
            return (
              <div key={pos.token_id} className="flex flex-col gap-1 p-3 rounded-xl bg-surface-2 border border-white/5 animate-slide-up">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-white/80 leading-tight line-clamp-2">{pos.question}</span>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${pos.outcome === 'YES' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                    {pos.outcome}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="font-mono">
                    {pos.shares.toFixed(2)} @ {pos.avg_cost.toFixed(3)} → {pos.current_price.toFixed(3)}
                  </span>
                  <div className="flex items-center gap-2">
                    {pnlPct >= 0 ? <TrendingUp className="w-3 h-3 text-success" /> : <TrendingDown className="w-3 h-3 text-danger" />}
                    <PnlBadge pnl={pos.unrealised_pnl} />
                    <span className={`font-mono text-xs ${pnlPct >= 0 ? 'text-success' : 'text-danger'}`}>
                      {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-muted/60">{pos.strategy}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
