import React, { useRef, useEffect } from 'react';
import type { Trade } from '@/types';

interface Props { trades: Trade[] }

function statusLabel(t: Trade) {
  if (t.side === 'SELL') return { label: 'SETTLED', cls: 'text-term-dim border-term-dim/30' };
  if (t.outcome === 'YES')  return { label: 'FRONT-RUN', cls: 'text-term-cyan border-term-cyan/30' };
  return { label: 'SKIP', cls: 'text-term-amber border-term-amber/30' };
}

function shortAddr(s: string) {
  return s.length > 12 ? s.slice(0, 6) + '…' + s.slice(-4) : s;
}

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  } catch { return '--:--:--'; }
}

export function MempoolFeed({ trades }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [trades.length]);

  return (
    <div className="flex flex-col h-full panel">
      <div className="panel-header flex items-center justify-between">
        <span>MEMPOOL FEED</span>
        <span className="text-term-bright font-bold">{trades.length}</span>
      </div>
      <div ref={ref} className="flex-1 overflow-y-auto">
        {trades.length === 0 ? (
          <div className="p-3 t-dim">AWAITING TRANSACTIONS...</div>
        ) : (
          trades.map((t, i) => {
            const { label, cls } = statusLabel(t);
            const pnl = t.pnl;
            return (
              <div key={i} className="flex items-center gap-1.5 px-2 py-[3px] border-b border-term-border/30 hover:bg-term-card animate-scroll text-[10px]">
                <span className="text-term-dim shrink-0 w-14">{fmtTime(t.ts)}</span>
                <span className="text-term-dim shrink-0 w-16 truncate">{shortAddr(t.token_id || '')}</span>
                <span className="shrink-0 w-12 truncate t-dim">{(t.question || '').slice(0, 8)}…</span>
                <span className={`shrink-0 font-bold text-[9px] ${t.side === 'BUY' ? 't-pos' : 't-neg'}`}>{t.side}</span>
                <span className="shrink-0 text-term-green w-10 text-right">${t.size.toFixed(0)}</span>
                {pnl !== undefined && (
                  <span className={`shrink-0 w-10 text-right ${pnl >= 0 ? 't-pos' : 't-neg'}`}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                  </span>
                )}
                <span className={`shrink-0 ml-auto text-[9px] border px-1 ${cls}`}>{label}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
