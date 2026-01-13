#!/usr/bin/env node

/**
 * SoulWallet Backend Server
 * 
 * This script starts the Fastify server with tRPC integration
 * for the SoulWallet authentication system.
 */

require('dotenv').config();

// Check if we're in development mode
const isDev = process.env.NODE_ENV !== 'production';

if (isDev) {
  // In development, use ts-node to run TypeScript directly
  require('ts-node').register({
    project: './tsconfig.server.json',
    transpileOnly: true,
    compilerOptions: {
      module: 'commonjs',
    },
  });
  // Register path aliases (e.g. @/constants -> ./constants)
  require('tsconfig-paths').register({
    baseUrl: '.',
    paths: { '@/*': ['./*'] },
  });
  try {
    const { startDevServer } = require('./src/server/fastify.ts');
    startDevServer();
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    throw error;
  }
} else {
  // In production, run the compiled JavaScript
  require('./dist/server/fastify.js');
}
