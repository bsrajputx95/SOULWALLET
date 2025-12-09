#!/usr/bin/env node

/**
 * Production Environment Validation Script
 * 
 * Validates .env.production.generated file before deploying to Railway.
 * Run this script to ensure all required variables are set and secure.
 * 
 * Usage: node scripts/validate-production-env.js
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Validation results tracking
const results = {
  passed: [],
  warnings: [],
  failed: [],
};

/**
 * Parse .env file content into key-value pairs
 */
function parseEnvFile(content) {
  const env = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;
    
    const key = trimmed.substring(0, equalIndex).trim();
    let value = trimmed.substring(equalIndex + 1).trim();
    
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    env[key] = value;
  }
  
  return env;
}

/**
 * Check if a value is a placeholder
 */
function isPlaceholder(value) {
  if (!value) return true;
  
  const placeholderPatterns = [
    /^your[-_]/i,
    /password/i,
    /localhost/i,
    /example/i,
    /change[-_]?this/i,
    /^REGENERATE/i,
    /YOUR_/i,
    /^placeholder/i,
    /^xxx/i,
    /^test[-_]/i,
  ];
  
  return placeholderPatterns.some(pattern => pattern.test(value));
}

/**
 * Calculate entropy of a string
 */
function calculateEntropy(str) {
  if (!str) return 0;
  
  const charCounts = {};
  for (const char of str) {
    charCounts[char] = (charCounts[char] || 0) + 1;
  }
  
  const len = str.length;
  let entropy = 0;
  
  for (const count of Object.values(charCounts)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy * len;
}

/**
 * Check character variety in a string
 */
function checkCharacterVariety(str) {
  const hasLower = /[a-z]/.test(str);
  const hasUpper = /[A-Z]/.test(str);
  const hasDigit = /\d/.test(str);
  const hasSpecial = /[^a-zA-Z\d]/.test(str);
  
  return {
    hasLower,
    hasUpper,
    hasDigit,
    hasSpecial,
    variety: [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length,
  };
}

/**
 * Validate required secrets
 */
function validateSecrets(env) {
  console.log(`\n${colors.cyan}${colors.bold}🔐 Validating Security Keys${colors.reset}\n`);
  
  const secrets = [
    { name: 'JWT_SECRET', minLength: 32, type: 'base64' },
    { name: 'JWT_REFRESH_SECRET', minLength: 32, type: 'base64' },
    { name: 'WALLET_ENCRYPTION_KEY', minLength: 64, type: 'hex' },
    { name: 'ADMIN_KEY', minLength: 32, type: 'base64' },
    { name: 'ADMIN_API_KEY', minLength: 32, type: 'base64' },
    { name: 'SESSION_SECRET', minLength: 32, type: 'base64' },
    { name: 'CSRF_SECRET', minLength: 32, type: 'base64' },
  ];
  
  for (const secret of secrets) {
    const value = env[secret.name];
    
    // Check if present
    if (!value) {
      results.failed.push(`${secret.name}: Missing required secret`);
      console.log(`  ${colors.red}❌ ${secret.name}: Missing${colors.reset}`);
      continue;
    }
    
    // Check for placeholder values
    if (isPlaceholder(value)) {
      results.failed.push(`${secret.name}: Contains placeholder value`);
      console.log(`  ${colors.red}❌ ${secret.name}: Placeholder value detected${colors.reset}`);
      continue;
    }
    
    // Check minimum length
    if (value.length < secret.minLength) {
      results.failed.push(`${secret.name}: Too short (${value.length} < ${secret.minLength})`);
      console.log(`  ${colors.red}❌ ${secret.name}: Too short (${value.length} chars, need ${secret.minLength})${colors.reset}`);
      continue;
    }
    
    // Check hex format for encryption keys
    if (secret.type === 'hex' && !/^[a-fA-F0-9]+$/.test(value)) {
      results.failed.push(`${secret.name}: Must be hexadecimal`);
      console.log(`  ${colors.red}❌ ${secret.name}: Must be hexadecimal format${colors.reset}`);
      continue;
    }
    
    // Check entropy
    const entropy = calculateEntropy(value);
    const uniqueChars = new Set(value).size;
    
    if (entropy < 100) {
      results.warnings.push(`${secret.name}: Low entropy (${entropy.toFixed(1)})`);
      console.log(`  ${colors.yellow}⚠️  ${secret.name}: Low entropy (${entropy.toFixed(1)}) - consider stronger secret${colors.reset}`);
    } else if (uniqueChars < 20) {
      results.warnings.push(`${secret.name}: Low character variety (${uniqueChars} unique chars)`);
      console.log(`  ${colors.yellow}⚠️  ${secret.name}: Low variety (${uniqueChars} unique chars)${colors.reset}`);
    } else {
      results.passed.push(`${secret.name}: Valid and secure`);
      console.log(`  ${colors.green}✅ ${secret.name}: Valid (${value.length} chars, entropy: ${entropy.toFixed(1)})${colors.reset}`);
    }
  }
}

/**
 * Validate URL formats
 */
function validateUrls(env) {
  console.log(`\n${colors.cyan}${colors.bold}🔗 Validating URLs${colors.reset}\n`);
  
  // Database URL
  const dbUrl = env.DATABASE_URL;
  if (!dbUrl) {
    results.failed.push('DATABASE_URL: Missing');
    console.log(`  ${colors.red}❌ DATABASE_URL: Missing${colors.reset}`);
  } else if (!dbUrl.startsWith('postgresql://')) {
    results.failed.push('DATABASE_URL: Must start with postgresql://');
    console.log(`  ${colors.red}❌ DATABASE_URL: Must start with postgresql://${colors.reset}`);
  } else if (!dbUrl.includes('sslmode=require')) {
    results.warnings.push('DATABASE_URL: Missing sslmode=require');
    console.log(`  ${colors.yellow}⚠️  DATABASE_URL: Should include ?sslmode=require for production${colors.reset}`);
  } else if (isPlaceholder(dbUrl)) {
    results.failed.push('DATABASE_URL: Contains placeholder value');
    console.log(`  ${colors.red}❌ DATABASE_URL: Contains placeholder value${colors.reset}`);
  } else {
    results.passed.push('DATABASE_URL: Valid');
    console.log(`  ${colors.green}✅ DATABASE_URL: Valid PostgreSQL URL with SSL${colors.reset}`);
  }
  
  // Redis URL
  const redisUrl = env.REDIS_URL;
  if (!redisUrl) {
    results.failed.push('REDIS_URL: Missing (required for production)');
    console.log(`  ${colors.red}❌ REDIS_URL: Missing (required for distributed rate limiting)${colors.reset}`);
  } else if (!redisUrl.startsWith('redis://')) {
    results.failed.push('REDIS_URL: Must start with redis://');
    console.log(`  ${colors.red}❌ REDIS_URL: Must start with redis://${colors.reset}`);
  } else if (isPlaceholder(redisUrl)) {
    results.failed.push('REDIS_URL: Contains placeholder value');
    console.log(`  ${colors.red}❌ REDIS_URL: Contains placeholder value${colors.reset}`);
  } else {
    results.passed.push('REDIS_URL: Valid');
    console.log(`  ${colors.green}✅ REDIS_URL: Valid Redis URL${colors.reset}`);
  }
  
  // ALLOWED_ORIGINS
  const origins = env.ALLOWED_ORIGINS;
  if (!origins) {
    results.failed.push('ALLOWED_ORIGINS: Missing (required for production)');
    console.log(`  ${colors.red}❌ ALLOWED_ORIGINS: Missing${colors.reset}`);
  } else {
    const originList = origins.split(',').map(o => o.trim());
    let allHttps = true;
    
    for (const origin of originList) {
      if (!origin.startsWith('https://')) {
        allHttps = false;
        results.failed.push(`ALLOWED_ORIGINS: ${origin} must use HTTPS`);
        console.log(`  ${colors.red}❌ ALLOWED_ORIGINS: ${origin} must use HTTPS${colors.reset}`);
      }
    }
    
    if (allHttps) {
      results.passed.push('ALLOWED_ORIGINS: All origins use HTTPS');
      console.log(`  ${colors.green}✅ ALLOWED_ORIGINS: ${originList.length} valid HTTPS origins${colors.reset}`);
    }
  }
}

/**
 * Validate production-specific settings
 */
function validateProductionSettings(env) {
  console.log(`\n${colors.cyan}${colors.bold}⚙️  Validating Production Settings${colors.reset}\n`);
  
  // NODE_ENV
  if (env.NODE_ENV !== 'production') {
    results.warnings.push('NODE_ENV: Should be "production"');
    console.log(`  ${colors.yellow}⚠️  NODE_ENV: Should be "production" (current: ${env.NODE_ENV || 'not set'})${colors.reset}`);
  } else {
    results.passed.push('NODE_ENV: production');
    console.log(`  ${colors.green}✅ NODE_ENV: production${colors.reset}`);
  }
  
  // CSRF_ENABLED
  if (env.CSRF_ENABLED !== 'true') {
    results.failed.push('CSRF_ENABLED: Must be "true" in production');
    console.log(`  ${colors.red}❌ CSRF_ENABLED: Must be "true" in production${colors.reset}`);
  } else {
    results.passed.push('CSRF_ENABLED: true');
    console.log(`  ${colors.green}✅ CSRF_ENABLED: true${colors.reset}`);
  }
  
  // FEATURE_SIMULATION_MODE
  if (env.FEATURE_SIMULATION_MODE !== 'false') {
    results.failed.push('FEATURE_SIMULATION_MODE: Must be "false" in production');
    console.log(`  ${colors.red}❌ FEATURE_SIMULATION_MODE: Must be "false" in production${colors.reset}`);
  } else {
    results.passed.push('FEATURE_SIMULATION_MODE: false');
    console.log(`  ${colors.green}✅ FEATURE_SIMULATION_MODE: false${colors.reset}`);
  }
  
  // SESSION_FINGERPRINT_STRICT
  if (env.SESSION_FINGERPRINT_STRICT !== 'true') {
    results.warnings.push('SESSION_FINGERPRINT_STRICT: Should be "true"');
    console.log(`  ${colors.yellow}⚠️  SESSION_FINGERPRINT_STRICT: Should be "true" for better security${colors.reset}`);
  } else {
    results.passed.push('SESSION_FINGERPRINT_STRICT: true');
    console.log(`  ${colors.green}✅ SESSION_FINGERPRINT_STRICT: true${colors.reset}`);
  }
  
  // ENABLE_PLAYGROUND
  if (env.ENABLE_PLAYGROUND === 'true') {
    results.warnings.push('ENABLE_PLAYGROUND: Should be "false" in production');
    console.log(`  ${colors.yellow}⚠️  ENABLE_PLAYGROUND: Should be "false" in production${colors.reset}`);
  } else {
    results.passed.push('ENABLE_PLAYGROUND: false');
    console.log(`  ${colors.green}✅ ENABLE_PLAYGROUND: false${colors.reset}`);
  }
  
  // ENABLE_INTROSPECTION
  if (env.ENABLE_INTROSPECTION === 'true') {
    results.warnings.push('ENABLE_INTROSPECTION: Should be "false" in production');
    console.log(`  ${colors.yellow}⚠️  ENABLE_INTROSPECTION: Should be "false" in production${colors.reset}`);
  } else {
    results.passed.push('ENABLE_INTROSPECTION: false');
    console.log(`  ${colors.green}✅ ENABLE_INTROSPECTION: false${colors.reset}`);
  }
  
  // JWT_EXPIRES_IN (should be short for security)
  const jwtExpires = env.JWT_EXPIRES_IN;
  if (jwtExpires && (jwtExpires === '24h' || jwtExpires.includes('d'))) {
    results.warnings.push('JWT_EXPIRES_IN: Should be 15m or less for security');
    console.log(`  ${colors.yellow}⚠️  JWT_EXPIRES_IN: ${jwtExpires} is too long, recommend 15m${colors.reset}`);
  } else if (jwtExpires === '15m') {
    results.passed.push('JWT_EXPIRES_IN: 15m');
    console.log(`  ${colors.green}✅ JWT_EXPIRES_IN: 15m (secure)${colors.reset}`);
  }
}

/**
 * Validate email configuration
 */
function validateEmailConfig(env) {
  console.log(`\n${colors.cyan}${colors.bold}📧 Validating Email Configuration${colors.reset}\n`);
  
  const provider = env.EMAIL_PROVIDER;
  
  if (!provider) {
    results.warnings.push('EMAIL_PROVIDER: Not configured');
    console.log(`  ${colors.yellow}⚠️  EMAIL_PROVIDER: Not configured${colors.reset}`);
    return;
  }
  
  if (provider === 'console') {
    results.warnings.push('EMAIL_PROVIDER: Using console (emails will only log)');
    console.log(`  ${colors.yellow}⚠️  EMAIL_PROVIDER: "console" - emails will only log to console${colors.reset}`);
    return;
  }
  
  if (provider === 'sendgrid') {
    const apiKey = env.SENDGRID_API_KEY;
    if (!apiKey) {
      results.failed.push('SENDGRID_API_KEY: Missing');
      console.log(`  ${colors.red}❌ SENDGRID_API_KEY: Missing${colors.reset}`);
    } else if (!apiKey.startsWith('SG.')) {
      results.failed.push('SENDGRID_API_KEY: Must start with "SG."');
      console.log(`  ${colors.red}❌ SENDGRID_API_KEY: Must start with "SG."${colors.reset}`);
    } else {
      results.passed.push('EMAIL_PROVIDER: sendgrid configured');
      console.log(`  ${colors.green}✅ EMAIL_PROVIDER: SendGrid configured${colors.reset}`);
    }
  } else if (provider === 'resend') {
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      results.failed.push('RESEND_API_KEY: Missing');
      console.log(`  ${colors.red}❌ RESEND_API_KEY: Missing${colors.reset}`);
    } else if (!apiKey.startsWith('re_')) {
      results.failed.push('RESEND_API_KEY: Must start with "re_"');
      console.log(`  ${colors.red}❌ RESEND_API_KEY: Must start with "re_"${colors.reset}`);
    } else {
      results.passed.push('EMAIL_PROVIDER: resend configured');
      console.log(`  ${colors.green}✅ EMAIL_PROVIDER: Resend configured${colors.reset}`);
    }
  } else if (provider === 'smtp') {
    const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
    const missing = required.filter(v => !env[v] || isPlaceholder(env[v]));
    
    if (missing.length > 0) {
      results.failed.push(`SMTP: Missing ${missing.join(', ')}`);
      console.log(`  ${colors.red}❌ SMTP: Missing ${missing.join(', ')}${colors.reset}`);
    } else {
      results.passed.push('EMAIL_PROVIDER: smtp configured');
      console.log(`  ${colors.green}✅ EMAIL_PROVIDER: SMTP configured${colors.reset}`);
    }
  }
}

/**
 * Validate Helius/Solana configuration
 */
function validateBlockchainConfig(env) {
  console.log(`\n${colors.cyan}${colors.bold}⛓️  Validating Blockchain Configuration${colors.reset}\n`);
  
  const heliusKey = env.HELIUS_API_KEY;
  if (!heliusKey || isPlaceholder(heliusKey)) {
    results.warnings.push('HELIUS_API_KEY: Not configured (copy trading may not work)');
    console.log(`  ${colors.yellow}⚠️  HELIUS_API_KEY: Not configured (required for copy trading)${colors.reset}`);
  } else {
    results.passed.push('HELIUS_API_KEY: Configured');
    console.log(`  ${colors.green}✅ HELIUS_API_KEY: Configured${colors.reset}`);
  }
  
  const solanaRpc = env.EXPO_PUBLIC_SOLANA_RPC_URL;
  if (!solanaRpc) {
    results.failed.push('EXPO_PUBLIC_SOLANA_RPC_URL: Missing');
    console.log(`  ${colors.red}❌ EXPO_PUBLIC_SOLANA_RPC_URL: Missing${colors.reset}`);
  } else if (solanaRpc.includes('api.mainnet-beta.solana.com')) {
    results.warnings.push('EXPO_PUBLIC_SOLANA_RPC_URL: Using public RPC (may be rate limited)');
    console.log(`  ${colors.yellow}⚠️  EXPO_PUBLIC_SOLANA_RPC_URL: Using public RPC (consider premium provider)${colors.reset}`);
  } else {
    results.passed.push('EXPO_PUBLIC_SOLANA_RPC_URL: Configured');
    console.log(`  ${colors.green}✅ EXPO_PUBLIC_SOLANA_RPC_URL: Configured${colors.reset}`);
  }
}

/**
 * Print summary report
 */
function printSummary() {
  console.log(`\n${colors.bold}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bold}                    VALIDATION SUMMARY${colors.reset}`);
  console.log(`${colors.bold}${'='.repeat(60)}${colors.reset}\n`);
  
  console.log(`  ${colors.green}✅ Passed:   ${results.passed.length}${colors.reset}`);
  console.log(`  ${colors.yellow}⚠️  Warnings: ${results.warnings.length}${colors.reset}`);
  console.log(`  ${colors.red}❌ Failed:   ${results.failed.length}${colors.reset}`);
  
  if (results.failed.length > 0) {
    console.log(`\n${colors.red}${colors.bold}Failed Checks:${colors.reset}`);
    results.failed.forEach(msg => console.log(`  ${colors.red}• ${msg}${colors.reset}`));
  }
  
  if (results.warnings.length > 0) {
    console.log(`\n${colors.yellow}${colors.bold}Warnings:${colors.reset}`);
    results.warnings.forEach(msg => console.log(`  ${colors.yellow}• ${msg}${colors.reset}`));
  }
  
  console.log(`\n${colors.bold}${'='.repeat(60)}${colors.reset}`);
  
  if (results.failed.length > 0) {
    console.log(`\n${colors.red}${colors.bold}❌ VALIDATION FAILED${colors.reset}`);
    console.log(`${colors.red}Fix the failed checks before deploying to production.${colors.reset}\n`);
    console.log(`${colors.cyan}Suggestions:${colors.reset}`);
    console.log(`  1. Run: node scripts/generate-production-keys.js`);
    console.log(`  2. Update placeholder values with actual credentials`);
    console.log(`  3. Set Railway environment variables`);
    console.log(`  4. Re-run this validation script\n`);
    return false;
  } else if (results.warnings.length > 0) {
    console.log(`\n${colors.yellow}${colors.bold}⚠️  VALIDATION PASSED WITH WARNINGS${colors.reset}`);
    console.log(`${colors.yellow}Review warnings before deploying to production.${colors.reset}\n`);
    return true;
  } else {
    console.log(`\n${colors.green}${colors.bold}✅ VALIDATION PASSED${colors.reset}`);
    console.log(`${colors.green}Environment is ready for production deployment.${colors.reset}\n`);
    return true;
  }
}

/**
 * Main function
 */
function main() {
  console.log(`\n${colors.bold}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bold}       SoulWallet Production Environment Validator${colors.reset}`);
  console.log(`${colors.bold}${'='.repeat(60)}${colors.reset}`);
  
  // Find and read .env.production.generated
  const envPath = path.join(__dirname, '..', '.env.production.generated');
  
  if (!fs.existsSync(envPath)) {
    console.log(`\n${colors.red}❌ File not found: .env.production.generated${colors.reset}`);
    console.log(`\n${colors.cyan}Run this command first:${colors.reset}`);
    console.log(`  node scripts/generate-production-keys.js\n`);
    process.exit(1);
  }
  
  console.log(`\n${colors.blue}📁 Reading: .env.production.generated${colors.reset}`);
  
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = parseEnvFile(content);
  
  console.log(`${colors.blue}📊 Found ${Object.keys(env).length} environment variables${colors.reset}`);
  
  // Run validations
  validateSecrets(env);
  validateUrls(env);
  validateProductionSettings(env);
  validateEmailConfig(env);
  validateBlockchainConfig(env);
  
  // Print summary and exit
  const success = printSummary();
  process.exit(success ? 0 : 1);
}

// Run main function
main();
