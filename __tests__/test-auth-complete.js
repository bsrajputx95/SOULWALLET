const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3001/api/trpc';
const TEST_EMAIL = 'complete-test@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const NEW_PASSWORD = 'NewPassword456!';

async function trpcRequest(endpoint, data) {
  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ json: data })
  });

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(`${endpoint} failed: ${JSON.stringify(result)}`);
  }
  
  return result.result.data.json;
}

async function getLatestOTP(email) {
  const otp = await prisma.oTP.findFirst({
    where: {
      email: email.toLowerCase(),
      type: 'RESET_PASSWORD',
      used: false,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return otp?.code;
}

async function cleanupTestUser() {
  console.log('🧹 Cleaning up test user...');
  
  // Delete OTPs
  await prisma.oTP.deleteMany({
    where: { email: TEST_EMAIL.toLowerCase() }
  });
  
  // Delete sessions
  const user = await prisma.user.findUnique({
    where: { email: TEST_EMAIL.toLowerCase() }
  });
  
  if (user) {
    await prisma.session.deleteMany({
      where: { userId: user.id }
    });
    
    // Delete user
    await prisma.user.delete({
      where: { email: TEST_EMAIL.toLowerCase() }
    });
  }
  
  console.log('✅ Cleanup completed');
}

async function testCompleteAuthFlow() {
  const testResults = {
    passed: 0,
    failed: 0,
    tests: []
  };

  function logTest(name, success, error = null) {
    const status = success ? '✅' : '❌';
    console.log(`${status} ${name}`);
    if (error) {
      console.log(`   Error: ${error.message}`);
    }
    
    testResults.tests.push({ name, success, error: error?.message });
    if (success) testResults.passed++;
    else testResults.failed++;
  }

  try {
    // Cleanup first
    await cleanupTestUser();
    
    console.log('\n🚀 Starting Complete Authentication Flow Test\n');
    
    // Test 1: Signup
    console.log('--- Test 1: User Signup ---');
    try {
      const signupResult = await trpcRequest('auth.signup', {
        username: 'testuser123',
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        confirmPassword: TEST_PASSWORD
      });
      logTest('User Signup', true);
      console.log(`   User ID: ${signupResult.user.id}`);
    } catch (error) {
      logTest('User Signup', false, error);
      return; // Can't continue without signup
    }
    
    // Test 2: Login
    console.log('\n--- Test 2: User Login ---');
    try {
      const loginResult = await trpcRequest('auth.login', {
        identifier: TEST_EMAIL,
        password: TEST_PASSWORD
      });
      logTest('User Login', true);
      console.log(`   Token: ${loginResult.token.substring(0, 20)}...`);
    } catch (error) {
      logTest('User Login', false, error);
    }
    
    // Test 3: Request Password Reset
    console.log('\n--- Test 3: Request Password Reset ---');
    try {
      const resetRequestResult = await trpcRequest('auth.requestPasswordReset', {
        email: TEST_EMAIL
      });
      logTest('Request Password Reset', true);
      console.log(`   Message: ${resetRequestResult.message}`);
    } catch (error) {
      logTest('Request Password Reset', false, error);
    }
    
    // Test 4: Get and Verify OTP
    console.log('\n--- Test 4: Verify OTP ---');
    try {
      // Get the actual OTP from database
      const actualOTP = await getLatestOTP(TEST_EMAIL);
      
      if (!actualOTP) {
        throw new Error('No OTP found in database');
      }
      
      console.log(`   Using OTP: ${actualOTP}`);
      
      const verifyResult = await trpcRequest('auth.verifyOtp', {
        email: TEST_EMAIL,
        otp: actualOTP
      });
      logTest('Verify OTP', true);
      console.log(`   Message: ${verifyResult.message}`);
    } catch (error) {
      logTest('Verify OTP', false, error);
    }
    
    // Test 5: Reset Password
    console.log('\n--- Test 5: Reset Password ---');
    try {
      const actualOTP = await getLatestOTP(TEST_EMAIL);
      
      if (!actualOTP) {
        throw new Error('No OTP found in database');
      }
      
      const resetResult = await trpcRequest('auth.resetPassword', {
        email: TEST_EMAIL,
        otp: actualOTP,
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD
      });
      logTest('Reset Password', true);
      console.log(`   Message: ${resetResult.message}`);
    } catch (error) {
      logTest('Reset Password', false, error);
    }
    
    // Test 6: Login with New Password
    console.log('\n--- Test 6: Login with New Password ---');
    try {
      const newLoginResult = await trpcRequest('auth.login', {
        identifier: TEST_EMAIL,
        password: NEW_PASSWORD
      });
      logTest('Login with New Password', true);
      console.log(`   Token: ${newLoginResult.token.substring(0, 20)}...`);
    } catch (error) {
      logTest('Login with New Password', false, error);
    }
    
    // Test 7: Login with Old Password (should fail)
    console.log('\n--- Test 7: Login with Old Password (should fail) ---');
    try {
      await trpcRequest('auth.login', {
        identifier: TEST_EMAIL,
        password: TEST_PASSWORD
      });
      logTest('Login with Old Password (should fail)', false, new Error('Login should have failed but succeeded'));
    } catch (error) {
      logTest('Login with Old Password (should fail)', true);
      console.log(`   Expected error: ${error.message.substring(0, 50)}...`);
    }
    
  } catch (error) {
    console.error('❌ Test suite error:', error);
  } finally {
    // Cleanup
    await cleanupTestUser();
    await prisma.$disconnect();
    
    // Print results
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
    
    if (testResults.failed > 0) {
      console.log('\n⚠️  Failed tests:');
      testResults.tests.filter(t => !t.success).forEach(test => {
        console.log(`   - ${test.name}: ${test.error}`);
      });
    } else {
      console.log('\n🎉 All tests passed! Authentication system is working perfectly!');
    }
  }
}

testCompleteAuthFlow();