import React from 'react';
import { Cpu } from 'lucide-react';
import type { Signal } from '@/types';

interface Props { signals: Signal[] }

const SIGNAL_COLORS: Record<string, string> = {
  BUY_YES: 'text-success bg-success/20',
  BUY_NO: 'text-danger bg-danger/20',
  SELL: 'text-warn bg-warn/20',
  HOLD: 'text-muted bg-muted/20',
};

function ConfBar({ v }: { v: number }) {
  return (
    <div className="w-16 h-1.5 rounded-full bg-surface-3 overflow-hidden">
      <div
        className="h-full rounded-full bg-brand"
        style={{ width: `${Math.round(v * 100)}%` }}
      />
    </div>
  );
}

export function SignalsCard({ signals }: Props) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center">
          <Cpu className="w-4 h-4 text-brand" />
        </div>
        <span className="font-semibold text-white">Strategy Signals</span>
        <span className="ml-auto text-xs text-muted">{signals.length} active</span>
      </div>

      {signals.length === 0 ? (
        <div className="py-6 text-center text-muted text-sm">Computing signals…</div>
      ) : (
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto scrollbar-thin">
          {signals.map((s, i) => (
            <div key={i} className="p-3 rounded-xl bg-surface-2 border border-white/5 flex flex-col gap-1.5 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SIGNAL_COLORS[s.signal] ?? 'text-muted'}`}>
                  {s.signal}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${s.outcome === 'YES' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                  {s.outcome}
                </span>
                <span className="ml-auto text-xs font-mono text-white">{(s.price * 100).toFixed(1)}¢</span>
              </div>
              <span className="text-xs text-white/70 line-clamp-1">{s.question}</span>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted/70 line-clamp-1 flex-1">{s.reason}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ConfBar v={s.confidence} />
                  <span className="text-[10px] font-mono text-muted">{(s.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
