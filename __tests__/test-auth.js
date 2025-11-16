#!/usr/bin/env node

/**
 * Authentication System Test Script
 * 
 * This script tests the complete authentication flow:
 * 1. Signup
 * 2. Login
 * 3. Request Password Reset
 * 4. Verify OTP
 * 5. Reset Password
 * 6. Login with new password
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001/api/trpc';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const NEW_PASSWORD = 'NewPassword456!';
const TEST_NAME = 'Test User';

let authToken = null;
const otpCode = null;

// Helper function to make tRPC requests
async function trpcRequest(procedure, input = {}) {
  const url = `${BASE_URL}/${procedure}`;
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ json: input }),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`${procedure} failed: ${JSON.stringify(data)}`);
  }
  
  return data;
}

// Test functions
async function testSignup() {
  console.log('🔄 Testing signup...');
  
  try {
    const result = await trpcRequest('auth.signup', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    });
    
    console.log('✅ Signup successful:', result);
    authToken = result.result.data.token;
    return true;
  } catch (error) {
    console.error('❌ Signup failed:', error.message);
    return false;
  }
}

async function testLogin() {
  console.log('🔄 Testing login...');
  
  try {
    const result = await trpcRequest('auth.login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    
    console.log('✅ Login successful:', result);
    authToken = result.result.data.token;
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    return false;
  }
}

async function testPasswordResetRequest() {
  console.log('🔄 Testing password reset request...');
  
  try {
    const result = await trpcRequest('auth.requestPasswordReset', {
      email: TEST_EMAIL,
    });
    
    console.log('✅ Password reset request successful:', result);
    
    // In a real scenario, the OTP would be sent via email
    // For testing, we'll extract it from the console or database
    console.log('📧 Check your email for the OTP code (or check server logs)');
    
    return true;
  } catch (error) {
    console.error('❌ Password reset request failed:', error.message);
    return false;
  }
}

async function testVerifyOTP() {
  console.log('🔄 Testing OTP verification...');
  
  // For testing purposes, we'll use a mock OTP
  // In production, this would come from the email
  const mockOTP = '123456';
  
  try {
    const result = await trpcRequest('auth.verifyOtp', {
      email: TEST_EMAIL,
      otp: mockOTP,
    });
    
    console.log('✅ OTP verification successful:', result);
    return true;
  } catch (error) {
    console.error('❌ OTP verification failed:', error.message);
    console.log('ℹ️  This is expected if using a mock OTP');
    return false;
  }
}

async function testResetPassword() {
  console.log('🔄 Testing password reset...');
  
  const mockOTP = '123456';
  
  try {
    const result = await trpcRequest('auth.resetPassword', {
      email: TEST_EMAIL,
      otp: mockOTP,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    
    console.log('✅ Password reset successful:', result);
    return true;
  } catch (error) {
    console.error('❌ Password reset failed:', error.message);
    console.log('ℹ️  This is expected if using a mock OTP');
    return false;
  }
}

async function testLoginWithNewPassword() {
  console.log('🔄 Testing login with new password...');
  
  try {
    const result = await trpcRequest('auth.login', {
      email: TEST_EMAIL,
      password: NEW_PASSWORD,
    });
    
    console.log('✅ Login with new password successful:', result);
    return true;
  } catch (error) {
    console.error('❌ Login with new password failed:', error.message);
    return false;
  }
}

async function testLogout() {
  console.log('🔄 Testing logout...');
  
  try {
    const result = await trpcRequest('auth.logout');
    
    console.log('✅ Logout successful:', result);
    authToken = null;
    return true;
  } catch (error) {
    console.error('❌ Logout failed:', error.message);
    return false;
  }
}

async function testHealthCheck() {
  console.log('🔄 Testing health check...');
  
  try {
    const response = await fetch('http://localhost:3001/health');
    const data = await response.json();
    
    console.log('✅ Health check successful:', data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Authentication System Tests\n');
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Signup', fn: testSignup },
    { name: 'Login', fn: testLogin },
    { name: 'Logout', fn: testLogout },
    { name: 'Password Reset Request', fn: testPasswordResetRequest },
    { name: 'Verify OTP', fn: testVerifyOTP },
    { name: 'Reset Password', fn: testResetPassword },
    { name: 'Login with New Password', fn: testLoginWithNewPassword },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n--- ${test.name} ---`);
    
    try {
      const success = await test.fn();
      if (success) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ ${test.name} threw an error:`, error.message);
      failed++;
    }
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Authentication system is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
  }
}

// Check if server is running before starting tests
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3001/health');
    if (response.ok) {
      console.log('✅ Server is running, starting tests...\n');
      return true;
    }
  } catch (error) {
    console.error('❌ Server is not running. Please start the server first:');
    console.error('   npm run server');
    console.error('   or');
    console.error('   npx tsx src/server/fastify.ts');
    return false;
  }
}

// Run the tests
checkServer().then(serverRunning => {
  if (serverRunning) {
    runTests().catch(console.error);
  }
});