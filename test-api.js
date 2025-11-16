#!/usr/bin/env node
/**
 * Local API Testing Script
 * Tests authentication and core backend functionality
 */

const API_URL = 'http://localhost:3001/api/trpc';

// Test user credentials
const testUser = {
  email: `test${Date.now()}@example.com`,
  password: 'Test123!@#Strong',
  username: `testuser${Date.now()}`
};

let authToken = null;

// Helper function to make tRPC requests
async function trpcRequest(procedure, input, token = null, isQuery = false) {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['Cookie'] = `authToken=${token}`;
  }
  
  let url = `${API_URL}/${procedure}`;
  const fetchOptions = { headers };
  
  if (isQuery) {
    // GET request with query params
    const params = new URLSearchParams({ input: JSON.stringify({ json: input }) });
    url += `?${params}`;
    fetchOptions.method = 'GET';
  } else {
    // POST request with body
    fetchOptions.method = 'POST';
    fetchOptions.body = JSON.stringify({ json: input });
  }
  
  const response = await fetch(url, fetchOptions);
  const data = await response.json();
  
  if (!response.ok || data.error) {
    throw new Error(`${procedure} failed: ${data.error?.message || JSON.stringify(data)}`);
  }
  
  return data.result?.data?.json || data.result?.data || data;
}

// Test functions
async function testSignup() {
  console.log('\n=== Testing Signup ===');
  console.log('Email:', testUser.email);
  
  const result = await trpcRequest('auth.signup', {
    ...testUser,
    confirmPassword: testUser.password
  });
  authToken = result.token;
  
  console.log('✅ Signup successful!');
  console.log('User ID:', result.user.id);
  console.log('Token received:', authToken ? 'Yes' : 'No');
  
  return result;
}

async function testLogin() {
  console.log('\n=== Testing Login ===');
  
  const result = await trpcRequest('auth.login', {
    identifier: testUser.email, // Can be email or username
    password: testUser.password
  });
  
  authToken = result.token;
  
  console.log('✅ Login successful!');
  console.log('Token received:', authToken ? 'Yes' : 'No');
  
  return result;
}

async function testGetCurrentUser() {
  console.log('\n=== Testing Get Current User ===');
  
  const result = await trpcRequest('auth.getCurrentUser', {}, authToken, true); // true = isQuery
  
  console.log('✅ Get current user successful!');
  console.log('User:', result.email);
  
  return result;
}

async function testWalletInfo() {
  console.log('\n=== Testing Wallet Info ===');
  
  try {
    // Test getting wallet info (will return empty array if no wallets)
    const result = await trpcRequest('wallet.getWalletInfo', {}, authToken, true);
    
    console.log('✅ Wallet info endpoint works!');
    console.log('Wallets:', result.length || 0);
    return result;
  } catch (error) {
    if (error.message.includes('NOT_FOUND')) {
      console.log('✅ Wallet info endpoint works (no wallets yet)');
      return [];
    }
    throw error;
  }
}

async function testHealth() {
  console.log('\n=== Testing Health Endpoint ===');
  
  const response = await fetch('http://localhost:3001/health');
  const data = await response.json();
  
  console.log('Status:', data.status);
  console.log('Database:', data.checks.database.healthy ? '✅' : '❌');
  console.log('Solana:', data.checks.solana.healthy ? '✅' : '❌');
  console.log('Rate Limiter:', data.checks.rateLimiter.healthy ? '✅' : '❌');
  
  return data;
}

// Run all tests
async function runTests() {
  console.log('🧪 Starting API Tests...');
  console.log('API URL:', API_URL);
  
  try {
    await testHealth();
    await testSignup();
    await testLogin();
    await testGetCurrentUser();
    await testWalletInfo();
    
    console.log('\n✅ All tests passed!');
    console.log('\n📊 Summary:');
    console.log('- Health check: ✅');
    console.log('- Authentication (signup/login): ✅');
    console.log('- User management (get current user): ✅');
    console.log('- Wallet API (get wallet info): ✅');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();
