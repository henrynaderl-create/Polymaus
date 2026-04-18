import React from 'react';
import type { Trader, CopyTrade } from '@/types';

interface Props { traders: Trader[]; copyTrades: CopyTrade[] }

function shortAddr(addr: string) {
  if (!addr || addr.length <= 12) return addr;
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function fmtTime(ts: any) {
  try {
    const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch { return '--:--'; }
}

function TrustBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? '#10B981' : score >= 0.5 ? '#F59E0B' : '#EF4444';
  return (
    <div className="flex items-center gap-1.5 flex-1">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[9px] w-5 text-right font-medium" style={{ color }}>{pct}</span>
    </div>
  );
}

export function TopTraderPanel({ traders, copyTrades }: Props) {
  const displayed = traders.slice(0, 8);
  const followed  = traders.filter(t => t.isFollowed).length;

  return (
    <div className="flex flex-col h-full">
      <div className="card-header">
        <span className="card-title">Top Traders</span>
        <span className="badge badge-cyan">{followed} TRACKED</span>
      </div>

      {/* Trader list */}
      <div className="overflow-y-auto border-b border-white/[0.06]" style={{ maxHeight: '55%' }}>
        {displayed.length === 0 ? (
          <div className="px-4 py-3 text-white/20 text-xs text-center">Discovering traders...</div>
        ) : (
          displayed.map(t => {
            const isActive = (t as any).isActive !== false;
            return (
              <div
                key={t.address}
                className={`flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${
                  t.isFollowed ? 'bg-white/[0.02]' : ''
                }`}
              >
                {/* Active dot */}
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-emerald-400 animate-pulse2' : 'bg-white/20'}`} />

                {/* Rank */}
                <span className="text-[10px] text-white/30 w-5 shrink-0 font-mono">#{t.rank}</span>

                {/* Address */}
                <span className="text-xs font-mono text-white/70 w-20 shrink-0 truncate">
                  {shortAddr(t.address)}
                </span>

                {/* Trust bar */}
                <TrustBar score={t.trustScore} />

                {/* Profit */}
                <span className={`shrink-0 text-xs font-semibold ${t.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {t.profit >= 0 ? '+' : ''}${(t.profit / 1000).toFixed(1)}k
                </span>

                {/* Copy count */}
                {t.copyCount > 0 && (
                  <span className="badge badge-cyan shrink-0">{t.copyCount}x</span>
                )}
              </div>
            );
          })
        )}

        {/* Last actions */}
        {displayed.map(t => t.lastAction ? (
          <div key={`act-${t.address}`}
               className="flex items-center gap-2 px-4 py-1.5 border-b border-white/[0.03] text-[10px]">
            <span className="w-1.5 h-1.5 shrink-0" />
            <span className="w-5 shrink-0" />
            <span className="w-20 shrink-0 font-mono text-white/30">{shortAddr(t.address)}</span>
            <span
              className="shrink-0 font-bold"
              style={{
                color: t.lastAction?.includes('YES') ? '#10B981'
                  : t.lastAction?.includes('NO') ? '#EF4444'
                  : '#F59E0B',
              }}
            >
              {t.lastAction}
            </span>
            {t.lastMarket && (
              <span className="flex-1 truncate text-white/20 pl-1">
                {t.lastMarket.slice(0, 24)}
              </span>
            )}
          </div>
        ) : null)}
      </div>

      {/* Copy trades */}
      <div className="px-4 py-2 border-b border-white/[0.06]">
        <span className="text-white/30 text-[10px] uppercase tracking-widest font-medium">Copy Trades</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {copyTrades.length === 0 ? (
          <div className="px-4 py-3 text-white/20 text-xs text-center">Monitoring top traders...</div>
        ) : (
          copyTrades.slice(0, 12).map((ct, i) => (
            <div key={i}
                 className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] hover:bg-white/[0.02] text-xs">
              <span className="text-white/25 shrink-0 text-[10px] font-mono">{fmtTime(ct.ts)}</span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                style={{ background: 'rgba(34,211,238,0.12)', color: '#22D3EE' }}
              >
                #{ct.traderRank}
              </span>
              <span className="flex-1 text-white/50 truncate">{(ct.question || '').slice(0, 28)}</span>
              <span
                className="shrink-0 font-bold text-[10px]"
                style={{ color: ct.outcome === 'YES' ? '#10B981' : '#EF4444' }}
              >
                {ct.outcome}
              </span>
              <span className="shrink-0 text-white/40 text-[10px]">
                {Math.round(ct.price * 100)}¢
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
