import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart2 } from 'lucide-react';
import type { Trade } from '@/types';

interface Props { trades: Trade[] }

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value as number;
  return (
    <div className="bg-surface-3 border border-white/10 rounded-lg p-2 text-xs font-mono">
      <span className={v >= 0 ? 'text-success' : 'text-danger'}>
        ${v >= 0 ? '+' : ''}{v.toFixed(2)}
      </span>
    </div>
  );
};

export function PnLChart({ trades }: Props) {
  const data = useMemo(() => {
    let cumPnl = 0;
    return trades
      .filter(t => t.side === 'SELL' && t.pnl !== undefined)
      .slice(-60)
      .map((t, i) => {
        cumPnl += t.pnl ?? 0;
        return {
          i,
          pnl: parseFloat(cumPnl.toFixed(2)),
          ts: new Date(t.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        };
      });
  }, [trades]);

  const isPositive = data.length === 0 || data[data.length - 1]?.pnl >= 0;

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center">
          <BarChart2 className="w-4 h-4 text-brand" />
        </div>
        <span className="font-semibold text-white">Cumulative P&L</span>
        {data.length > 0 && (
          <span className={`ml-auto text-sm font-mono ${isPositive ? 'text-success' : 'text-danger'}`}>
            {isPositive ? '+' : ''}${data[data.length - 1]?.pnl.toFixed(2)}
          </span>
        )}
      </div>

      {data.length < 2 ? (
        <div className="h-40 flex items-center justify-center text-muted text-sm">
          Waiting for trades…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="ts" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={50} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke={isPositive ? '#10b981' : '#ef4444'}
              strokeWidth={2}
              fill="url(#pnlGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
