import React, { useEffect, useState } from 'react';
import { Trophy, Flame } from 'lucide-react';
import { api } from '@/services/api';
import type { LeaderEntry } from '@/types';

interface Props {
  leaders: LeaderEntry[];
  hotTokens: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function LeaderboardCard({ leaders, hotTokens }: Props) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center">
          <Trophy className="w-4 h-4 text-brand" />
        </div>
        <span className="font-semibold text-white">Leaderboard</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-warn">
          <Flame className="w-3 h-3" />
          {hotTokens} hot tokens
        </span>
      </div>

      {leaders.length === 0 ? (
        <div className="py-6 text-center text-muted text-sm">Fetching top traders…</div>
      ) : (
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto scrollbar-thin">
          {leaders.map(l => (
            <div
              key={l.address}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-2 border border-white/5"
            >
              <span className="w-6 text-base">{MEDALS[l.rank - 1] ?? `#${l.rank}`}</span>
              <span className="flex-1 font-mono text-xs text-white/70 truncate">{l.address}</span>
              <div className="flex flex-col items-end">
                <span className={`text-xs font-mono font-semibold ${l.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                  {l.profit >= 0 ? '+' : ''}${l.profit.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted">{l.positions} pos.</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
