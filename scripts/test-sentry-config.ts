/**
 * Sentry Configuration Validation Script
 * 
 * Validates Sentry configuration before deployment
 * Run: npm run sentry:test-config
 */

import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { logger } from '../src/lib/logger';

interface ValidationResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

const results: ValidationResult[] = [];

function addResult(name: string, status: 'pass' | 'fail' | 'warn', message: string) {
  results.push({ name, status, message });
  const icon = status === 'pass' ? '✅' : status === 'warn' ? '⚠️' : '❌';
  logger.info(`${icon} ${name}: ${message}`);
}

async function validateSentryConfig() {
  logger.info('🔍 Validating Sentry configuration...\n');

  // 1. DSN Validation
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || dsn === 'your-sentry-dsn-here' || dsn === 'disabled') {
    addResult('DSN Configuration', 'fail', 'EXPO_PUBLIC_SENTRY_DSN is not configured');
  } else if (!dsn.match(/^https:\/\/[a-f0-9]+@[a-z0-9]+\.ingest\.sentry\.io\/\d+$/)) {
    addResult('DSN Configuration', 'warn', 'DSN format may be invalid. Expected: https://[key]@[org].ingest.sentry.io/[project]');
  } else {
    addResult('DSN Configuration', 'pass', 'DSN is properly configured');
  }

  // 2. Auth Token Validation
  const authToken = process.env.SENTRY_AUTH_TOKEN;
  if (!authToken) {
    addResult('Auth Token', 'warn', 'SENTRY_AUTH_TOKEN not set (needed for source map uploads)');
  } else {
    addResult('Auth Token', 'pass', 'Auth token is configured');
  }

  // 3. Organization/Project Validation
  const org = process.env.SENTRY_ORG;
  const projectMobile = process.env.SENTRY_PROJECT_MOBILE;
  const projectBackend = process.env.SENTRY_PROJECT_BACKEND;

  if (!org) {
    addResult('Organization', 'warn', 'SENTRY_ORG not set');
  } else {
    addResult('Organization', 'pass', `Organization: ${org}`);
  }

  if (!projectMobile && !projectBackend) {
    addResult('Projects', 'warn', 'No Sentry projects configured (SENTRY_PROJECT_MOBILE, SENTRY_PROJECT_BACKEND)');
  } else {
    if (projectMobile) addResult('Mobile Project', 'pass', `Mobile project: ${projectMobile}`);
    if (projectBackend) addResult('Backend Project', 'pass', `Backend project: ${projectBackend}`);
  }

  // 4. Sample Rate Validation
  const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1');
  const profilesSampleRate = parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1');

  if (isNaN(tracesSampleRate) || tracesSampleRate < 0 || tracesSampleRate > 1) {
    addResult('Traces Sample Rate', 'fail', 'SENTRY_TRACES_SAMPLE_RATE must be between 0 and 1');
  } else {
    addResult('Traces Sample Rate', 'pass', `Traces sample rate: ${tracesSampleRate * 100}%`);
  }

  if (isNaN(profilesSampleRate) || profilesSampleRate < 0 || profilesSampleRate > 1) {
    addResult('Profiles Sample Rate', 'fail', 'SENTRY_PROFILES_SAMPLE_RATE must be between 0 and 1');
  } else {
    addResult('Profiles Sample Rate', 'pass', `Profiles sample rate: ${profilesSampleRate * 100}%`);
  }

  // 5. Sentry Connectivity Test (only if DSN is valid)
  if (dsn && dsn !== 'your-sentry-dsn-here' && dsn !== 'disabled') {
    try {
      logger.info('\n🔄 Testing Sentry connectivity...');
      
      Sentry.init({
        dsn,
        environment: 'config-test',
        tracesSampleRate: 0,
        beforeSend(event) {
          // Tag test events
          event.tags = { ...event.tags, configTest: 'true' };
          return event;
        },
      });

      // Send a test message
      Sentry.captureMessage('Sentry configuration test - this is a test event', 'info');
      
      // Wait for event to be sent
      await Sentry.flush(5000);
      
      addResult('Connectivity Test', 'pass', 'Successfully sent test event to Sentry');
    } catch (error: any) {
      addResult('Connectivity Test', 'fail', `Failed to connect to Sentry: ${error.message}`);
    }
  }

  // Summary
  logger.info('\n' + '='.repeat(60));
  logger.info('📊 VALIDATION SUMMARY');
  logger.info('='.repeat(60));

  const passed = results.filter(r => r.status === 'pass').length;
  const warnings = results.filter(r => r.status === 'warn').length;
  const failed = results.filter(r => r.status === 'fail').length;

  logger.info(`✅ Passed: ${passed}`);
  logger.info(`⚠️  Warnings: ${warnings}`);
  logger.info(`❌ Failed: ${failed}`);

  if (failed > 0) {
    logger.info('\n❌ Configuration validation FAILED');
    logger.info('Please fix the issues above before deploying.');
    process.exit(1);
  } else if (warnings > 0) {
    logger.info('\n⚠️  Configuration validation passed with warnings');
    logger.info('Consider addressing the warnings for optimal monitoring.');
    process.exit(0);
  } else {
    logger.info('\n✅ Configuration validation PASSED');
    logger.info('Sentry is properly configured for deployment.');
    process.exit(0);
  }
}

validateSentryConfig().catch(error => {
  logger.error('Validation script failed:', error);
  process.exit(1);
});
