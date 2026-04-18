import React from 'react';
import { useClock } from '@/hooks/useClock';
import type { Portfolio, BotStatus } from '@/types';

interface Props {
  status: BotStatus | null;
  portfolio: Portfolio | null;
  connected: boolean;
}

export function DashTopBar({ status, portfolio, connected }: Props) {
  const { time, date } = useClock();
  const dailyPnl = portfolio?.dailyPnl ?? 0;

  return (
    <div
      className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-white/[0.06]"
      style={{ background: 'rgba(11,11,15,0.95)', backdropFilter: 'blur(12px)' }}
    >
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-white/30">Dashboard</span>
        <span className="text-white/15">/</span>
        <span className="text-white font-medium">Overview</span>
      </div>

      {/* Center: daily pnl highlight */}
      <div className="flex items-center gap-2">
        <span className="text-white/40 text-xs font-medium">Today</span>
        <span
          className={`text-sm font-bold px-3 py-1 rounded-lg ${
            dailyPnl >= 0
              ? 'text-emerald-400 bg-emerald-500/10'
              : 'text-red-400 bg-red-500/10'
          }`}
        >
          {dailyPnl >= 0 ? '+' : ''}${dailyPnl.toFixed(2)}
        </span>
      </div>

      {/* Right: time + connection */}
      <div className="flex items-center gap-4">
        <span className="text-white/30 text-xs font-mono">{time}</span>
        <span className="text-white/30 text-xs hidden lg:block">{date}</span>

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? 'bg-emerald-400 animate-pulse2' : 'bg-amber-400'}`} />
          <span className="text-xs font-medium text-white/50">{connected ? 'LIVE' : 'POLLING'}</span>
        </div>

        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #FF4500, #FF8C00)' }}
        >
          AI
        </div>
      </div>
    </div>
  );
}

export function TopBar(props: Props) {
  return <DashTopBar {...props} />;
}
