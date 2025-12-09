/**
 * Test Helpers - Comprehensive utilities for integration testing
 */

import fetch from 'node-fetch';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// Constants
export const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
export const TRPC_URL = `${BASE_URL}/api/trpc`;
export const TEST_TIMEOUT = parseInt(process.env.TEST_TIMEOUT || '30000');
export const MOCK_WALLET_ADDRESS = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';

// Test user tracking for cleanup
const createdTestUsers: string[] = [];

/**
 * Make a tRPC request
 */
export async function trpcRequest<T = any>(
  procedure: string,
  input: any = {},
  token?: string
): Promise<T> {
  const url = `${TRPC_URL}/${procedure}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ json: input }),
  });
  
  const data = await response.json() as any;
  
  if (!response.ok || data.error) {
    const error = new Error(data.error?.message || `${procedure} failed: ${JSON.stringify(data)}`);
    (error as any).code = data.error?.data?.code || response.status;
    (error as any).data = data;
    throw error;
  }
  
  return data.result?.data || data;
}

/**
 * Make a tRPC query request (GET-style)
 */
export async function trpcQuery<T = any>(
  procedure: string,
  input: any = {},
  token?: string
): Promise<T> {
  const inputStr = encodeURIComponent(JSON.stringify({ json: input }));
  const url = `${TRPC_URL}/${procedure}?input=${inputStr}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });
  
  const data = await response.json() as any;
  
  if (!response.ok || data.error) {
    const error = new Error(data.error?.message || `${procedure} failed`);
    (error as any).code = data.error?.data?.code || response.status;
    (error as any).data = data;
    throw error;
  }
  
  return data.result?.data || data;
}


/**
 * Create a test user and return credentials with token
 */
export async function createTestUser(
  email?: string,
  password?: string
): Promise<{ email: string; password: string; token: string; refreshToken: string; userId: string }> {
  const testEmail = email || `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const testPassword = password || 'TestPassword123!';
  
  try {
    const result = await trpcRequest('auth.signup', {
      email: testEmail,
      password: testPassword,
      confirmPassword: testPassword,
    });
    
    createdTestUsers.push(testEmail);
    
    return {
      email: testEmail,
      password: testPassword,
      token: result.token,
      refreshToken: result.refreshToken,
      userId: result.user?.id,
    };
  } catch (error: any) {
    // If user already exists, try to login
    if (error.message?.includes('already exists') || error.code === 'CONFLICT') {
      const loginResult = await trpcRequest('auth.login', {
        email: testEmail,
        password: testPassword,
      });
      
      return {
        email: testEmail,
        password: testPassword,
        token: loginResult.token,
        refreshToken: loginResult.refreshToken,
        userId: loginResult.user?.id,
      };
    }
    throw error;
  }
}

/**
 * Cleanup test user by email
 */
export async function cleanupTestUser(email: string): Promise<void> {
  // Note: In a real implementation, this would call an admin endpoint
  // or directly delete from database. For now, we track for manual cleanup.
  const index = createdTestUsers.indexOf(email);
  if (index > -1) {
    createdTestUsers.splice(index, 1);
  }
}

/**
 * Get all created test users for cleanup
 */
export function getCreatedTestUsers(): string[] {
  return [...createdTestUsers];
}

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(
  fn: () => Promise<boolean> | boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await fn();
      if (result) return true;
    } catch {
      // Continue waiting
    }
    await sleep(interval);
  }
  
  return false;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a test Solana wallet keypair
 */
export function generateTestWallet(): { publicKey: string; secretKey: Uint8Array; keypair: Keypair } {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toString(),
    secretKey: keypair.secretKey,
    keypair,
  };
}

/**
 * Create a mock transaction signature
 */
export function mockSolanaTransaction(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return bs58.encode(bytes);
}

/**
 * Assert that a promise throws a tRPC error with specific code
 */
export async function expectTRPCError(
  promise: Promise<any>,
  expectedCode?: string | number
): Promise<any> {
  try {
    await promise;
    throw new Error('Expected promise to throw, but it resolved');
  } catch (error: any) {
    if (error.message === 'Expected promise to throw, but it resolved') {
      throw error;
    }
    
    if (expectedCode !== undefined) {
      const actualCode = error.code || error.data?.error?.data?.code;
      if (actualCode !== expectedCode && String(actualCode) !== String(expectedCode)) {
        throw new Error(`Expected error code ${expectedCode}, got ${actualCode}`);
      }
    }
    
    return error;
  }
}

/**
 * Make a direct HTTP request (for health endpoints)
 */
export async function httpRequest(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<{ status: number; data: any }> {
  const url = `${BASE_URL}${path}`;
  
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  
  return { status: response.status, data };
}

/**
 * Check if server is running
 */
export async function isServerRunning(): Promise<boolean> {
  try {
    const { status } = await httpRequest('/health');
    return status === 200;
  } catch {
    return false;
  }
}

/**
 * Wait for server to be ready
 */
export async function waitForServer(timeout: number = 30000): Promise<boolean> {
  return waitForCondition(isServerRunning, timeout, 1000);
}

/**
 * Setup test database (placeholder for future implementation)
 */
export async function setupTestDatabase(): Promise<void> {
  // In a real implementation, this would:
  // 1. Create a test schema or use a test database
  // 2. Run migrations
  // 3. Seed initial data
  console.log('Setting up test database...');
}

/**
 * Teardown test database (placeholder for future implementation)
 */
export async function teardownTestDatabase(): Promise<void> {
  // In a real implementation, this would:
  // 1. Clean up test data
  // 2. Drop test schema
  console.log('Tearing down test database...');
  console.log(`Test users created: ${createdTestUsers.length}`);
}
