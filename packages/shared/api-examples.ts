import type {
  DashboardResponse,
  TopCoinItem,
  TraderItem,
  CopySetupPayload,
  CopySetupResponse,
  CopyStats,
  TransactionLogPayload,
  TransactionsResponse,
} from './types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export async function getDashboard(wallet: string, force?: boolean): Promise<DashboardResponse> {
  const url = new URL(`${API_BASE_URL}/dashboard/${wallet}`);
  if (force) {
    url.searchParams.set('force', 'true');
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard: ${response.statusText}`);
  }
  return response.json();
}

export async function getTopCoins(limit: number = 20, search?: string): Promise<TopCoinItem[]> {
  const url = new URL(`${API_BASE_URL}/tokens/top`);
  url.searchParams.set('limit', limit.toString());
  if (search) {
    url.searchParams.set('search', search);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch top coins: ${response.statusText}`);
  }
  return response.json();
}

export async function getTopTraders(
  period: string = '7d',
  limit: number = 20,
  search?: string
): Promise<TraderItem[]> {
  const url = new URL(`${API_BASE_URL}/traders/top`);
  url.searchParams.set('period', period);
  url.searchParams.set('limit', limit.toString());
  if (search) {
    url.searchParams.set('search', search);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch top traders: ${response.statusText}`);
  }
  return response.json();
}

export async function createCopySetup(
  payload: CopySetupPayload,
  token: string
): Promise<CopySetupResponse> {
  const response = await fetch(`${API_BASE_URL}/copy/manual`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create copy setup: ${response.statusText}`);
  }
  return response.json();
}

export async function getCopyStats(wallet: string): Promise<CopyStats> {
  const response = await fetch(`${API_BASE_URL}/copy/stats/${wallet}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch copy stats: ${response.statusText}`);
  }
  return response.json();
}

export async function logTransaction(
  payload: TransactionLogPayload,
  token: string
): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/tx/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to log transaction: ${response.statusText}`);
  }
  return response.json();
}

export async function getTransactions(
  wallet: string,
  limit: number = 20,
  cursor?: string
): Promise<TransactionsResponse> {
  const url = new URL(`${API_BASE_URL}/txs/${wallet}`);
  url.searchParams.set('limit', limit.toString());
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch transactions: ${response.statusText}`);
  }
  return response.json();
}

export async function searchCoins(query: string, limit: number = 10): Promise<TopCoinItem[]> {
  const url = new URL(`${API_BASE_URL}/search/coins`);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', limit.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to search coins: ${response.statusText}`);
  }
  return response.json();
}

export async function searchTraders(query: string, limit: number = 10): Promise<TraderItem[]> {
  const url = new URL(`${API_BASE_URL}/search/traders`);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', limit.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to search traders: ${response.statusText}`);
  }
  return response.json();
}
