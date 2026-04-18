import React, { useState } from 'react';
import { api } from '@/services/api';
import type { BotStatus } from '@/types';

interface Props { status: BotStatus | null; onRefresh: () => void }

export function BotController({ status, onRefresh }: Props) {
  const [busy, setBusy] = useState(false);
  const running = status?.running ?? false;

  const toggle = async () => {
    setBusy(true);
    try {
      if (running) await api.stopBot(); else await api.startBot();
      onRefresh();
    } finally { setBusy(false); }
  };

  return (
    <div
      className="h-12 shrink-0 flex items-center gap-4 px-6 border-t border-white/[0.06]"
      style={{ background: '#0F0F16' }}
    >
      <button
        onClick={toggle}
        disabled={busy}
        className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-40"
        style={{
          background: running
            ? 'rgba(239,68,68,0.12)'
            : 'linear-gradient(135deg, #FF4500, #FF8C00)',
          border: running ? '1px solid rgba(239,68,68,0.25)' : 'none',
          color: running ? '#EF4444' : '#fff',
          boxShadow: running ? 'none' : '0 0 16px rgba(255,107,53,0.25)',
        }}
      >
        <span>{running ? '■' : '▶'}</span>
        <span>{busy ? 'Updating...' : running ? 'Stop Bot' : 'Start Bot'}</span>
      </button>

      <div className="w-px h-5 bg-white/[0.06]" />
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-white/30">Strategy</span>
        <span className="text-white font-medium uppercase">{status?.strategy ?? '—'}</span>
      </div>

      <div className="w-px h-5 bg-white/[0.06]" />
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-white/30">Restarts</span>
        <span className="text-white font-medium">{status?.restarts ?? 0}</span>
      </div>

      <div className="w-px h-5 bg-white/[0.06]" />
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-white/30">Open Pos.</span>
        <span className="text-emerald-400 font-medium">{status?.portfolio?.openPositions ?? 0}</span>
      </div>

      <div className="ml-auto flex items-center gap-2 text-xs text-white/30">
        <span>Polymaus v1.0</span>
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
          style={{
            background: status?.mode === 'demo' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
            color: status?.mode === 'demo' ? '#F59E0B' : '#EF4444',
          }}
        >
          {status?.mode === 'demo' ? 'DEMO' : 'LIVE'}
        </span>
      </div>
    </div>
  );
}
