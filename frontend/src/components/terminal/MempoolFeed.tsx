import React, { useRef, useEffect } from 'react';
import type { Trade } from '@/types';

interface Props { trades: Trade[] }

function sourceBadge(t: Trade): { label: string; cls: string } {
  const s = (t.strategy || '').toLowerCase();
  if (s === 'copy_trader')
    return { label: 'COPY',       cls: 'text-term-cyan border-term-cyan/50' };
  if (s === 'momentum')
    return { label: 'MOMENTUM',   cls: 'text-term-green border-term-green/50' };
  if (s === 'pulse')
    return { label: 'PULSE',      cls: 'text-term-bright border-term-bright/40' };
  if (s === 'contrarian')
    return { label: 'CONTRARIAN', cls: 'text-term-green border-term-green/40' };
  if (s === 'edge_enforcer')
    return { label: 'EDGE',       cls: 'text-purple-400 border-purple-400/40' };
  if (s === 'market_maker')
    return { label: 'MM',         cls: 'text-term-green border-term-green/40' };
  if (s === 'signal')
    return { label: 'SIGNAL',     cls: 'text-purple-400 border-purple-400/40' };
  if (s === 'adaptive')
    return { label: 'ADAPTIVE',   cls: 'text-term-green border-term-green/40' };
  if (s === 'test_mode')
    return { label: 'TEST',       cls: 'text-term-amber border-term-amber/30' };
  if (t.side === 'SELL')
    return { label: 'EXIT',       cls: 'text-term-dim border-term-dim/30' };
  return { label: t.outcome === 'YES' ? 'YES' : 'NO',
           cls: 'text-term-dim border-term-dim/30' };
}

function shortAddr(s: string) {
  if (!s || s.length < 10) return s || '---';
  return s.slice(0, 6) + '…' + s.slice(-4);
}

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '--:--:--';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  } catch { return '--:--:--'; }
}

export function MempoolFeed({ trades }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const prevLen = useRef(0);

  // Scroll to top when new trades arrive
  useEffect(() => {
    if (trades.length > prevLen.current && ref.current) {
      ref.current.scrollTop = 0;
    }
    prevLen.current = trades.length;
  }, [trades.length]);

  return (
    <div className="flex flex-col h-full panel">
      <div className="panel-header flex items-center justify-between">
        <span>MEMPOOL FEED</span>
        <span className="text-term-bright font-bold">{trades.length}</span>
      </div>
      <div
        ref={ref}
        className="flex-1 overflow-y-auto"
        style={{ overflowY: 'auto' }}
      >
        {trades.length === 0 ? (
          <div className="p-3 text-term-dim text-[10px] animate-pulse">
            AWAITING TRANSACTIONS...
          </div>
        ) : (
          trades.map((t, i) => {
            const { label, cls } = sourceBadge(t);
            const pnl = t.pnl;
            const isCopy = (t.strategy || '').toLowerCase() === 'copy_trader';
            // Use traderAddress field if present (copy trades), fall back to nothing
            const traderAddr = (t as any).traderAddress as string | undefined;
            const isNew = i === 0;
            return (
              <div
                key={`${t.ts}-${i}`}
                className={[
                  'flex flex-col px-2 py-[3px] border-b border-term-border/30',
                  'hover:bg-term-card text-[10px]',
                  isCopy ? 'bg-term-card/50' : '',
                  isNew ? 'animate-pulse-once' : '',
                ].join(' ')}
              >
                {/* Main row */}
                <div className="flex items-center gap-1.5">
                  <span className="text-term-dim shrink-0 w-14 font-mono">
                    {fmtTime(t.ts)}
                  </span>
                  <span className={`shrink-0 font-bold text-[9px] ${
                    t.side === 'BUY' ? 'text-term-green' : 'text-red-400'
                  }`}>
                    {t.side}
                  </span>
                  <span className="flex-1 text-term-dim truncate text-[9px]">
                    {(t.question || '').slice(0, 24)}
                  </span>
                  <span className="shrink-0 text-term-green w-9 text-right font-mono">
                    ${(t.size || 0).toFixed(0)}
                  </span>
                  {pnl !== undefined && (
                    <span className={`shrink-0 w-11 text-right font-mono ${
                      pnl >= 0 ? 'text-term-green' : 'text-red-400'
                    }`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                    </span>
                  )}
                  <span className={`shrink-0 ml-1 text-[9px] border px-1 rounded-sm ${cls}`}>
                    {label}
                  </span>
                </div>

                {/* Copy trade sub-row */}
                {isCopy && traderAddr && (
                  <div className="flex items-center gap-1 mt-0.5 pl-14">
                    <span className="text-term-cyan text-[8px]">↳ COPIED FROM</span>
                    <span className="text-term-cyan text-[8px] font-mono">
                      {shortAddr(traderAddr)}
                    </span>
                    <span className="text-term-dim text-[8px]">
                      @ {Math.round((t.price || 0) * 100)}¢ {t.outcome}
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
