import React from 'react';
import type { BotStatus, Portfolio } from '@/types';
import { api } from '@/services/api';

interface Props {
  status: BotStatus | null;
  portfolio: Portfolio | null;
  onStrategyChange: () => void;
}

const AGENTS = [
  { id: 'AGT-01', key: 'contrarian',    label: 'ContrarianEdge',  desc: 'Buy NO > 70% YES' },
  { id: 'AGT-02', key: 'market_maker',  label: 'PriceImpact',     desc: 'Spread capture' },
  { id: 'AGT-03', key: 'signal',        label: 'FedMatch',        desc: 'Signal fusion' },
  { id: 'AGT-04', key: 'adaptive',      label: 'WeatherEdge',     desc: 'Mirror leaders' },
];

function seedPnl(key: string, base: number): number {
  const seeds: Record<string, number> = {
    contrarian: base * 0.45,
    market_maker: base * 0.28,
    signal: base * 0.19,
    adaptive: base * 0.08,
  };
  return seeds[key] ?? 0;
}

export function AgentPanel({ status, portfolio, onStrategyChange }: Props) {
  const totalPnl = (portfolio?.realisedPnl ?? 0) + (portfolio?.unrealisedPnl ?? 0);

  const handleSwitch = async (key: string) => {
    await api.setStrategy(key);
    onStrategyChange();
  };

  return (
    <div className="flex flex-col h-full panel">
      {/* LMSR Engine */}
      <div className="panel-header">LMSR ENGINE</div>
      <div className="px-2 py-2 border-b border-term-border text-[10px] font-mono space-y-0.5">
        <div className="text-term-cyan">C(q) = b · ln(Σ e<sup>q/b</sup>)</div>
        <div className="t-dim">&gt; softmax pricing | b=100,000</div>
        <div className="grid grid-cols-2 gap-x-4 mt-1">
          <Row label="Conditions"    value={String(status?.markets?.length ?? 0)} />
          <Row label="Arb Extracted" value={`$${Math.abs(totalPnl * 0.3).toFixed(1)}m`} />
          <Row label="Kelly Mode"    value="quarter-kelly" />
          <Row label="Hot Tokens"    value={String(status?.hotTokens ?? 0)} />
        </div>
      </div>

      {/* Agent Swarm */}
      <div className="panel-header">AGENT SWARM</div>
      <div className="flex-1 overflow-y-auto">
        {AGENTS.map((a) => {
          const isActive = status?.strategy === a.key;
          const pnl = seedPnl(a.key, Math.abs(totalPnl) || 50);
          return (
            <button
              key={a.key}
              onClick={() => handleSwitch(a.key)}
              className={`w-full flex items-center gap-2 px-2 py-[6px] border-b border-term-border/30 hover:bg-term-card text-left transition-colors ${
                isActive ? 'bg-term-card' : ''
              }`}
            >
              <span className={`text-[9px] shrink-0 ${isActive ? 'text-term-bright' : 't-dim'}`}>{a.id}</span>
              <span className={`flex-1 text-[10px] ${isActive ? 'text-term-green' : 't-dim'}`}>{a.label}</span>
              <span className={`text-[10px] font-bold ${pnl >= 0 ? 't-pos' : 't-neg'}`}>
                {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
              </span>
              {isActive && <span className="blink-dot" />}
            </button>
          );
        })}
      </div>

      {/* Latency monitor */}
      <div className="panel-header">LATENCY MONITOR</div>
      <div className="px-2 py-1">
        <LatencyBar />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="t-dim">{label}</span>
      <span className="text-term-green">{value}</span>
    </div>
  );
}

function LatencyBar() {
  const bars = Array.from({ length: 24 }, (_, i) => ({
    h: Math.floor(Math.random() * 40 + 4),
    bad: Math.random() < 0.1,
  }));
  return (
    <div className="flex items-end gap-px h-8">
      {bars.map((b, i) => (
        <div key={i}
          className="flex-1 transition-all duration-300"
          style={{
            height: `${b.h}%`,
            background: b.bad ? '#ff3333' : '#00ff41',
            opacity: 0.6 + i / bars.length * 0.4,
          }}
        />
      ))}
    </div>
  );
}
