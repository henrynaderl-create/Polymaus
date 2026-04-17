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
    <div className="bg-term-panel border border-term-border px-2 py-1 text-[10px] font-mono">
      <div className="text-term-bright">${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      <div className={pnl >= 0 ? 'text-term-green' : 'text-red-400'}>
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
        return {
          i,
          pnl: parseFloat(cum.toFixed(2)),
          equity: parseFloat((startBalance + cum).toFixed(2)),
          start: startBalance,
          label,
        };
      });

    // Genesis point
    const genesis = { i: -1, pnl: 0, equity: startBalance, start: startBalance, label: 'START' };
    const base = [genesis, ...pts];

    // Append a "live" point using current portfolio equity (includes unrealised PnL)
    if (portfolio?.equity && portfolio.equity !== startBalance) {
      const now = new Date();
      const label = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      base.push({
        i: base.length,
        pnl: parseFloat((portfolio.equity - startBalance).toFixed(2)),
        equity: parseFloat(portfolio.equity.toFixed(2)),
        start: startBalance,
        label,
      });
    }

    return base;
  }, [trades, startBalance, portfolio?.equity]);

  const latest = data[data.length - 1];
  const isPos = latest.pnl >= 0;
  const color = isPos ? '#00ff41' : '#ff3333';
  const liveEquity = portfolio?.equity ?? latest.equity;

  return (
    <div className="flex flex-col h-full panel">
      <div className="panel-header flex items-center justify-between">
        <span>EQUITY CURVE</span>
        <div className="flex items-center gap-3">
          <span className="text-term-dim text-[10px]">
            START ${startBalance.toLocaleString()}
          </span>
          <span className={`font-bold text-[13px] ${isPos ? 'text-term-green' : 'text-red-400'}`}>
            {isPos ? '▲' : '▼'} {isPos ? '+' : ''}${(liveEquity - startBalance).toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex-1 relative">
        {data.length < 2 ? (
          <div className="absolute inset-0 flex items-center justify-center text-term-dim text-[11px] tracking-widest animate-pulse">
            AWAITING FIRST TRADE...
          </div>
        ) : (
          <>
            {/* Live equity overlay */}
            <div className="absolute top-2 right-3 text-right z-10">
              <div className={`font-bold text-[15px] ${isPos ? 'text-term-green' : 'text-red-400'}`}
                   style={{ textShadow: `0 0 8px ${color}88` }}>
                ${liveEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              {portfolio && (
                <div className="text-term-dim text-[9px]">
                  {portfolio.openPositions} open · {portfolio.totalTrades} trades
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 16, right: 70, bottom: 16, left: 8 }}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: '#1a5c2a', fontSize: 9 }}
                  tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#1a5c2a', fontSize: 9 }} tickLine={false}
                  axisLine={false} tickFormatter={v => `$${v.toLocaleString()}`} width={62} />
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
