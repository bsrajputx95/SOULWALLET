#!/usr/bin/env node

/**
 * PRODUCTION READINESS VERIFICATION SCRIPT
 * ========================================
 * This script validates that the SoulWallet application is production-ready
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let errors = 0;
let warnings = 0;
let passed = 0;

function log(message, type = 'info') {
  const prefix = {
    error: `${RED}✗${RESET}`,
    warning: `${YELLOW}⚠${RESET}`,
    success: `${GREEN}✓${RESET}`,
    info: `${BLUE}ℹ${RESET}`,
    header: `${BLUE}═══${RESET}`
  }[type];
  
  console.log(`${prefix} ${message}`);
  
  if (type === 'error') errors++;
  if (type === 'warning') warnings++;
  if (type === 'success') passed++;
}

function header(title) {
  console.log('\n' + '═'.repeat(60));
  console.log(`${BLUE}${title}${RESET}`);
  console.log('═'.repeat(60));
}

// ============================================================================
// 1. CHECK ENVIRONMENT CONFIGURATION
// ============================================================================

function checkEnvironment() {
  header('ENVIRONMENT CONFIGURATION');
  
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'ADMIN_KEY',
    'REDIS_URL',
    'SOLANA_RPC_URL',
    'ALLOWED_ORIGINS',
  ];
  
  const recommendedEnvVars = [
    'PLATFORM_WALLET_ADDRESS',
    'HELIUS_API_KEY',
    'EXPO_PUBLIC_SENTRY_DSN',
    'EMAIL_PROVIDER',
    'SMTP_HOST',
  ];
  
  // Check .env file exists
  if (!fs.existsSync('.env')) {
    log('.env file not found', 'error');
  } else {
    log('.env file exists', 'success');
  }
  
  // Load environment variables
  require('dotenv').config();
  
  // Check required variables
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      log(`Missing required: ${varName}`, 'error');
    } else if (varName.includes('SECRET') || varName.includes('KEY')) {
      // Check strength of secrets
      const value = process.env[varName];
      if (value.length < 32) {
        log(`${varName} is too short (< 32 chars)`, 'error');
      } else if (value.includes('default') || value.includes('change') || value.includes('your-')) {
        log(`${varName} contains placeholder value`, 'error');
      } else {
        log(`${varName} configured`, 'success');
      }
    } else {
      log(`${varName} configured`, 'success');
    }
  });
  
  // Check recommended variables
  recommendedEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      log(`Missing recommended: ${varName}`, 'warning');
    }
  });
  
  // Check NODE_ENV
  if (process.env.NODE_ENV !== 'production') {
    log('NODE_ENV is not set to "production"', 'warning');
  } else {
    log('NODE_ENV is set to production', 'success');
  }
}

// ============================================================================
// 2. CHECK SECURITY CONFIGURATION
// ============================================================================

function checkSecurity() {
  header('SECURITY CONFIGURATION');
  
  // Check CORS configuration
  if (!process.env.ALLOWED_ORIGINS) {
    log('ALLOWED_ORIGINS not configured', 'error');
  } else if (process.env.ALLOWED_ORIGINS.includes('*')) {
    log('ALLOWED_ORIGINS contains wildcard (*)', 'error');
  } else {
    log('CORS properly configured', 'success');
  }
  
  // Check security flags
  const securityFlags = {
    ENABLE_PLAYGROUND: 'false',
    ENABLE_INTROSPECTION: 'false',
    FEATURE_SIMULATION_MODE: 'false',
    SESSION_FINGERPRINT_STRICT: 'true',
  };
  
  Object.entries(securityFlags).forEach(([flag, expectedValue]) => {
    const actualValue = process.env[flag];
    if (actualValue !== expectedValue) {
      log(`${flag} should be ${expectedValue} in production`, 'error');
    } else {
      log(`${flag} = ${expectedValue}`, 'success');
    }
  });
  
  // Check rate limiting
  if (!process.env.RATE_LIMIT_MAX) {
    log('Rate limiting not configured', 'warning');
  } else {
    log(`Rate limiting configured: ${process.env.RATE_LIMIT_MAX} requests`, 'success');
  }
}

// ============================================================================
// 3. CHECK DATABASE
// ============================================================================

async function checkDatabase() {
  header('DATABASE CONFIGURATION');
  
  // Check if using PostgreSQL
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    log('DATABASE_URL not set', 'error');
    return;
  }
  
  if (dbUrl.includes('sqlite') || dbUrl.includes('file:')) {
    log('Using SQLite in production (not recommended)', 'error');
  } else if (dbUrl.includes('postgresql')) {
    log('Using PostgreSQL', 'success');
  } else {
    log('Unknown database type', 'warning');
  }
  
  // Check Prisma schema
  if (!fs.existsSync('prisma/schema.prisma')) {
    log('Prisma schema not found', 'error');
  } else {
    log('Prisma schema exists', 'success');
  }
  
  // Check migrations
  const migrationsDir = 'prisma/migrations';
  if (!fs.existsSync(migrationsDir)) {
    log('No database migrations found', 'warning');
  } else {
    const migrations = fs.readdirSync(migrationsDir).filter(f => f !== 'migration_lock.toml');
    log(`Found ${migrations.length} database migrations`, 'success');
  }
}

// ============================================================================
// 4. CHECK DEPENDENCIES
// ============================================================================

function checkDependencies() {
  header('DEPENDENCIES');
  
  // Check package-lock.json
  if (!fs.existsSync('package-lock.json')) {
    log('package-lock.json not found (required for reproducible builds)', 'error');
  } else {
    log('package-lock.json exists', 'success');
  }
  
  // Check for vulnerabilities
  try {
    execSync('npm audit --json', { stdio: 'pipe' });
    log('No vulnerabilities found', 'success');
  } catch (error) {
    const output = error.stdout?.toString() || '';
    try {
      const audit = JSON.parse(output);
      const vulns = audit.metadata?.vulnerabilities || {};
      
      if (vulns.critical > 0) {
        log(`${vulns.critical} critical vulnerabilities found`, 'error');
      }
      if (vulns.high > 0) {
        log(`${vulns.high} high vulnerabilities found`, 'error');
      }
      if (vulns.moderate > 0) {
        log(`${vulns.moderate} moderate vulnerabilities found`, 'warning');
      }
      if (vulns.low > 0) {
        log(`${vulns.low} low vulnerabilities found`, 'info');
      }
    } catch {
      log('Could not parse npm audit results', 'warning');
    }
  }
  
  // Check critical dependencies
  const criticalDeps = [
    '@solana/web3.js',
    '@prisma/client',
    'fastify',
    '@trpc/server',
    'jsonwebtoken',
  ];
  
  const package = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const allDeps = { ...package.dependencies, ...package.devDependencies };
  
  criticalDeps.forEach(dep => {
    if (allDeps[dep]) {
      log(`${dep} installed`, 'success');
    } else {
      log(`${dep} not found`, 'error');
    }
  });
}

// ============================================================================
// 5. CHECK BUILD
// ============================================================================

function checkBuild() {
  header('BUILD CONFIGURATION');
  
  // Check TypeScript configuration
  if (!fs.existsSync('tsconfig.json')) {
    log('tsconfig.json not found', 'error');
  } else {
    log('TypeScript configured', 'success');
  }
  
  // Check build output
  if (!fs.existsSync('dist')) {
    log('Build output (dist/) not found - run npm run server:build', 'warning');
  } else {
    log('Build output exists', 'success');
  }
  
  // Check PM2 configuration
  if (!fs.existsSync('pm2.config.js')) {
    log('PM2 configuration not found', 'error');
  } else {
    log('PM2 configuration exists', 'success');
  }
  
  // Check Docker configuration
  if (!fs.existsSync('Dockerfile')) {
    log('Dockerfile not found', 'warning');
  } else {
    log('Dockerfile exists', 'success');
  }
  
  if (!fs.existsSync('docker-compose.yml')) {
    log('docker-compose.yml not found', 'warning');
  } else {
    log('Docker Compose configuration exists', 'success');
  }
}

// ============================================================================
// 6. CHECK WALLET SECURITY
// ============================================================================

function checkWalletSecurity() {
  header('WALLET SECURITY');
  
  // Check wallet service
  const walletServicePath = 'src/lib/services/wallet.ts';
  if (fs.existsSync(walletServicePath)) {
    const walletService = fs.readFileSync(walletServicePath, 'utf-8');
    
    // Check for dangerous methods
    const dangerousMethods = [
      'createUserWallet',
      'importWallet',
      'encryptPrivateKey',
      'decryptPrivateKey',
      'generateMnemonic'
    ];
    
    let hasDangerousMethods = false;
    dangerousMethods.forEach(method => {
      if (walletService.includes(method)) {
        log(`Dangerous method found: ${method}`, 'error');
        hasDangerousMethods = true;
      }
    });
    
    if (!hasDangerousMethods) {
      log('No server-side wallet generation methods found', 'success');
    }
    
    // Check for security notice
    if (walletService.includes('SECURITY NOTICE')) {
      log('Security notice present in wallet service', 'success');
    } else {
      log('Missing security notice in wallet service', 'warning');
    }
  } else {
    log('Wallet service not found', 'warning');
  }
  
  // Check for client-side wallet manager
  if (fs.existsSync('hooks/wallet-creation-store.ts')) {
    log('Client-side wallet creation store exists', 'success');
  } else {
    log('Client-side wallet creation not implemented', 'error');
  }
}

// ============================================================================
// 7. CHECK PAYMENT VERIFICATION
// ============================================================================

function checkPaymentVerification() {
  header('PAYMENT VERIFICATION');
  
  // Check payment verification service
  if (fs.existsSync('src/lib/services/payment-verification.ts')) {
    log('Payment verification service exists', 'success');
    
    const paymentService = fs.readFileSync('src/lib/services/payment-verification.ts', 'utf-8');
    
    // Check for critical methods
    const requiredMethods = [
      'verifyVIPPayment',
      'isTransactionUsed',
      'verifyPlatformFee'
    ];
    
    requiredMethods.forEach(method => {
      if (paymentService.includes(method)) {
        log(`${method} method implemented`, 'success');
      } else {
        log(`${method} method missing`, 'error');
      }
    });
  } else {
    log('Payment verification service not found', 'error');
  }
  
  // Check social service uses payment verification
  const socialServicePath = 'src/lib/services/social.ts';
  if (fs.existsSync(socialServicePath)) {
    const socialService = fs.readFileSync(socialServicePath, 'utf-8');
    
    if (socialService.includes('paymentVerificationService')) {
      log('Social service uses payment verification', 'success');
    } else {
      log('Social service does not verify payments', 'error');
    }
  }
}

// ============================================================================
// 8. CHECK MONITORING
// ============================================================================

function checkMonitoring() {
  header('MONITORING & LOGGING');
  
  // Check Sentry configuration
  if (!process.env.EXPO_PUBLIC_SENTRY_DSN) {
    log('Sentry not configured', 'warning');
  } else {
    log('Sentry configured', 'success');
  }
  
  // Check logging configuration
  if (process.env.LOG_LEVEL === 'debug' && process.env.NODE_ENV === 'production') {
    log('Debug logging enabled in production', 'warning');
  } else {
    log(`Log level: ${process.env.LOG_LEVEL || 'info'}`, 'success');
  }
  
  // Check log directory
  if (!fs.existsSync('logs')) {
    log('Logs directory not found', 'warning');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log(`${BLUE}SOULWALLET PRODUCTION READINESS VERIFICATION${RESET}`);
  console.log('='.repeat(60));
  
  checkEnvironment();
  checkSecurity();
  await checkDatabase();
  checkDependencies();
  checkBuild();
  checkWalletSecurity();
  checkPaymentVerification();
  checkMonitoring();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`${BLUE}VERIFICATION SUMMARY${RESET}`);
  console.log('='.repeat(60));
  
  console.log(`${GREEN}✓ Passed:${RESET} ${passed}`);
  console.log(`${YELLOW}⚠ Warnings:${RESET} ${warnings}`);
  console.log(`${RED}✗ Errors:${RESET} ${errors}`);
  
  if (errors === 0) {
    console.log(`\n${GREEN}✅ Application is PRODUCTION READY!${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${RED}❌ Application is NOT production ready. Fix ${errors} errors before deploying.${RESET}`);
    process.exit(1);
  }
}

// Run verification
main().catch(error => {
  console.error(`${RED}Verification failed:${RESET}`, error);
  process.exit(1);
});
