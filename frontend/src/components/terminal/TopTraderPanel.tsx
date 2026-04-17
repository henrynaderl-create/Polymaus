import React from 'react';
import type { Trader, CopyTrade } from '@/types';

interface Props {
  traders: Trader[];
  copyTrades: CopyTrade[];
}

function TrustBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? '#00ff41' : score >= 0.5 ? '#ffaa00' : '#ff3333';
  return (
    <div className="flex items-center gap-1.5 flex-1">
      <div className="flex-1 h-1 bg-term-border overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[9px] w-6 text-right" style={{ color }}>{pct}</span>
    </div>
  );
}

function shortAddr(addr: string) {
  if (!addr || addr.length <= 12) return addr;
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch { return '--:--'; }
}

export function TopTraderPanel({ traders, copyTrades }: Props) {
  const followed = traders.filter(t => t.isFollowed);
  const displayed = traders.slice(0, 8);

  return (
    <div className="flex flex-col h-full panel">
      {/* ── Header ── */}
      <div className="panel-header flex items-center justify-between">
        <span>TOP TRADERS</span>
        <span className="text-term-cyan font-bold">
          {followed.length} FOLLOWED
        </span>
      </div>

      {/* ── Trader list ── */}
      <div className="overflow-y-auto" style={{ maxHeight: '55%' }}>
        {displayed.length === 0 ? (
          <div className="px-2 py-2 t-dim text-[10px]">FETCHING LEADERBOARD...</div>
        ) : (
          displayed.map(t => (
            <div
              key={t.address}
              className={`flex items-center gap-1.5 px-2 py-[4px] border-b border-term-border/30 text-[10px] ${
                t.isFollowed ? 'bg-term-card' : ''
              }`}
            >
              {/* Rank */}
              <span className={`w-5 shrink-0 text-[9px] ${t.isFollowed ? 'text-term-bright' : 't-dim'}`}>
                #{t.rank}
              </span>

              {/* Address */}
              <span className={`w-16 shrink-0 font-mono truncate ${t.isFollowed ? 'text-term-green' : 't-dim'}`}>
                {shortAddr(t.address)}
              </span>

              {/* Trust bar */}
              <TrustBar score={t.trustScore} />

              {/* P&L */}
              <span className={`shrink-0 w-14 text-right font-bold ${t.profit >= 0 ? 't-pos' : 't-neg'}`}>
                {t.profit >= 0 ? '+' : ''}${(t.profit / 1000).toFixed(1)}k
              </span>

              {/* Copy count badge */}
              {t.copyCount > 0 && (
                <span className="shrink-0 text-[9px] text-term-cyan border border-term-cyan/40 px-1">
                  {t.copyCount}×
                </span>
              )}

              {/* Follow dot */}
              {t.isFollowed && <span className="blink-dot shrink-0" />}
            </div>
          ))
        )}

        {/* Last action row */}
        {displayed.map(t => t.lastAction ? (
          <div
            key={`act-${t.address}`}
            className="flex items-center gap-1.5 px-2 py-[2px] border-b border-term-border/20 text-[9px] t-dim"
          >
            <span className="w-5 shrink-0" />
            <span className="w-16 shrink-0 font-mono">{shortAddr(t.address)}</span>
            <span className={`shrink-0 font-bold ${t.lastAction?.includes('YES') ? 'text-term-green' : t.lastAction?.includes('NO') ? 'text-term-red' : 'text-term-amber'}`}>
              {t.lastAction}
            </span>
            {t.lastMarket && (
              <span className="flex-1 truncate opacity-60 pl-1">{t.lastMarket.slice(0, 24)}</span>
            )}
          </div>
        ) : null
        )}
      </div>

      {/* ── Recent copy trades ── */}
      <div className="panel-header">COPY TRADES // LIVE</div>
      <div className="flex-1 overflow-y-auto">
        {copyTrades.length === 0 ? (
          <div className="px-2 py-1.5 t-dim text-[10px]">MONITORING TOP TRADERS...</div>
        ) : (
          copyTrades.slice(0, 12).map((ct, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-2 py-[3px] border-b border-term-border/20 text-[10px] animate-scroll"
            >
              <span className="t-dim shrink-0 w-8">{fmtTime(ct.ts)}</span>
              <span className="text-term-cyan shrink-0 text-[9px] border border-term-cyan/40 px-1">
                #{ct.traderRank}
              </span>
              <span className="flex-1 t-dim truncate">{(ct.question || '').slice(0, 28)}…</span>
              <span className={`shrink-0 font-bold ${ct.outcome === 'YES' ? 't-pos' : 't-neg'}`}>
                {ct.outcome}
              </span>
              <span className="shrink-0 text-term-green w-8 text-right">
                {Math.round(ct.price * 100)}¢
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
