import React, { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import type { Market, Signal, MarketEdge } from '@/types';

interface Props {
  markets: Market[];
  signals: Signal[];
  edgeMarkets?: MarketEdge[];
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={`url(#sg-${color.replace('#','')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function genHistory(seed: number): number[] {
  let v = 0.3 + (seed % 5) * 0.1;
  return Array.from({ length: 20 }, () => {
    v = Math.max(0.02, Math.min(0.98, v + (Math.random() - 0.48) * 0.04));
    return v;
  });
}

export function MarketGrid({ markets, signals, edgeMarkets = [] }: Props) {
  const items = markets.slice(0, 6);

  const signalMap = useMemo(() => {
    const m: Record<string, Signal> = {};
    for (const s of signals) m[s.marketId] = s;
    return m;
  }, [signals]);

  const edgeMap = useMemo(() => {
    const m: Record<string, MarketEdge> = {};
    for (const e of edgeMarkets) m[e.conditionId] = e;
    return m;
  }, [edgeMarkets]);

  return (
    <div className="flex flex-col h-full">
      <div className="card-header">
        <span className="card-title">Market Opportunities</span>
        <span className="badge badge-muted">{items.length} ACTIVE</span>
      </div>
      <div className="flex-1 grid grid-cols-3 gap-px bg-white/[0.04] overflow-hidden">
        {items.map((mkt, i) => {
          const sig  = signalMap[mkt.conditionId];
          const edge = edgeMap[mkt.conditionId];
          const history = genHistory(i + (mkt.yesPrice * 100 | 0));
          const positive  = mkt.yesPrice > 0.5;
          const pct       = Math.round(mkt.yesPrice * 100);
          const edgeScore = edge?.edgeScore ?? null;
          const color     = positive ? '#FF6B35' : '#EF4444';

          return (
            <div key={mkt.conditionId}
                 className="flex flex-col px-3 pt-3 pb-2 gap-1"
                 style={{ background: '#16161F' }}>
              {/* Title + signal */}
              <div className="flex items-start justify-between gap-1">
                <span className="text-white/80 text-xs leading-tight line-clamp-2 flex-1">
                  {(mkt.question || '').slice(0, 55)}
                </span>
                {sig && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      background: sig.signal.includes('NO') ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                      color: sig.signal.includes('NO') ? '#EF4444' : '#10B981',
                    }}
                  >
                    {sig.signal.includes('NO') ? '▼ NO' : '▲ YES'}
                  </span>
                )}
              </div>

              {/* Sparkline */}
              <Sparkline data={history} color={color} />

              {/* Stats */}
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-bold"
                  style={{
                    color: edgeScore !== null
                      ? (edgeScore >= 0.30 ? '#10B981' : edgeScore >= 0.15 ? '#F59E0B' : '#EF4444')
                      : (positive ? '#FF6B35' : '#EF4444'),
                  }}
                >
                  {edgeScore !== null
                    ? `${(edgeScore * 100).toFixed(1)}% EDGE`
                    : `${positive ? '+' : ''}${(pct - 50).toFixed(1)}% EDGE`}
                </span>
                <span className="text-white/30 text-[10px]">YES {pct}¢</span>
                <span className="text-white/30 text-[10px]">
                  ${mkt.volume24h >= 1000 ? `${(mkt.volume24h/1000).toFixed(0)}k` : mkt.volume24h.toFixed(0)}
                </span>
              </div>

              {/* Confidence bar */}
              {sig && (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-0.5 rounded-full overflow-hidden"
                       style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full"
                         style={{ width: `${sig.confidence * 100}%`, background: color }} />
                  </div>
                  <span className="text-[9px] text-white/30">{(sig.confidence * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          );
        })}

        {Array.from({ length: Math.max(0, 6 - items.length) }).map((_, i) => (
          <div key={`empty-${i}`}
               className="flex items-center justify-center text-white/20 text-xs"
               style={{ background: '#16161F' }}>
            Scanning markets...
          </div>
        ))}
      </div>
    </div>
  );
}
