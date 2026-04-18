import React, { useRef, useEffect, useState } from 'react';
import type { Trade } from '@/types';

interface Props { trades: Trade[] }

type Tab = 'ALL' | 'CRYPTO' | 'SPORTS' | 'POLITICS' | 'NEWS';

function sourceBadge(t: Trade): { label: string; cls: string } {
  const s = (t.strategy || '').toLowerCase();
  if (s === 'copy_trader')  return { label: 'COPY',       cls: 'badge-cyan' };
  if (s === 'momentum')     return { label: 'MOMENTUM',   cls: 'badge-green' };
  if (s === 'pulse')        return { label: 'PULSE',      cls: 'badge-orange' };
  if (s === 'contrarian')   return { label: 'CONTRARIAN', cls: 'badge-purple' };
  if (s === 'edge_enforcer')return { label: 'EDGE',       cls: 'badge-purple' };
  if (s === 'market_maker') return { label: 'MM',         cls: 'badge-blue' };
  if (s === 'signal')       return { label: 'SIGNAL',     cls: 'badge-blue' };
  if (s === 'adaptive')     return { label: 'ADAPTIVE',   cls: 'badge-green' };
  if (t.side === 'SELL')    return { label: 'EXIT',       cls: 'badge-muted' };
  return { label: t.outcome === 'YES' ? 'YES' : 'NO', cls: 'badge-muted' };
}

function catBadge(cat?: string) {
  switch (cat) {
    case 'crypto':   return { label: 'CRYPTO',   cls: 'badge-orange' };
    case 'sports':   return { label: 'SPORTS',   cls: 'badge-blue' };
    case 'politics': return { label: 'POL',      cls: 'badge-purple' };
    case 'news':     return { label: 'NEWS',     cls: 'badge-muted' };
    default:         return { label: 'HOT',      cls: 'badge-orange' };
  }
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

const TABS: Tab[] = ['ALL', 'CRYPTO', 'SPORTS', 'POLITICS', 'NEWS'];

export function MempoolFeed({ trades }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const prevLen = useRef(0);
  const [activeTab, setActiveTab] = useState<Tab>('ALL');

  useEffect(() => {
    if (trades.length > prevLen.current && ref.current) {
      ref.current.scrollTop = 0;
    }
    prevLen.current = trades.length;
  }, [trades.length]);

  const filtered = activeTab === 'ALL'
    ? trades
    : trades.filter(t => {
        const cat = ((t as any).category as string | undefined) || 'trending';
        if (activeTab === 'NEWS') return cat === 'news' || cat === 'trending';
        return cat === activeTab.toLowerCase();
      });

  return (
    <div className="flex flex-col h-full">
      <div className="card-header">
        <span className="card-title">Trade Feed</span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(255,107,53,0.12)', color: '#FF6B35' }}
        >
          {trades.length}
        </span>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-white/[0.04] overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all duration-150"
            style={{
              background: activeTab === tab ? 'rgba(255,107,53,0.15)' : 'rgba(255,255,255,0.04)',
              color: activeTab === tab ? '#FF6B35' : 'rgba(255,255,255,0.35)',
              border: activeTab === tab ? '1px solid rgba(255,107,53,0.25)' : '1px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div ref={ref} className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-white/20 text-sm text-center animate-pulse">
            Awaiting transactions...
          </div>
        ) : (
          filtered.map((t, i) => {
            const { label: srcLabel, cls: srcCls } = sourceBadge(t);
            const { label: catLabel, cls: catCls }  = catBadge((t as any).category);
            const isCopy = (t.strategy || '').toLowerCase() === 'copy_trader';
            const traderAddr = (t as any).traderAddress as string | undefined;
            const isNew = i === 0;

            return (
              <div
                key={`${t.ts}-${i}`}
                className={`flex flex-col px-3 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${
                  isNew ? 'animate-flash-in' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-white/30 text-[10px] font-mono shrink-0 w-14">{fmtTime(t.ts)}</span>
                  <span className={`badge shrink-0 ${catCls}`}>{catLabel}</span>
                  <span
                    className="shrink-0 text-[10px] font-bold"
                    style={{ color: t.side === 'BUY' ? '#10B981' : '#EF4444' }}
                  >
                    {t.side}
                  </span>
                  <span className="flex-1 text-white/60 text-xs truncate">
                    {(t.question || '').slice(0, 26)}
                  </span>
                  <span className="shrink-0 text-white/80 text-xs font-semibold">
                    ${(t.size || 0).toFixed(0)}
                  </span>
                  {t.pnl !== undefined && (
                    <span className={`shrink-0 text-xs font-semibold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                    </span>
                  )}
                  <span className={`badge shrink-0 ${srcCls}`}>{srcLabel}</span>
                </div>

                {isCopy && traderAddr && (
                  <div className="flex items-center gap-1.5 mt-1 pl-14">
                    <span className="text-cyan-400/60 text-[9px]">↳ COPIED</span>
                    <span className="text-cyan-400 text-[9px] font-mono">{shortAddr(traderAddr)}</span>
                    <span className="text-white/20 text-[9px]">@ {Math.round((t.price || 0) * 100)}¢ {t.outcome}</span>
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
