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

// Enable tree shaking
config.resolver = {
    ...config.resolver,
    // Only include necessary file extensions
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'json', 'cjs', 'mjs'],
    // Exclude test files from bundle
    blockList: [
        /.*\/__tests__\/.*/,
        /.*\.test\.(js|ts|tsx)$/,
        /.*\.spec\.(js|ts|tsx)$/,
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

// Optimize serializer
config.serializer = {
    ...config.serializer,
    // Process modules in parallel
    processModuleFilter: (module) => {
        // Exclude node_modules that aren't used
        if (module.path.includes('node_modules')) {
            // Include only essential modules
            const essentialModules = [
                '@react-native',
                'react-native',
                'expo',
                '@solana',
                '@trpc',
                'superjson',
            ];
            return essentialModules.some(m => module.path.includes(m));
        }
        return true;
    },
};

module.exports = config;

