#!/usr/bin/env node

/**
 * Database Connection Test Script
 * 
 * This script tests if the database connection and Prisma are working correctly.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabaseConnection() {
  console.log('🔄 Testing database connection...');
  
  try {
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test if we can query users
    const userCount = await prisma.user.count();
    console.log(`📊 Current user count: ${userCount}`);
    
    // Test if we can query sessions
    const sessionCount = await prisma.session.count();
    console.log(`📊 Current session count: ${sessionCount}`);
    
    // Test if we can query OTPs
    const otpCount = await prisma.oTP.count();
    console.log(`📊 Current OTP count: ${otpCount}`);
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function testUserCreation() {
  console.log('\n🔄 Testing user creation...');
  
  try {
    await prisma.$connect();
    
    const testEmail = 'dbtest@example.com';
    
    // Clean up any existing test user
    await prisma.user.deleteMany({
      where: { email: testEmail }
    });
    
    // Try to create a test user
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        password: 'hashedpassword123',
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });
    
    console.log('✅ User creation successful:', user);
    
    // Clean up
    await prisma.user.delete({
      where: { id: user.id }
    });
    
    console.log('✅ User cleanup successful');
    
    return true;
  } catch (error) {
    console.error('❌ User creation failed:', error.message);
    console.error('Full error:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function runTests() {
  console.log('🚀 Starting Database Tests\n');
  
  const tests = [
    { name: 'Database Connection', fn: testDatabaseConnection },
    { name: 'User Creation', fn: testUserCreation },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`--- ${test.name} ---`);
    
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
  }
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All database tests passed!');
  } else {
    console.log('\n⚠️  Some database tests failed. Check the logs above for details.');
  }
}

runTests().catch(console.error);