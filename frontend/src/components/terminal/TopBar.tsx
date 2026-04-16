import React from 'react';
import { useClock } from '@/hooks/useClock';
import type { Portfolio, BotStatus } from '@/types';

interface Props {
  status: BotStatus | null;
  portfolio: Portfolio | null;
  connected: boolean;
}

export function TopBar({ status, portfolio, connected }: Props) {
  const { time, date } = useClock();
  const equity = portfolio?.equity ?? 0;
  const dailyPnl = portfolio?.dailyPnl ?? 0;
  const mode = status?.mode?.toUpperCase() ?? 'DEMO';

  return (
    <div className="flex items-center justify-between px-3 py-1.5 panel border-b border-term-border shrink-0">
      {/* Left: name */}
      <div className="flex items-center gap-3">
        <span className="text-term-bright font-bold tracking-widest text-[13px] text-glow">
          🐭 POLYMAUS
        </span>
        <span className="t-dim">// POLYMARKET TRADING TERMINAL</span>
        <span className="t-dim">// STRATEGY: {status?.strategy?.toUpperCase() ?? '—'}</span>
        <span className="t-dim">// {date}</span>
      </div>

      {/* Center: equity */}
      <div className="flex items-center gap-4 text-center">
        <div>
          <div className="t-label">PORTFOLIO VALUE</div>
          <div className="text-term-bright font-bold text-[18px] text-glow tracking-tight">
            ${equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className={`text-[13px] font-semibold ${dailyPnl >= 0 ? 't-pos' : 't-neg'}`}>
          {dailyPnl >= 0 ? '+' : ''}${dailyPnl.toFixed(2)} TODAY
        </div>
      </div>

      {/* Right: clock + mode */}
      <div className="flex items-center gap-4">
        <span className="text-term-dim text-[12px]">{time}</span>
        <span className={`text-[11px] font-bold tracking-widest px-2 py-0.5 border ${
          mode === 'LIVE'
            ? 'text-term-red border-term-red/50'
            : 'text-term-amber border-term-amber/50'
        }`}>
          ◉ MODE: {mode}
        </span>
        <div className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-term-bright animate-pulse2' : 'bg-term-red'}`} />
          <span className="t-dim">{connected ? 'LIVE' : 'POLLING'}</span>
        </div>
      </div>
    </div>
  );
}
