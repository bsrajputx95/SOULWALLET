#!/usr/bin/env node
/**
 * Copy Trading Monitor Service
 * This service runs the transaction monitor, price monitor, and execution queue
 */

import { transactionMonitor } from '../lib/services/transactionMonitor';
import { priceMonitor } from '../lib/services/priceMonitor';
import { executionQueue } from '../lib/services/executionQueue';
import { messageQueue } from '../lib/services/messageQueue'
import { logger } from '../lib/logger';
import prisma from '../lib/prisma';

// Handle process signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

let isShuttingDown = false;

async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('🛑 Shutting down copy trading monitor...');

  try {
    // Stop all services
    await transactionMonitor.stop();
    priceMonitor.stop();
    await messageQueue.shutdown()
    await executionQueue.close();
    
    // Disconnect from database
    await prisma.$disconnect();
    
    logger.info('✅ Copy trading monitor shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

async function startServices() {
  logger.info('🚀 Starting copy trading monitor services...');

  try {
    // Check database connection
    await prisma.$connect();
    logger.info('✅ Database connected');

    // Check Redis connection (for Bull queues)
    const queueStats = await executionQueue.getQueueStats();
    logger.info('✅ Redis connected', queueStats);

    await messageQueue.startConsumers()
    if (messageQueue.isEnabled()) {
      logger.info('✅ RabbitMQ consumers started')
    }

    // Start transaction monitor (WebSocket)
    await transactionMonitor.start();
    logger.info('✅ Transaction monitor started');

    // Start price monitor (polling)
    await priceMonitor.start();
    logger.info('✅ Price monitor started');

    logger.info('🎉 All copy trading services started successfully!');
    
    // Log status every 5 minutes
    setInterval(async () => {
      try {
        const stats = await getSystemStats();
        logger.info('📊 System Status:', stats);
      } catch (error) {
        logger.error('Error getting system stats:', error);
      }
    }, 5 * 60 * 1000);

    // Initial status
    const initialStats = await getSystemStats();
    logger.info('📊 Initial System Status:', initialStats);

  } catch (error) {
    logger.error('Failed to start services:', error);
    await gracefulShutdown();
  }
}

async function getSystemStats() {
  const [queueStats, priceStats, openPositions, activeTraders] = await Promise.all([
    executionQueue.getQueueStats(),
    priceMonitor.getStats(),
    prisma.position.count({ where: { status: 'OPEN' } }),
    prisma.copyTrading.count({ where: { isActive: true } }),
  ]);

  return {
    queues: queueStats,
    priceMonitor: priceStats,
    openPositions,
    activeTraders,
    timestamp: new Date().toISOString(),
  };
}

// Health check endpoint (optional - can be used with PM2 or Docker health checks)
if (process.env.HEALTH_CHECK_PORT) {
  const http = require('http');
  const port = parseInt(process.env.HEALTH_CHECK_PORT);
  
  http.createServer(async (req: any, res: any) => {
    if (req.url === '/health') {
      try {
        const stats = await getSystemStats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', ...stats }));
      } catch (error) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' }));
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  }).listen(port, () => {
    logger.info(`Health check endpoint available at http://localhost:${port}/health`);
  });
}

// Start the services
startServices().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
