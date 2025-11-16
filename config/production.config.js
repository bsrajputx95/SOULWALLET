/**
 * Production Configuration
 * Critical settings for production deployment
 */

module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || [
        'https://soulwallet.app',
        'https://www.soulwallet.app',
        'https://app.soulwallet.com'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining']
    }
  },

  // Security Configuration
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: [
            "'self'",
            "https://api.solana.com",
            "https://api.mainnet-beta.solana.com",
            "wss://api.mainnet-beta.solana.com",
            "https://*.sentry.io"
          ]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    },
    rateLimit: {
      global: {
        max: 100,
        timeWindow: '15 minutes'
      },
      auth: {
        max: 5,
        timeWindow: '15 minutes'
      },
      api: {
        max: 1000,
        timeWindow: '15 minutes'
      }
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      saltRounds: 12, // For bcrypt
      tokenExpiry: {
        access: '24h',
        refresh: '7d',
        otp: '10m'
      }
    }
  },

  // Database Configuration
  database: {
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 2000
    },
    ssl: process.env.NODE_ENV === 'production',
    logging: false // Disable in production
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: 0,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    reconnectOnError: (err) => {
      const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET'];
      return targetErrors.some(e => err.message.includes(e));
    }
  },

  // Monitoring & Logging
  monitoring: {
    sentry: {
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0.1,
      profilesSampleRate: 0.1,
      attachStacktrace: true,
      autoSessionTracking: true
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: 'json',
      transports: [
        {
          type: 'file',
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        },
        {
          type: 'file',
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }
      ]
    }
  },

  // Performance Optimization
  performance: {
    compression: {
      level: 6,
      threshold: 1024 // Compress responses > 1KB
    },
    caching: {
      static: {
        maxAge: 31536000, // 1 year for static assets
        immutable: true
      },
      api: {
        maxAge: 0,
        mustRevalidate: true
      }
    },
    clustering: {
      workers: process.env.WEB_CONCURRENCY || 1
    }
  },

  // Feature Flags
  features: {
    sendEnabled: process.env.FEATURE_SEND_ENABLED === 'true',
    swapEnabled: process.env.FEATURE_SWAP_ENABLED === 'true',
    copyTradingEnabled: process.env.FEATURE_COPY_TRADING_ENABLED === 'true',
    socialEnabled: process.env.FEATURE_SOCIAL_ENABLED === 'true',
    maintenanceMode: process.env.MAINTENANCE_MODE === 'true'
  },

  // Blockchain Configuration
  blockchain: {
    solana: {
      rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    },
    tokens: {
      maxSlippage: 0.01, // 1%
      priorityFee: 0.00001 // SOL
    }
  },

  // Email Configuration
  email: {
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100
    },
    from: {
      name: 'Soul Wallet',
      address: process.env.EMAIL_FROM || 'noreply@soulwallet.app'
    },
    templates: {
      verification: 'email-verification',
      welcome: 'welcome',
      passwordReset: 'password-reset',
      securityAlert: 'security-alert'
    }
  },

  // Notification Services
  notifications: {
    expo: {
      accessToken: process.env.EXPO_ACCESS_TOKEN
    },
    webhooks: {
      discord: process.env.DISCORD_WEBHOOK_URL,
      slack: process.env.SLACK_WEBHOOK_URL
    }
  },

  // Health Check Configuration
  healthCheck: {
    endpoints: [
      '/health',
      '/health/db',
      '/health/redis'
    ],
    interval: 30000, // 30 seconds
    timeout: 5000,
    retries: 3
  },

  // Backup Configuration
  backup: {
    database: {
      schedule: '0 3 * * *', // Daily at 3 AM
      retention: 30, // Days
      s3: {
        bucket: process.env.BACKUP_S3_BUCKET,
        region: process.env.AWS_REGION || 'us-east-1'
      }
    }
  },

  // Deployment Configuration
  deployment: {
    blueGreen: {
      enabled: true,
      healthCheckDelay: 10000,
      switchoverDelay: 5000
    },
    rollback: {
      enabled: true,
      maxVersionsToKeep: 3
    }
  }
};
