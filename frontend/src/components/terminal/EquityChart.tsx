import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { Trade, Portfolio } from '@/types';

interface Props {
  trades: Trade[];
  startBalance: number;
  portfolio?: Portfolio | null;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value as number;
  const pnl = v - (payload[0].payload?.start ?? v);
  return (
    <div className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs"
         style={{ background: '#1A1A26', backdropFilter: 'blur(8px)' }}>
      <div className="text-white font-semibold font-mono">${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      <div className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
      </div>
    </div>
  );
};

export function EquityChart({ trades, startBalance, portfolio }: Props) {
  const data = useMemo(() => {
    let cum = 0;
    const pts = trades
      .filter(t => t.side === 'SELL' && t.pnl !== undefined)
      .map((t, i) => {
        cum += t.pnl ?? 0;
        const ts = new Date(t.ts);
        const label = isNaN(ts.getTime())
          ? `T+${i}`
          : `${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}`;
        return { i, pnl: parseFloat(cum.toFixed(2)), equity: parseFloat((startBalance + cum).toFixed(2)), start: startBalance, label };
      });

    const genesis = { i: -1, pnl: 0, equity: startBalance, start: startBalance, label: 'START' };
    const base = [genesis, ...pts];

    if (portfolio?.equity && portfolio.equity !== startBalance) {
      const now = new Date();
      base.push({
        i: base.length,
        pnl: parseFloat((portfolio.equity - startBalance).toFixed(2)),
        equity: parseFloat(portfolio.equity.toFixed(2)),
        start: startBalance,
        label: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
      });
    }
    return base;
  }, [trades, startBalance, portfolio?.equity]);

  const latest  = data[data.length - 1];
  const isPos   = latest.pnl >= 0;
  const liveEq  = portfolio?.equity ?? latest.equity;
  const pnlAbs  = liveEq - startBalance;
  const pnlPct  = ((pnlAbs / startBalance) * 100).toFixed(2);

  return (
    <div className="flex flex-col h-full">
      <div className="card-header">
        <span className="card-title">Equity Curve</span>
        <div className="flex items-center gap-3">
          <span className="text-white/30 text-xs font-mono">
            Start ${startBalance.toLocaleString()}
          </span>
          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
            isPos ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
          }`}>
            {isPos ? '+' : ''}${pnlAbs.toFixed(2)} ({isPos ? '+' : ''}{pnlPct}%)
          </span>
          <span className="text-white font-bold text-base font-mono">
            ${liveEq.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="flex-1 relative px-2 pb-2 min-h-0">
        {data.length < 2 ? (
          <div className="absolute inset-0 flex items-center justify-center text-white/20 text-sm animate-pulse">
            Awaiting first trade...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="eqOrange" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#FF6B35" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#FF6B35" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="eqRed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#EF4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9 }}
                tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9 }}
                tickLine={false} axisLine={false}
                tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} width={48} />
              <ReferenceLine y={startBalance} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="equity"
                stroke={isPos ? '#FF6B35' : '#EF4444'} strokeWidth={2}
                fill={isPos ? 'url(#eqOrange)' : 'url(#eqRed)'} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
