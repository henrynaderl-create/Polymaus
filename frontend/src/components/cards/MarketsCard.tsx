import React from 'react';
import { Globe } from 'lucide-react';
import type { Market } from '@/types';

interface Props { markets: Market[] }

function PriceBar({ yes }: { yes: number }) {
  const pct = Math.round(yes * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct > 50
              ? `linear-gradient(90deg, #10b981, #34d399)`
              : `linear-gradient(90deg, #ef4444, #f87171)`,
          }}
        />
      </div>
      <span className="text-xs font-mono text-white w-8 text-right">{pct}%</span>
    </div>
  );
}

export function MarketsCard({ markets }: Props) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center">
          <Globe className="w-4 h-4 text-brand" />
        </div>
        <span className="font-semibold text-white">Market Scanner</span>
        <span className="ml-auto text-xs text-muted">{markets.length} active</span>
      </div>

      {markets.length === 0 ? (
        <div className="py-8 text-center text-muted text-sm">Scanning markets…</div>
      ) : (
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto scrollbar-thin">
          {markets.map(m => (
            <div key={m.conditionId} className="p-3 rounded-xl bg-surface-2 border border-white/5 flex flex-col gap-2">
              <span className="text-xs text-white/80 line-clamp-2 leading-tight">{m.question}</span>
              <PriceBar yes={m.yesPrice} />
              <div className="flex items-center justify-between text-[10px] text-muted font-mono">
                <span>YES {(m.yesPrice * 100).toFixed(1)}¢ · NO {(m.noPrice * 100).toFixed(1)}¢</span>
                <span>Vol ${(m.volume24h / 1000).toFixed(1)}k</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
