import React, { useRef, useEffect } from 'react';
import type { Trade } from '@/types';

interface Props { trades: Trade[] }

/** Returns a source badge config based on the trade strategy field */
function sourceBadge(t: Trade): { label: string; cls: string } {
  const s = (t.strategy || '').toLowerCase();
  if (s === 'copy_trader')
    return { label: 'COPY', cls: 'text-term-cyan border-term-cyan/40' };
  if (s === 'test_mode')
    return { label: 'TEST', cls: 'text-term-amber border-term-amber/30' };
  if (s === 'contrarian')
    return { label: 'CONTRARIAN', cls: 'text-term-green border-term-green/40' };
  if (s === 'market_maker')
    return { label: 'MM', cls: 'text-term-green border-term-green/40' };
  if (s === 'signal')
    return { label: 'SIGNAL', cls: 'text-purple-400 border-purple-400/40' };
  if (s === 'adaptive')
    return { label: 'ADAPTIVE', cls: 'text-term-green border-term-green/40' };
  if (t.side === 'SELL')
    return { label: 'EXIT', cls: 'text-term-dim border-term-dim/30' };
  return { label: t.outcome === 'YES' ? 'YES' : 'NO', cls: 'text-term-dim border-term-dim/30' };
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
          <div className="p-3 t-dim text-[10px]">AWAITING TRANSACTIONS...</div>
        ) : (
          trades.map((t, i) => {
            const { label, cls } = sourceBadge(t);
            const pnl = t.pnl;
            const isCopy = (t.strategy || '').toLowerCase() === 'copy_trader';
            return (
              <div
                key={i}
                className={`flex flex-col px-2 py-[3px] border-b border-term-border/30 hover:bg-term-card animate-scroll text-[10px] ${
                  isCopy ? 'bg-term-card/50' : ''
                }`}
              >
                {/* Main row */}
                <div className="flex items-center gap-1.5">
                  <span className="text-term-dim shrink-0 w-14">{fmtTime(t.ts)}</span>
                  <span className={`shrink-0 font-bold text-[9px] ${t.side === 'BUY' ? 't-pos' : 't-neg'}`}>
                    {t.side}
                  </span>
                  <span className="flex-1 t-dim truncate text-[9px]">
                    {(t.question || '').slice(0, 22)}…
                  </span>
                  <span className="shrink-0 text-term-green w-9 text-right">${t.size.toFixed(0)}</span>
                  {pnl !== undefined && (
                    <span className={`shrink-0 w-10 text-right ${pnl >= 0 ? 't-pos' : 't-neg'}`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                    </span>
                  )}
                  <span className={`shrink-0 ml-1 text-[9px] border px-1 ${cls}`}>{label}</span>
                </div>

                {/* Copy trade sub-row: show which trader */}
                {isCopy && (
                  <div className="flex items-center gap-1 mt-0.5 pl-14">
                    <span className="text-term-cyan text-[8px]">↳ COPIED FROM</span>
                    <span className="text-term-cyan text-[8px] font-mono">
                      {shortAddr(t.token_id || '')}
                    </span>
                    <span className="text-term-dim text-[8px]">
                      @ {Math.round(t.price * 100)}¢ {t.outcome}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
