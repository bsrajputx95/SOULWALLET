const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Production optimizations
config.transformer = {
    ...config.transformer,
    // Enable Hermes parsing for better performance
    hermesParser: true,
    minifierPath: 'metro-minify-terser',
    minifierConfig: {
        compress: {
            // Remove console.log in production builds
            drop_console: process.env.NODE_ENV === 'production',
            // Remove debugger statements
            drop_debugger: true,
            // Enable dead code elimination
            dead_code: true,
        },
        mangle: {
            // Shorten variable names for smaller bundles
            toplevel: true,
        },
    },
};

// Enable require context for Expo Hermes
config.transformer.unstable_allowRequireContext = true;

// Enable tree shaking and exclude server code from mobile bundle
config.resolver = {
    ...config.resolver,
    // Only include necessary file extensions
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'json', 'cjs', 'mjs'],
    // Exclude server code and test files from bundle - BETA OPTIMIZATION
    blockList: [
        // Server-side code (not needed in mobile bundle)
        /.*\/src\/server\/.*/,
        /.*\/src\/lib\/services\/.*/,
        /.*\/src\/lib\/middleware\/.*/,
        /.*\/src\/lib\/di\/.*/,
        /.*\/prisma\/.*/,
        // Test files
        /.*\/__tests__\/.*/,
        /.*\.test\.(js|ts|tsx)$/,
        /.*\.spec\.(js|ts|tsx)$/,
        // Docker and config files
        /.*\/docker-compose.*\.yml$/,
        /.*\/Dockerfile$/,
        /.*\/nginx\/.*/,
        /.*\/ssl\/.*/,
        /.*\/scripts\/.*/,
    ],
    // Node.js polyfills for crypto packages (ed25519-hd-key, etc.)
    extraNodeModules: {
        stream: require.resolve('readable-stream'),
        string_decoder: require.resolve('string_decoder'),
        buffer: require.resolve('buffer'),
        events: require.resolve('events'),
        util: require.resolve('util'),
    },
};

// Optimize serializer - aggressive module filtering for beta
config.serializer = {
    ...config.serializer,
    // Process modules in parallel - exclude server-side dependencies
    processModuleFilter: (module) => {
        // Exclude node_modules that aren't used in mobile app
        if (module.path.includes('node_modules')) {
            // Server-side packages to exclude from mobile bundle
            const serverOnlyModules = [
                'fastify',
                '@fastify',
                'prisma',
                '@prisma',
                'ioredis',
                'bull',
                'amqplib',
                'pino',
                'nodemailer',
                'sharp',
                '@opentelemetry',
                '@sentry/node',
                'prom-client',
                '@aws-sdk',
                'rotating-file-stream',
                'node-cron',
            ];

            // Exclude server-only modules
            if (serverOnlyModules.some(m => module.path.includes(`node_modules/${m}`))) {
                return false;
            }

            // Include essential mobile modules
            const essentialModules = [
                '@react-native',
                'react-native',
                'react',
                'expo',
                '@expo',
                '@solana',
                '@trpc/client',
                '@trpc/react-query',
                '@tanstack',
                'superjson',
                'zustand',
                'lucide-react-native',
                'zod',
                'buffer',
                'bs58',
                'tweetnacl',
                'bip39',
                'ed25519-hd-key',
            ];
            return essentialModules.some(m => module.path.includes(m));
        }
        return true;
    },
};

module.exports = config;
