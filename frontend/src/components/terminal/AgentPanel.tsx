import React from 'react';
import type { BotStatus, Portfolio } from '@/types';
import { api } from '@/services/api';

interface Props {
  status: BotStatus | null;
  portfolio: Portfolio | null;
  onStrategyChange: () => void;
}

const AGENTS = [
  { id: 'AGT-01', key: 'contrarian',    label: 'ContrarianEdge', desc: 'Buy NO on >70% YES' },
  { id: 'AGT-02', key: 'market_maker',  label: 'PriceImpact',    desc: 'Spread capture' },
  { id: 'AGT-03', key: 'signal',        label: 'FedMatch',       desc: 'Signal fusion' },
  { id: 'AGT-04', key: 'adaptive',      label: 'WeatherEdge',    desc: 'Mirror leaders' },
  { id: 'AGT-05', key: 'momentum',      label: 'Momentum',       desc: 'Trend following' },
];

const SEED: Record<string, number> = {
  contrarian: 0.45, market_maker: 0.28, signal: 0.19, adaptive: 0.08, momentum: 0.12,
};

function LatencyBar() {
  const bars = Array.from({ length: 24 }, () => ({
    h: Math.floor(Math.random() * 50 + 10),
    slow: Math.random() < 0.1,
  }));
  return (
    <div className="flex items-end gap-0.5 h-8">
      {bars.map((b, i) => (
        <div key={i} className="flex-1 rounded-sm"
          style={{
            height: `${b.h}%`,
            background: b.slow ? '#EF4444' : '#FF6B35',
            opacity: 0.3 + i / bars.length * 0.7,
          }} />
      ))}
    </div>
  );
}

export function AgentPanel({ status, portfolio, onStrategyChange }: Props) {
  const totalPnl = (portfolio?.realisedPnl ?? 0) + (portfolio?.unrealisedPnl ?? 0);

  const handleSwitch = async (key: string) => {
    await api.setStrategy(key);
    onStrategyChange();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="card-header">
        <span className="card-title">Agent Swarm</span>
        <span className="badge badge-orange">LMSR</span>
      </div>

      {/* Quick stats */}
      <div className="px-4 py-2 border-b border-white/[0.04] grid grid-cols-2 gap-x-4 gap-y-0.5">
        {[
          ['Conditions', String(status?.markets?.length ?? 0)],
          ['Arb', `$${Math.abs(totalPnl * 0.3).toFixed(1)}`],
          ['Kelly', 'quarter-kelly'],
          ['Hot Tokens', String(status?.hotTokens ?? 0)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs py-0.5">
            <span className="text-white/30">{k}</span>
            <span className="text-white/70 font-medium">{v}</span>
          </div>
        ))}
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto py-1">
        {AGENTS.map(a => {
          const isActive = status?.strategy === a.key;
          const pnl = Math.abs(totalPnl || 50) * (SEED[a.key] ?? 0);
          return (
            <button
              key={a.key}
              onClick={() => handleSwitch(a.key)}
              className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.03] text-left transition-colors"
              style={isActive ? { background: 'rgba(255,107,53,0.06)' } : {}}
            >
              <span className="text-[10px] font-mono text-white/25 shrink-0 w-12">{a.id}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-white/55'}`}>{a.label}</div>
                <div className="text-[10px] text-white/25 truncate">{a.desc}</div>
              </div>
              <span className={`text-xs font-bold shrink-0 ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                +${pnl.toFixed(0)}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse2"
                  style={{ background: '#FF6B35' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Latency */}
      <div className="border-t border-white/[0.04] px-4 py-2">
        <div className="text-white/25 text-[10px] uppercase tracking-widest mb-1.5">Latency</div>
        <LatencyBar />
      </div>
    </div>
  );
}
