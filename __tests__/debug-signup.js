#!/usr/bin/env node

/**
 * Debug Signup Process
 * 
 * This script tests the signup process step by step to identify issues.
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001/api/trpc';
const TEST_EMAIL = 'debug@example.com';
const TEST_PASSWORD = 'TestPassword123!';

// Helper function to make tRPC requests with detailed logging
async function trpcRequest(procedure, input = {}) {
  const url = `${BASE_URL}/${procedure}`;
  
  console.log(`🔄 Making request to: ${url}`);
  console.log(`📤 Request body:`, JSON.stringify({ json: input }, null, 2));
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ json: input }),
  });
  
  console.log(`📥 Response status: ${response.status} ${response.statusText}`);
  
  const responseText = await response.text();
  console.log(`📥 Raw response:`, responseText);
  
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (error) {
    console.error('❌ Failed to parse response as JSON:', error.message);
    throw new Error(`Invalid JSON response: ${responseText}`);
  }
  
  if (!response.ok) {
    console.error('❌ Request failed with data:', JSON.stringify(data, null, 2));
    throw new Error(`${procedure} failed: ${JSON.stringify(data)}`);
  }
  
  console.log(`✅ Request successful:`, JSON.stringify(data, null, 2));
  return data;
}

async function debugSignup() {
  console.log('🚀 Starting Debug Signup Process\n');
  
  try {
    // First, clean up any existing user
    console.log('🧹 Cleaning up existing test user...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    await prisma.user.deleteMany({
      where: { email: TEST_EMAIL }
    });
    
    await prisma.$disconnect();
    console.log('✅ Cleanup completed\n');
    
    // Test signup
    console.log('--- Testing Signup ---');
    const signupResult = await trpcRequest('auth.signup', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    });
    
    console.log('\n🎉 Signup test completed successfully!');
    
    // Test login with the created user
    console.log('\n--- Testing Login ---');
    const loginResult = await trpcRequest('auth.login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    
    console.log('\n🎉 Login test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Debug test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Check if server is running before starting tests
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3001/health');
    if (response.ok) {
      console.log('✅ Server is running, starting debug tests...\n');
      return true;
    }
  } catch (error) {
    console.error('❌ Server is not running. Please start the server first.');
    return false;
  }
}

// Run the debug test
checkServer().then(serverRunning => {
  if (serverRunning) {
    debugSignup().catch(console.error);
  }
});