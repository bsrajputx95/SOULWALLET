/**
 * Health Check Endpoint Testing Script
 * 
 * Automated testing of all health check endpoints
 * Run: npm run health:test
 */

import 'dotenv/config';
import axios, { AxiosError } from 'axios';
import { logger } from '../src/lib/logger';

interface TestResult {
  endpoint: string;
  status: 'pass' | 'fail' | 'warn';
  statusCode?: number;
  responseTime: number;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

// Parse command line arguments
const args = process.argv.slice(2);

function getArgValue(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : undefined;
}

const CLI_URL = getArgValue('--url');
const CLI_TIMEOUT = getArgValue('--timeout');
const VERBOSE = args.includes('--verbose');
const JSON_OUTPUT = args.includes('--json');

const BASE_URL = CLI_URL || process.env.API_URL || 'http://localhost:3001';
const TIMEOUT = parseInt(CLI_TIMEOUT || process.env.HEALTH_TEST_TIMEOUT || '5000');

async function testEndpoint(
  endpoint: string,
  validator: (data: any, statusCode: number, responseTime: number) => TestResult
): Promise<void> {
  const url = `${BASE_URL}${endpoint}`;
  const startTime = Date.now();
  
  try {
    const response = await axios.get(url, { timeout: TIMEOUT });
    const responseTime = Date.now() - startTime;
    const result = validator(response.data, response.status, responseTime);
    results.push(result);
    
    const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
    if (!JSON_OUTPUT) {
      logger.info(`${icon} ${endpoint}: ${result.message} (${responseTime}ms)`);
      if (VERBOSE && result.details) {
        logger.info(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const axiosError = error as AxiosError;
    
    if (axiosError.response) {
      // Server responded with error status
      const result = validator(axiosError.response.data, axiosError.response.status, responseTime);
      results.push(result);
      const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
      logger.info(`${icon} ${endpoint}: ${result.message} (${responseTime}ms)`);
    } else {
      // Network error or timeout
      results.push({
        endpoint,
        status: 'fail',
        responseTime,
        message: `Connection failed: ${axiosError.message}`,
      });
      if (!JSON_OUTPUT) {
        logger.info(`❌ ${endpoint}: Connection failed - ${axiosError.message}`);
      }
    }
  }
}

async function runHealthTests() {
  if (!JSON_OUTPUT) {
    logger.info('🏥 Running Health Check Tests...');
    logger.info(`Base URL: ${BASE_URL}`);
    logger.info(`Timeout: ${TIMEOUT}ms`);
    if (VERBOSE) {
      logger.info('Verbose mode: enabled');
    }
    logger.info('');
  }

  // Test 1: General Health Check
  await testEndpoint('/health', (data, statusCode, responseTime) => {
    const hasStatus = data?.status !== undefined;
    const hasChecks = data?.checks !== undefined;
    const hasUptime = data?.uptime !== undefined;
    const isHealthy = data?.status === 'healthy' || data?.status === 'degraded';
    
    if (statusCode === 200 && hasStatus && hasChecks && hasUptime && isHealthy) {
      return {
        endpoint: '/health',
        status: data.status === 'healthy' ? 'pass' : 'warn',
        statusCode,
        responseTime,
        message: `System ${data.status}`,
        details: data.checks,
      };
    }
    return {
      endpoint: '/health',
      status: 'fail',
      statusCode,
      responseTime,
      message: 'Invalid response format or unhealthy status',
      details: data,
    };
  });

  // Test 2: Database Health
  await testEndpoint('/health/db', (data, statusCode, responseTime) => {
    const dbHealthy = data?.database?.healthy;
    const latency = data?.database?.latency;
    
    if (dbHealthy === true) {
      const latencyWarn = latency && latency > 1000;
      return {
        endpoint: '/health/db',
        status: latencyWarn ? 'warn' : 'pass',
        statusCode,
        responseTime,
        message: latencyWarn ? `Database healthy but slow (${latency}ms)` : `Database healthy (${latency}ms)`,
        details: data.database,
      };
    }
    return {
      endpoint: '/health/db',
      status: 'fail',
      statusCode,
      responseTime,
      message: `Database unhealthy: ${data?.database?.error || 'Unknown error'}`,
      details: data,
    };
  });

  // Test 3: Redis Health
  await testEndpoint('/health/redis', (data, statusCode, responseTime) => {
    // Redis might not be configured
    if (data?.redis?.required === false) {
      return {
        endpoint: '/health/redis',
        status: 'pass',
        statusCode,
        responseTime,
        message: 'Redis not configured (optional)',
        details: data.redis,
      };
    }
    
    const redisHealthy = data?.redis?.healthy;
    if (redisHealthy === true) {
      return {
        endpoint: '/health/redis',
        status: 'pass',
        statusCode,
        responseTime,
        message: `Redis healthy (${data?.redis?.latency}ms)`,
        details: data.redis,
      };
    }
    return {
      endpoint: '/health/redis',
      status: 'warn',
      statusCode,
      responseTime,
      message: `Redis unhealthy: ${data?.redis?.error || 'Unknown error'}`,
      details: data,
    };
  });

  // Test 4: Solana Health
  await testEndpoint('/health/solana', (data, statusCode, responseTime) => {
    const solanaHealthy = data?.solana?.healthy;
    const latency = data?.solana?.latency;
    
    if (solanaHealthy === true) {
      const latencyWarn = latency && latency > 2000;
      return {
        endpoint: '/health/solana',
        status: latencyWarn ? 'warn' : 'pass',
        statusCode,
        responseTime,
        message: latencyWarn ? `Solana RPC slow (${latency}ms)` : `Solana RPC healthy (${latency}ms)`,
        details: data.solana,
      };
    }
    return {
      endpoint: '/health/solana',
      status: 'warn',
      statusCode,
      responseTime,
      message: `Solana RPC unhealthy: ${data?.solana?.error || 'Unknown error'}`,
      details: data,
    };
  });

  // Test 5: Readiness Probe
  await testEndpoint('/health/ready', (data, statusCode, responseTime) => {
    const ready = data?.ready;
    
    if (ready === true && statusCode === 200) {
      return {
        endpoint: '/health/ready',
        status: 'pass',
        statusCode,
        responseTime,
        message: 'System ready to accept traffic',
        details: data.services,
      };
    }
    return {
      endpoint: '/health/ready',
      status: 'fail',
      statusCode,
      responseTime,
      message: 'System not ready',
      details: data,
    };
  });

  // Test 6: Liveness Probe
  await testEndpoint('/health/live', (data, statusCode, responseTime) => {
    const alive = data?.alive;
    const uptime = data?.uptime;
    
    if (alive === true && statusCode === 200) {
      return {
        endpoint: '/health/live',
        status: 'pass',
        statusCode,
        responseTime,
        message: `System alive (uptime: ${Math.floor(uptime || 0)}s)`,
        details: data,
      };
    }
    return {
      endpoint: '/health/live',
      status: 'fail',
      statusCode,
      responseTime,
      message: 'System not alive',
      details: data,
    };
  });

  // Summary
  const passed = results.filter(r => r.status === 'pass').length;
  const warnings = results.filter(r => r.status === 'warn').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const avgResponseTime = Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length);
  const healthScore = Math.round((passed / results.length) * 100);

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({
      summary: {
        total: results.length,
        passed,
        warnings,
        failed,
        avgResponseTime,
        healthScore,
      },
      results,
    }, null, 2));
  } else {
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 HEALTH CHECK SUMMARY');
    logger.info('='.repeat(60));

    logger.info(`✅ Passed: ${passed}`);
    logger.info(`⚠️  Warnings: ${warnings}`);
    logger.info(`❌ Failed: ${failed}`);
    logger.info(`⏱️  Average Response Time: ${avgResponseTime}ms`);
    logger.info(`\n🏥 Health Score: ${healthScore}%`);
  }

  // Exit with appropriate code
  if (failed > 0) {
    // Critical failures (database, readiness)
    const criticalFailed = results.filter(r => 
      r.status === 'fail' && (r.endpoint === '/health/db' || r.endpoint === '/health/ready')
    ).length;
    
    if (criticalFailed > 0) {
      if (!JSON_OUTPUT) {
        logger.info('\n❌ CRITICAL: Database or readiness check failed');
      }
      process.exit(1);
    }
    
    if (!JSON_OUTPUT) {
      logger.info('\n⚠️  Some non-critical checks failed');
    }
    process.exit(2);
  } else if (warnings > 0) {
    if (!JSON_OUTPUT) {
      logger.info('\n⚠️  All checks passed with warnings');
    }
    process.exit(0);
  } else {
    if (!JSON_OUTPUT) {
      logger.info('\n✅ All health checks passed!');
    }
    process.exit(0);
  }
}

runHealthTests().catch(error => {
  if (!JSON_OUTPUT) {
    logger.error('Health test script failed:', error);
  }
  process.exit(1);
});
