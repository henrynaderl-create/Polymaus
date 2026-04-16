import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { Trade } from '@/types';

interface Props { trades: Trade[]; startBalance: number }

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value as number;
  return (
    <div className="bg-term-panel border border-term-border px-2 py-1 text-[10px] font-mono">
      <span className={v >= 0 ? 't-pos' : 't-neg'}>
        {v >= 0 ? '+' : ''}${v.toFixed(2)}
      </span>
    </div>
  );
};

export function EquityChart({ trades, startBalance }: Props) {
  const data = useMemo(() => {
    let cum = 0;
    const pts = trades
      .filter(t => t.side === 'SELL' && t.pnl !== undefined)
      .map((t, i) => {
        cum += t.pnl ?? 0;
        const ts = new Date(t.ts);
        return {
          i,
          pnl: parseFloat(cum.toFixed(2)),
          equity: parseFloat((startBalance + cum).toFixed(2)),
          label: `${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}`,
        };
      });
    // Seed a genesis point
    return [{ i: -1, pnl: 0, equity: startBalance, label: 'GENESIS' }, ...pts];
  }, [trades, startBalance]);

  const isPos = data.length > 1 && data[data.length - 1].pnl >= 0;
  const color = isPos ? '#00ff41' : '#ff3333';
  const latest = data[data.length - 1];

  return (
    <div className="flex flex-col h-full panel">
      <div className="panel-header flex items-center justify-between">
        <span>POLYMAUS // EQUITY CURVE // LINE FEED</span>
        <span className="text-term-bright">● GENESIS ${startBalance.toLocaleString()}</span>
      </div>

      <div className="flex-1 relative">
        {data.length < 2 ? (
          <div className="absolute inset-0 flex items-center justify-center t-dim text-[11px] tracking-widest">
            AWAITING FIRST CLOSED POSITION...
          </div>
        ) : (
          <>
            {/* Current equity overlay */}
            <div className="absolute top-2 right-3 text-right z-10">
              <div className="text-term-bright font-bold text-[16px] text-glow">
                ${latest.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 16, right: 60, bottom: 16, left: 8 }}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: '#1a5c2a', fontSize: 9 }}
                  tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#1a5c2a', fontSize: 9 }} tickLine={false}
                  axisLine={false} tickFormatter={v => `$${v.toLocaleString()}`} width={60} />
                <ReferenceLine y={startBalance} stroke="#0d2e12" strokeDasharray="4 4" />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="equity" stroke={color} strokeWidth={1.5}
                  fill="url(#eqGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  );
}
