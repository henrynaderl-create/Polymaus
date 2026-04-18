import React, { useState } from 'react';
import type { BotStatus } from '@/types';

interface Props {
  status: BotStatus | null;
  activeView: string;
  onViewChange: (v: string) => void;
}

const NAV = [
  { id: 'home',      icon: '⊞', label: 'Dashboard' },
  { id: 'markets',   icon: '◈', label: 'Markets' },
  { id: 'positions', icon: '◉', label: 'Positions' },
  { id: 'traders',   icon: '◎', label: 'Top Traders' },
  { id: 'strategy',  icon: '◆', label: 'Strategy' },
  { id: 'analytics', icon: '▦', label: 'Analytics' },
];

const BOTTOM_NAV = [
  { id: 'settings', icon: '◈', label: 'Settings' },
];

export function Sidebar({ status, activeView, onViewChange }: Props) {
  const mode = status?.mode?.toUpperCase() ?? 'DEMO';
  const running = status?.running ?? false;

  return (
    <div
      className="w-[220px] shrink-0 flex flex-col h-full border-r border-white/[0.06]"
      style={{ background: 'linear-gradient(180deg, #0F0F16 0%, #0B0B0F 100%)' }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF4500, #FF8C00)' }}
          >
            P
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">Polymaus</div>
            <div className="text-white/30 text-[10px] font-medium tracking-wide">AI Trading</div>
          </div>
        </div>
      </div>

      {/* Status pill */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{
            background: running
              ? 'rgba(16,185,129,0.08)'
              : 'rgba(239,68,68,0.08)',
            border: `1px solid ${running ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${running ? 'bg-emerald-400 animate-pulse2' : 'bg-red-400'}`}
          />
          <span className={`text-xs font-semibold ${running ? 'text-emerald-400' : 'text-red-400'}`}>
            {running ? 'BOT RUNNING' : 'BOT STOPPED'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-2 px-1">
          <span className="text-white/30 text-[10px]">Mode:</span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              background: mode === 'LIVE' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
              color: mode === 'LIVE' ? '#EF4444' : '#F59E0B',
            }}
          >
            {mode}
          </span>
          {status?.strategy && (
            <span className="text-white/30 text-[10px] uppercase truncate">{status.strategy}</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`nav-item w-full text-left ${activeView === item.id ? 'active' : ''}`}
          >
            <span className="text-base leading-none w-5 text-center">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Quick stats */}
      <div className="px-4 py-3 mx-3 mb-3 rounded-xl border border-white/[0.06]"
           style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="text-white/30 text-[10px] font-medium tracking-widest uppercase mb-2">
          Quick Stats
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Open Pos.</span>
            <span className="text-white font-medium">{status?.portfolio?.openPositions ?? 0}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Win Rate</span>
            <span className="text-emerald-400 font-medium">
              {(status?.portfolio?.winRate ?? 0).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Hot Tokens</span>
            <span className="text-amber-400 font-medium">{status?.hotTokens ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="px-3 pb-4 space-y-0.5 border-t border-white/[0.06] pt-3">
        {BOTTOM_NAV.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`nav-item w-full text-left ${activeView === item.id ? 'active' : ''}`}
          >
            <span className="text-base leading-none w-5 text-center">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
