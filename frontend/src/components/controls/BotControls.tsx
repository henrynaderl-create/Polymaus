import React, { useState } from 'react';
import { Play, Square, Settings2, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';
import type { BotStatus } from '@/types';
import clsx from 'clsx';

interface Props {
  status: BotStatus | null;
  connected: boolean;
  onRefresh: () => void;
}

const STRATEGY_LABELS: Record<string, { label: string; desc: string }> = {
  contrarian: { label: 'Contrarian', desc: 'Buy NO when YES > 70%' },
  market_maker: { label: 'Market Maker', desc: 'Two-sided spread capture' },
  signal: { label: 'Signal Fusion', desc: 'Multi-signal consensus' },
  adaptive: { label: 'Adaptive', desc: 'Mirror leaderboard winners' },
};

export function BotControls({ status, connected, onRefresh }: Props) {
  const [loading, setLoading] = useState(false);
  const running = status?.running ?? false;

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (running) await api.stopBot();
      else await api.startBot();
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handleStrategy = async (s: string) => {
    await api.setStrategy(s);
    onRefresh();
  };

  return (
    <div className="card p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center">
          <Settings2 className="w-4 h-4 text-brand" />
        </div>
        <span className="font-semibold text-white">Bot Controls</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs">
          {connected
            ? <><Wifi className="w-3 h-3 text-success" /><span className="text-success">Connected</span></>
            : <><WifiOff className="w-3 h-3 text-muted" /><span className="text-muted">Polling</span></>
          }
        </span>
      </div>

      {/* Mode badge */}
      <div className="flex items-center gap-2">
        <span className={clsx(
          'text-xs font-bold px-3 py-1.5 rounded-full',
          status?.mode === 'demo' ? 'bg-warn/20 text-warn border border-warn/30' : 'bg-danger/20 text-danger border border-danger/30'
        )}>
          {status?.mode?.toUpperCase() ?? 'DEMO'} MODE
        </span>
        {running && (
          <span className="flex items-center gap-1 text-xs text-success">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse2" />
            Running
          </span>
        )}
      </div>

      {/* Start / Stop button */}
      <button
        onClick={handleToggle}
        disabled={loading}
        className={clsx(
          'flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all',
          running
            ? 'bg-danger/20 hover:bg-danger/30 text-danger border border-danger/30'
            : 'bg-success/20 hover:bg-success/30 text-success border border-success/30',
          loading && 'opacity-50 cursor-not-allowed'
        )}
      >
        {loading ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : running ? (
          <><Square className="w-4 h-4" /> Stop Bot</>
        ) : (
          <><Play className="w-4 h-4" /> Start Bot</>
        )}
      </button>

      {/* Strategy selector */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted uppercase tracking-widest">Strategy</span>
        <div className="grid grid-cols-2 gap-2">
          {(status?.strategies ?? Object.keys(STRATEGY_LABELS)).map(s => {
            const info = STRATEGY_LABELS[s] ?? { label: s, desc: '' };
            const active = status?.strategy === s;
            return (
              <button
                key={s}
                onClick={() => handleStrategy(s)}
                className={clsx(
                  'flex flex-col gap-0.5 p-2.5 rounded-xl border text-left transition-all text-xs',
                  active
                    ? 'bg-brand/20 border-brand/50 text-brand'
                    : 'bg-surface-2 border-white/5 text-white/60 hover:border-white/20'
                )}
              >
                <span className="font-semibold">{info.label}</span>
                <span className="text-[10px] opacity-70">{info.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      {status && (
        <div className="grid grid-cols-2 gap-2 text-xs text-muted">
          <span>Restarts: <span className="text-white font-mono">{status.restarts}</span></span>
          <span>Hot tokens: <span className="text-warn font-mono">{status.hotTokens}</span></span>
        </div>
      )}
    </div>
  );
}
