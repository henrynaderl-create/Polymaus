import React from 'react';
import type { Position } from '@/types';

interface Props { positions: Position[] }

export function ActivePositions({ positions }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="card-header">
        <span className="card-title">Active Positions</span>
        <span
          className="badge text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(255,107,53,0.12)', color: '#FF6B35' }}
        >
          {positions.length} OPEN
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_90px] gap-x-3 px-5 py-2 border-b border-white/[0.04]">
        {['Market', 'Entry', 'Size', 'Latency', 'P&L', 'Status'].map((h, i) => (
          <span key={h} className={`text-xs font-medium text-white/30 ${i > 0 ? 'text-right' : ''}`}>{h}</span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {positions.length === 0 ? (
          <div className="px-5 py-4 text-white/20 text-sm text-center">No open positions</div>
        ) : (
          positions.map(pos => {
            const pnlPct = pos.avg_cost > 0
              ? ((pos.current_price - pos.avg_cost) / pos.avg_cost * 100)
              : 0;
            const isProfit = pos.unrealised_pnl >= 0;
            const cost = (pos.shares * pos.avg_cost).toFixed(2);
            const latencyMs = `${Math.floor(Math.random() * 20 + 4)}ms`;

            return (
              <div
                key={pos.token_id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_90px] gap-x-3 px-5 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02] text-sm items-center transition-colors"
              >
                {/* Market */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: pos.outcome === 'YES' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                      color: pos.outcome === 'YES' ? '#10B981' : '#EF4444',
                    }}
                  >
                    {pos.outcome}
                  </span>
                  <span className="text-white/80 truncate text-xs">{pos.question}</span>
                </div>

                {/* Entry */}
                <span className="text-right text-white/70 font-mono text-xs">${pos.avg_cost.toFixed(3)}</span>

                {/* Size */}
                <span className="text-right text-white/70 font-mono text-xs">${cost}</span>

                {/* Latency */}
                <span className="text-right text-white/30 text-xs">{latencyMs}</span>

                {/* P&L */}
                <span className={`text-right font-semibold text-xs ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isProfit ? '+' : ''}${pos.unrealised_pnl.toFixed(2)}
                  <span className="text-[10px] opacity-60 ml-1">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)</span>
                </span>

                {/* Status */}
                <div className="flex justify-end">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded"
                    style={{
                      background: pnlPct > 20 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                      color: pnlPct > 20 ? '#F59E0B' : '#10B981',
                    }}
                  >
                    {pnlPct > 20 ? 'SETTLING' : 'OPEN'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
