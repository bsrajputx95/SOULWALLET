#!/usr/bin/env node

/**
 * Test script to verify backend server starts correctly
 */

require('dotenv').config();

console.log('🔍 Testing server startup...\n');

// Check environment variables
console.log('Environment Variables:');
console.log('✓ DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : '❌ MISSING');
console.log('✓ JWT_SECRET:', process.env.JWT_SECRET ? 'SET (' + process.env.JWT_SECRET.length + ' chars)' : '❌ MISSING');
console.log('✓ JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET ? 'SET (' + process.env.JWT_REFRESH_SECRET.length + ' chars)' : '❌ MISSING');
console.log('✓ NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('✓ PORT:', process.env.PORT || '3001');
console.log('');

// Check if JWT secrets are strong enough
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET must be at least 32 characters long');
  process.exit(1);
}

if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
  console.error('❌ JWT_REFRESH_SECRET must be at least 32 characters long');
  process.exit(1);
}

// Try to load Prisma
console.log('Testing Prisma Client...');
try {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  console.log('✓ Prisma Client loaded successfully');
  
  // Test database connection
  prisma.$connect()
    .then(() => {
      console.log('✓ Database connection successful');
      return prisma.$disconnect();
    })
    .then(() => {
      console.log('\n✅ All checks passed! Server should start successfully.');
      console.log('\nRun: npm run server');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database connection failed:', error.message);
      process.exit(1);
    });
} catch (error) {
  console.error('❌ Failed to load Prisma Client:', error.message);
  console.log('\nTry running: npm run db:generate');
  process.exit(1);
}
