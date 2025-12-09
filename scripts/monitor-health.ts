/**
 * Continuous Health Monitoring Script
 * 
 * Monitors health endpoints and sends alerts on failures
 * Run: npm run health:monitor
 */

import 'dotenv/config';
import axios from 'axios';
import { logger } from '../src/lib/logger';

interface HealthStatus {
  timestamp: Date;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  services: {
    database: boolean;
    redis: boolean;
    solana: boolean;
    rateLimiter: boolean;
  };
}

interface AlertState {
  consecutiveFailures: number;
  lastAlertTime: Date | null;
  degradedSince: Date | null;
}

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const CHECK_INTERVAL = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'); // 30 seconds
const ALERT_THRESHOLD = parseInt(process.env.HEALTH_ALERT_THRESHOLD || '3');
const RESPONSE_TIME_WARN = 2000; // 2 seconds
const RESPONSE_TIME_CRITICAL = 5000; // 5 seconds

const alertState: AlertState = {
  consecutiveFailures: 0,
  lastAlertTime: null,
  degradedSince: null,
};

const healthHistory: HealthStatus[] = [];
const MAX_HISTORY = 1000; // Keep last 1000 checks

let isRunning = true;

async function checkHealth(): Promise<HealthStatus | null> {
  const startTime = Date.now();
  
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 10000 });
    const responseTime = Date.now() - startTime;
    
    const data = response.data;
    const status: HealthStatus = {
      timestamp: new Date(),
      status: data.status || 'unhealthy',
      responseTime,
      services: {
        database: data.checks?.database?.healthy || false,
        redis: data.checks?.redis?.healthy || false,
        solana: data.checks?.solana?.healthy || false,
        rateLimiter: data.checks?.rateLimiter?.healthy || false,
      },
    };
    
    return status;
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      timestamp: new Date(),
      status: 'unhealthy',
      responseTime,
      services: {
        database: false,
        redis: false,
        solana: false,
        rateLimiter: false,
      },
    };
  }
}

function sendAlert(type: 'critical' | 'warning' | 'recovery', message: string, details?: any) {
  const timestamp = new Date().toISOString();
  
  // Log the alert
  if (type === 'critical') {
    logger.error(`🚨 CRITICAL ALERT: ${message}`, { timestamp, details });
  } else if (type === 'warning') {
    logger.warn(`⚠️  WARNING: ${message}`, { timestamp, details });
  } else {
    logger.info(`✅ RECOVERY: ${message}`, { timestamp, details });
  }
  
  // TODO: Add webhook integration for Slack/Discord
  // if (process.env.ALERT_WEBHOOK_URL) {
  //   axios.post(process.env.ALERT_WEBHOOK_URL, { type, message, timestamp, details });
  // }
}

