export interface Portfolio {
  balance: number;
  equity: number;
  unrealisedPnl: number;
  realisedPnl: number;
  dailyPnl: number;
  totalTrades: number;
  winTrades: number;
  openPositions: number;
  winRate: number;
  isDemo: boolean;
  updatedAt: string;
}

export interface Position {
  token_id: string;
  market_id: string;
  question: string;
  outcome: 'YES' | 'NO';
  shares: number;
  avg_cost: number;
  current_price: number;
  unrealised_pnl: number;
  strategy: string;
  opened_at: string;
}

export interface Trade {
  side: 'BUY' | 'SELL';
  token_id: string;
  market_id: string;
  question: string;
  outcome: string;
  price: number;
  size: number;
  size_usd?: number;
  shares: number;
  pnl?: number;
  strategy: string;
  ts: string;
  demo?: boolean;
  exitReason?: string;
  traderAddress?: string;
}

export interface Signal {
  signal: 'BUY_YES' | 'BUY_NO' | 'SELL' | 'HOLD';
  tokenId: string;
  marketId: string;
  outcome: string;
  question: string;
  price: number;
  confidence: number;
  reason: string;
  strategyName: string;
}

export interface Market {
  conditionId: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  liquidity: number;
}

export interface LeaderEntry {
  rank: number;
  address: string;
  profit: number;
  positions: number;
}

export interface Trader {
  rank: number;
  address: string;
  profit: number;
  positions: number;
  trustScore: number;
  winRate: number;
  recentPnl: number;
  copyCount: number;
  isFollowed: boolean;
  lastAction?: string;
  lastMarket?: string;
}

export interface CopyTrade {
  traderAddress: string;
  traderRank: number;
  trustScore: number;
  question: string;
  outcome: 'YES' | 'NO';
  price: number;
  size: number;
  ts: string;
  tokenId: string;
  marketId: string;
}

export interface MarketEdge {
  conditionId: string;
  question: string;
  edgeScore: number;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  factors: {
    contrarian: number;
    volumeSpike: number;
    priceDrift: number;
    liquidity: number;
  };
}

export interface BotStatus {
  running: boolean;
  mode: 'demo' | 'live';
  strategy: string;
  strategies: string[];
  portfolio: Portfolio;
  positions: Position[];
  recentTrades: Trade[];
  signals: Signal[];
  markets: Market[];
  leaderboard: LeaderEntry[];
  traders: Trader[];
  copyTrades: CopyTrade[];
  edgeMarkets: MarketEdge[];
  hotTokens: number;
  restarts: number;
  updatedAt: string;
}

export type WsEvent =
  | { event: 'portfolio'; data: Portfolio }
  | { event: 'positions'; data: Position[] }
  | { event: 'trade'; data: Trade }
  | { event: 'signals'; data: Signal[] }
  | { event: 'markets'; data: Market[] }
  | { event: 'traders'; data: Trader[] }
  | { event: 'copy_trades'; data: CopyTrade[] }
  | { event: 'edge_markets'; data: MarketEdge[] };
