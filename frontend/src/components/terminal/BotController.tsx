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
    <div className="flex items-center gap-3 px-3 py-1 panel border-t border-term-border shrink-0 text-[10px]">
      <button onClick={toggle} disabled={busy}
        className={`px-3 py-1 border font-bold tracking-widest transition-colors ${
          running
            ? 'text-term-red border-term-red/50 hover:bg-term-red/10'
            : 'text-term-green border-term-green/50 hover:bg-term-green/10'
        } ${busy ? 'opacity-40 cursor-not-allowed' : ''}`}>
        {busy ? '...' : running ? '■ STOP BOT' : '▶ START BOT'}
      </button>

      <span className="t-dim">|</span>
      <span className="t-label">STRATEGY:</span>
      <span className="text-term-green font-bold">{(status?.strategy ?? '—').toUpperCase()}</span>

      <span className="t-dim">|</span>
      <span className="t-label">RESTARTS:</span>
      <span className="text-term-green">{status?.restarts ?? 0}</span>

      <span className="t-dim">|</span>
      <span className="t-label">HOT TOKENS:</span>
      <span className="text-term-amber">{status?.hotTokens ?? 0}</span>

      <span className="t-dim">|</span>
      <span className="t-label">OPEN POS:</span>
      <span className="text-term-green">{status?.portfolio?.openPositions ?? 0}</span>

      <div className="ml-auto t-dim">
        polymaus v1.0 // {status?.mode === 'demo' ? '🟡 DEMO — no real capital' : '🔴 LIVE'}
      </div>
    </div>
  );
}
