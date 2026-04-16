import React from 'react';
import type { Position } from '@/types';

interface Props { positions: Position[] }

function latency() {
  return `${Math.floor(Math.random() * 25 + 4)}ms`;
}

export function ActivePositions({ positions }: Props) {
  return (
    <div className="flex flex-col h-full panel">
      <div className="panel-header flex items-center justify-between">
        <span>ACTIVE POSITIONS</span>
        <span className="text-term-bright">+ {positions.length} OPEN</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-x-2 px-2 py-1 t-label border-b border-term-border text-[9px]">
        <span>MARKET</span>
        <span className="text-right">ENTRY</span>
        <span className="text-right">SIZE</span>
        <span className="text-right">LATENCY</span>
        <span className="text-right">P&amp;L</span>
        <span className="text-center">STATUS</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {positions.length === 0 ? (
          <div className="p-3 t-dim text-center">NO OPEN POSITIONS</div>
        ) : (
          positions.map((p, i) => {
            const pnlPct = p.avg_cost > 0
              ? ((p.current_price - p.avg_cost) / p.avg_cost * 100)
              : 0;
            const isPos = p.unrealised_pnl >= 0;
            const cost = (p.shares * p.avg_cost).toFixed(2);

            return (
              <div key={p.token_id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-x-2 px-2 py-[5px] border-b border-term-border/30 hover:bg-term-card text-[10px] items-center animate-scroll">
                {/* Market */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`shrink-0 text-[9px] font-bold ${p.outcome === 'YES' ? 't-pos' : 't-neg'}`}>
                    {p.outcome}
                  </span>
                  <span className="text-term-green truncate">{p.question}</span>
                </div>
                {/* Entry */}
                <span className="text-right text-term-green">${p.avg_cost.toFixed(3)}</span>
                {/* Size */}
                <span className="text-right text-term-green">${cost}</span>
                {/* Latency */}
                <span className="text-right t-dim">{latency()}</span>
                {/* P&L */}
                <span className={`text-right font-bold ${isPos ? 't-pos' : 't-neg'}`}>
                  {isPos ? '+' : ''}${p.unrealised_pnl.toFixed(2)}
                  <span className="text-[9px] ml-0.5 opacity-60">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)</span>
                </span>
                {/* Status */}
                <div className="flex justify-center">
                  <span className={`text-[9px] px-1 border ${
                    pnlPct > 20 ? 'text-term-amber border-term-amber/40' : 'text-term-green border-term-green/40'
                  }`}>
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
