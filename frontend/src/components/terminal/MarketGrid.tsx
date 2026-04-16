import React, { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import type { Market, Signal } from '@/types';

interface Props {
  markets: Market[];
  signals: Signal[];
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`sg${positive}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={positive ? '#00ff41' : '#ff3333'} stopOpacity={0.3} />
            <stop offset="95%" stopColor={positive ? '#00ff41' : '#ff3333'} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={positive ? '#00ff41' : '#ff3333'}
          strokeWidth={1} fill={`url(#sg${positive})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function genHistory(seed: number, len = 20): number[] {
  let v = 0.3 + (seed % 5) * 0.1;
  return Array.from({ length: len }, () => {
    v = Math.max(0.02, Math.min(0.98, v + (Math.random() - 0.48) * 0.04));
    return v;
  });
}

function dayLabel(i: number) {
  return `DAY ${i + 1}`;
}

export function MarketGrid({ markets, signals }: Props) {
  const items = markets.slice(0, 6);

  const signalMap = useMemo(() => {
    const m: Record<string, Signal> = {};
    for (const s of signals) m[s.marketId] = s;
    return m;
  }, [signals]);

  return (
    <div className="grid grid-cols-3 gap-px h-full bg-term-border">
      {items.map((mkt, i) => {
        const sig = signalMap[mkt.conditionId];
        const history = genHistory(i + (mkt.yesPrice * 100 | 0));
        const positive = mkt.yesPrice > 0.5;
        const pct = Math.round(mkt.yesPrice * 100);
        const vol = mkt.volume24h;

        return (
          <div key={mkt.conditionId} className="bg-term-card flex flex-col px-2 pt-2 pb-1 gap-1">
            {/* Title */}
            <div className="flex items-start justify-between gap-1">
              <span className="text-term-green text-[10px] leading-tight line-clamp-2 flex-1">
                {dayLabel(i)} // {(mkt.question || '').slice(0, 45)}
              </span>
              {sig && (
                <span className={`text-[9px] border px-1 shrink-0 ${
                  sig.signal.includes('NO') ? 'text-term-red border-term-red/40' : 'text-term-green border-term-green/40'
                }`}>
                  {sig.signal.includes('NO') ? '▼ NO' : '▲ YES'}
                </span>
              )}
            </div>

            {/* Sparkline */}
            <Sparkline data={history} positive={positive} />

            {/* Stats row */}
            <div className="flex items-center justify-between text-[10px]">
              <span className={`font-bold ${positive ? 't-pos' : 't-neg'}`}>
                {positive ? '+' : ''}{(pct - 50).toFixed(1)}% EDGE
              </span>
              <span className="t-dim">YES {pct}¢</span>
              <span className="t-dim">VOL ${(vol / 1000).toFixed(0)}k</span>
            </div>

            {/* Signal confidence */}
            {sig && (
              <div className="flex items-center gap-1">
                <div className="flex-1 h-0.5 bg-term-border overflow-hidden rounded">
                  <div className="h-full bg-term-green" style={{ width: `${sig.confidence * 100}%` }} />
                </div>
                <span className="text-[9px] t-dim">{(sig.confidence * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        );
      })}

      {/* Fill empty slots */}
      {Array.from({ length: Math.max(0, 6 - items.length) }).map((_, i) => (
        <div key={`empty-${i}`} className="bg-term-card flex items-center justify-center t-dim text-[10px]">
          SCANNING...
        </div>
      ))}
    </div>
  );
}
