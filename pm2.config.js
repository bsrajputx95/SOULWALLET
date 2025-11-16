// Load environment variables from .env file
const path = require('path');
const fs = require('fs');

// Function to load .env file
function loadEnv(envFile) {
  const envPath = path.resolve(__dirname, envFile);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^['"]|['"]$/g, '');
        envVars[key] = value;
      }
    });
    return envVars;
  }
  return {};
}

// Load environment variables
const developmentEnv = loadEnv('.env');
const productionEnv = loadEnv('.env.production');

module.exports = {
  apps: [
    {
      name: 'soulwallet-api',
      script: 'dist/server/fastify.js',
      instances: 'max', // Utilize all CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: '3001',
        ...developmentEnv,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '3001',
        ...productionEnv,
      },
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      shutdown_with_message: true,
      node_args: '--max-old-space-size=2048',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
      combine_logs: true,
      time: true,
    },
    {
      name: 'copy-trading-monitor',
      script: 'dist/services/copyTradingMonitor.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: '3001',
        ...developmentEnv,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '3001',
        ...productionEnv,
      },
      error_file: 'logs/copy-trading-error.log',
      out_file: 'logs/copy-trading-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '512M',
      kill_timeout: 5000,
      cron_restart: '0 3 * * *', // Restart daily at 3 AM for cleanup
      node_args: '--max-old-space-size=2048',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
      combine_logs: true,
      time: true,
      // Monitors trader wallets via WebSocket and processes detected transactions
    },
    {
      name: 'transaction-monitor',
      script: 'dist/services/transactionMonitor.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: '3001',
        ...developmentEnv,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '3001',
        ...productionEnv,
      },
      error_file: 'logs/transaction-monitor-error.log',
      out_file: 'logs/transaction-monitor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '512M',
      kill_timeout: 5000,
      node_args: '--max-old-space-size=2048',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
      combine_logs: true,
      time: true,
      // Monitors user transactions and updates database
    },
  ],

  deploy: {
    production: {
      user: 'node',
      host: 'your-server-ip-or-hostname',
      ref: 'origin/main',
      repo: 'https://github.com/your-username/soulwallet.git',
      path: '/var/www/soulwallet',
      'post-deploy': 'npm install && npm run db:generate && npm run server:build && npm run db:migrate:deploy && pm2 reload pm2.config.js --env production',
    },
  },

  // PM2 Plus Integration (optional)
  // pmx: true, // Enable PM2 Plus monitoring - requires PM2 Plus account

  // Log Rotation: Use PM2 log rotation module: pm2 install pm2-logrotate
  // Configure rotation: pm2 set pm2-logrotate:max_size 10M
  // Keep rotated logs: pm2 set pm2-logrotate:retain 7
};

/*
Usage Instructions:
- Start all apps: pm2 start pm2.config.js
- Start specific app: pm2 start pm2.config.js --only soulwallet-api
- Stop all: pm2 stop all
- Restart all: pm2 restart all
- Reload (zero-downtime): pm2 reload all
- View logs: pm2 logs
- Monitor: pm2 monit
- Save configuration: pm2 save
- Setup startup script: pm2 startup
- List processes: pm2 list
- Describe process: pm2 describe soulwallet-api

Pre-deployment Checklist:
- Build TypeScript: npm run server:build
- Run database migrations: npm run db:migrate:deploy
- Verify environment variables are set
- Create logs directory: mkdir -p logs
- Test configuration: pm2 start pm2.config.js --env production
- Save PM2 process list: pm2 save
- Configure PM2 to start on system boot: pm2 startup

Monitoring and Alerts:
- Set up PM2 Plus for advanced monitoring
- Configure alerts for high memory usage, crashes, slow requests
- Integrate with external monitoring (Datadog, New Relic)
- Set up log aggregation (ELK stack, CloudWatch)

Performance Tuning:
- Adjust instances based on CPU cores and load
- Monitor memory usage and adjust max_memory_restart
- Use cluster mode for API to handle more concurrent requests
- Keep monitors in fork mode to avoid duplicate processing
- Consider separating read-heavy and write-heavy operations
*/