function processHealthStatus(status: HealthStatus) {
  // Add to history
  healthHistory.push(status);
  if (healthHistory.length > MAX_HISTORY) {
    healthHistory.shift();
  }
  
  // Check for failures
  if (status.status === 'unhealthy') {
    alertState.consecutiveFailures++;
    
    if (alertState.consecutiveFailures >= ALERT_THRESHOLD) {
      const timeSinceLastAlert = alertState.lastAlertTime 
        ? Date.now() - alertState.lastAlertTime.getTime() 
        : Infinity;
      
      // Don't spam alerts - wait at least 5 minutes between alerts
      if (timeSinceLastAlert > 5 * 60 * 1000) {
        sendAlert('critical', `System unhealthy for ${alertState.consecutiveFailures} consecutive checks`, {
          services: status.services,
          responseTime: status.responseTime,
        });
        alertState.lastAlertTime = new Date();
      }
    }
  } else if (status.status === 'degraded') {
    // Track degraded state
    if (!alertState.degradedSince) {
      alertState.degradedSince = new Date();
    }
    
    const degradedDuration = Date.now() - alertState.degradedSince.getTime();
    
    // Alert if degraded for more than 5 minutes
    if (degradedDuration > 5 * 60 * 1000) {
      const timeSinceLastAlert = alertState.lastAlertTime 
        ? Date.now() - alertState.lastAlertTime.getTime() 
        : Infinity;
      
      if (timeSinceLastAlert > 10 * 60 * 1000) {
        sendAlert('warning', `System degraded for ${Math.floor(degradedDuration / 60000)} minutes`, {
          services: status.services,
          degradedSince: alertState.degradedSince,
        });
        alertState.lastAlertTime = new Date();
      }
    }
    
    // Reset failure count on degraded (not fully down)
    if (alertState.consecutiveFailures > 0) {
      alertState.consecutiveFailures = 0;
    }
  } else {
    // Healthy - check for recovery
    if (alertState.consecutiveFailures >= ALERT_THRESHOLD || alertState.degradedSince) {
      const downtime = alertState.degradedSince 
        ? Date.now() - alertState.degradedSince.getTime()
        : alertState.consecutiveFailures * CHECK_INTERVAL;
      
      sendAlert('recovery', `System recovered after ${Math.floor(downtime / 1000)} seconds`, {
        previousFailures: alertState.consecutiveFailures,
        degradedSince: alertState.degradedSince,
      });
    }
    
    // Reset state
    alertState.consecutiveFailures = 0;
    alertState.degradedSince = null;
  }
  
  // Check response time
  if (status.responseTime > RESPONSE_TIME_CRITICAL) {
    sendAlert('warning', `Response time critical: ${status.responseTime}ms`, {
      threshold: RESPONSE_TIME_CRITICAL,
    });
  } else if (status.responseTime > RESPONSE_TIME_WARN) {
    logger.warn(`⚠️  Slow response: ${status.responseTime}ms`);
  }
}

function logStatus(status: HealthStatus) {
  const icon = status.status === 'healthy' ? '✅' : status.status === 'degraded' ? '⚠️' : '❌';
  const services = Object.entries(status.services)
    .map(([name, healthy]) => `${healthy ? '✓' : '✗'}${name}`)
    .join(' ');
  
  logger.info(`${icon} [${status.timestamp.toISOString()}] ${status.status.toUpperCase()} | ${status.responseTime}ms | ${services}`);
}

function logStatistics() {
  if (healthHistory.length === 0) return;
  
  const last5Min = healthHistory.filter(h => 
    Date.now() - h.timestamp.getTime() < 5 * 60 * 1000
  );
  
  if (last5Min.length === 0) return;
  
  const avgResponseTime = Math.round(
    last5Min.reduce((sum, h) => sum + h.responseTime, 0) / last5Min.length
  );
  
  const healthyCount = last5Min.filter(h => h.status === 'healthy').length;
  const uptimePercent = Math.round((healthyCount / last5Min.length) * 100);
  
  logger.info(`\n📊 Last 5 minutes: ${uptimePercent}% uptime | Avg response: ${avgResponseTime}ms | Checks: ${last5Min.length}\n`);
}

async function runMonitor() {
  logger.info('🏥 Starting Health Monitor...');
  logger.info(`Base URL: ${BASE_URL}`);
  logger.info(`Check Interval: ${CHECK_INTERVAL}ms`);
  logger.info(`Alert Threshold: ${ALERT_THRESHOLD} consecutive failures\n`);
  
  // Initial check
  const initialStatus = await checkHealth();
  if (initialStatus) {
    logStatus(initialStatus);
    processHealthStatus(initialStatus);
  }
  
  // Statistics logging interval (every 5 minutes)
  const statsInterval = setInterval(logStatistics, 5 * 60 * 1000);
  
  // Main monitoring loop
  const checkInterval = setInterval(async () => {
    if (!isRunning) return;
    
    const status = await checkHealth();
    if (status) {
      logStatus(status);
      processHealthStatus(status);
    }
  }, CHECK_INTERVAL);
  
  // Graceful shutdown
  const shutdown = () => {
    logger.info('\n🛑 Shutting down health monitor...');
    isRunning = false;
    clearInterval(checkInterval);
    clearInterval(statsInterval);
    
    // Log final statistics
    logStatistics();
    
    logger.info('Health monitor stopped.');
    process.exit(0);
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

runMonitor().catch(error => {
  logger.error('Health monitor failed:', error);
  process.exit(1);
});
