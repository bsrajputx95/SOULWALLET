#!/usr/bin/env tsx

/**
 * Environment validation script for CI/CD pipelines
 * Validates environment variables before deployment
 * Exits with code 0 on success, 1 on failure
 */

import { validateEnvironment } from '../src/server/index';

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const log = {
  success: (msg: string) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg: string) => console.error(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg: string) => console.warn(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg: string) => console.log(`${colors.bold}${msg}${colors.reset}`),
};

async function main() {
  try {
    log.info('🔍 Starting environment validation...');
    log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    log.info('');

    // Run the validation
    await validateEnvironment();

    log.info('');
    log.success('Environment validation completed successfully!');
    log.success('All required variables are configured correctly.');
    log.info('');
    log.info('Ready for deployment 🚀');

    process.exit(0);
  } catch (error) {
    log.info('');
    log.error('Environment validation failed!');
    log.error('Deployment cannot proceed with invalid configuration.');
    log.info('');
    log.info('Error details:');
    console.error(`${colors.red}${error.message}${colors.reset}`);
    log.info('');
    log.info('Please fix the configuration issues above and try again.');
    log.info('For help, check the .env.example file or documentation.');

    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error(`Unhandled rejection at ${promise}: ${reason}`);
  process.exit(1);
});

// Run the validation
main();