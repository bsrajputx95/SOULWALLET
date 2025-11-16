#!/usr/bin/env node

/**
 * Test script to verify the backend server starts correctly
 */

require('dotenv').config();

console.log('🧪 Testing SoulWallet Backend Server...\n');

// Set up ts-node for TypeScript execution
require('ts-node').register({
  project: './tsconfig.server.json',
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
  },
});

console.log('✅ ts-node configured');

// Import and start the server
async function testServer() {
  try {
    console.log('📦 Loading server modules...');
    
    const { startServer } = require('../src/server/fastify.ts');
    
    console.log('✅ Modules loaded successfully');
    console.log('🚀 Starting server...\n');
    
    const port = parseInt(process.env.PORT || '3001');
    const host = process.env.HOST || '0.0.0.0';
    
    const server = await startServer(port, host);
    
    console.log('\n✅ Server started successfully!');
    console.log('📌 Press Ctrl+C to stop the server\n');
    
    // Keep the process running
    process.stdin.resume();
    
  } catch (error) {
    console.error('\n❌ Server test failed:', error);
    process.exit(1);
  }
}

testServer();
