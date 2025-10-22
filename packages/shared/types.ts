export interface TokenItem {
  mint: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  price_usd: number;
  price_change_24h: number;
  usd_value: number;
}

export interface DashboardResponse {
  wallet: string;
  network: string;
  total_usd: number;
  daily_pnl: number;
  daily_pnl_percent: number;
  period: string;
  tokens: TokenItem[];
  quick_actions: string[];
  last_updated: string;
}

export interface TopCoinItem {
  mint: string;
  symbol: string;
  name: string;
  price_usd: number;
  change_24h: number;
  market_cap: number;
  icon?: string;
}

export interface TraderItem {
  username: string;
  wallet: string;
  avatarUrl?: string;
  verified: boolean;
  return_percent: number;
  period: string;
  copy_action_available: boolean;
}

export interface CopySetupPayload {
  targetWallet: string;
  managerWallet: string;
  totalAmountUsd: number;
  amountPerTradeUsd: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  autoExecute?: boolean;
}

export interface CopySetupResponse {
  id: number;
  managerWallet: string;
  targetWallet: string;
  totalAmountUsd: number;
  amountPerTradeUsd: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  autoExecute: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CopyStats {
  activeCopies: number;
  totalTrades: number;
  pnl_usd: number;
  data_mode?: string;
}

export interface TransactionLogPayload {
  txSignature: string;
  metadata?: Record<string, any>;
}

export interface TransactionItem {
  signature: string;
  blockTime: number | null;
  slot: number;
  err: any;
  memo: string | null;
  parsed: {
    fee?: number;
    status: string;
  } | null;
}

export interface TransactionsResponse {
  transactions: TransactionItem[];
  cursor: string | null;
}

export interface MarketTokenItem {
  mint: string;
  symbol: string;
  name: string;
  icon?: string;
  price_usd: number;
  change_24h: number;
  market_cap: number;
  liquidity_est_usd: number;
  age_hours: number;
  tx_count_24h: number;
  rugScore: number;
  source: string;
}

export interface MarketListResponse {
  items: MarketTokenItem[];
  total: number;
}

export interface LiquidityPool {
  dex: string;
  pool: string;
  liquidity_usd: number;
}

export interface BuyOption {
  type: 'jupiter_route' | 'webview';
  routeId?: string;
  estimatedPriceImpact?: number;
  estimatedSlippage?: number;
  serializedTxBase64?: string | null;
  url?: string;
}

export interface TokenDetail {
  mint: string;
  symbol: string;
  name: string;
  icon?: string;
  price_usd: number;
  market_cap: number;
  liquidity_pools: LiquidityPool[];
  holders_est: number;
  age_hours: number;
  rugScore: number;
  safeToBuy: boolean;
  buyOptions: BuyOption[];
}

export interface RugCheckReason {
  code: string;
  severity: 'low' | 'medium' | 'high';
  detail: string;
}

export interface RugCheckResult {
  mint: string;
  rugScore: number;
  safeToBuy: boolean;
  reasons: RugCheckReason[];
}

export interface FiltersMeta {
  liquidity: {
    min: number;
    p10: number;
    p50: number;
    p90: number;
    max: number;
  };
  marketCap: {
    min: number;
    p10: number;
    p50: number;
    p90: number;
    max: number;
  };
  age: {
    min: number;
    p10: number;
    p50: number;
    p90: number;
    max: number;
  };
}

export interface BuyPayloadRequest {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  slippage: number;
  wallet?: string;
  preferDirect?: boolean;
}

export interface BuyPayloadResponse {
  ok: boolean;
  route: {
    provider: string;
    estimatedOut: string;
    priceImpact: number;
    serializedTransactionBase64: string | null;
  } | null;
  warnings: string[];
  fallback: {
    url: string;
    notes: string;
  } | null;
}

export interface TokenReportPayload {
  mint: string;
  reason: string;
  details?: string;
  reporterWallet?: string;
}
