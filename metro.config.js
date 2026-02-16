const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const emptyModule = path.resolve(__dirname, 'lib', 'empty-module.js');

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

// Resolver configuration with polyfills for crypto packages
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
        process: require.resolve('process/browser'),
        crypto: require.resolve('react-native-crypto'),
    },
    // Force all readable-stream imports to use the same polyfilled version
    resolveRequest: (context, moduleName, platform) => {
        // Redirect all readable-stream imports to use the root version
        if (moduleName === 'readable-stream' || moduleName.startsWith('readable-stream/')) {
            return {
                filePath: require.resolve('readable-stream'),
                type: 'sourceFile',
            };
        }

        // Also handle stream imports (some packages use 'stream' instead of 'readable-stream')
        if (moduleName === 'stream') {
            return {
                filePath: require.resolve('readable-stream'),
                type: 'sourceFile',
            };
        }

        // Resolve normally first, then check if it hits the problematic infinity.js
        const resolved = context.resolveRequest(context, moduleName, platform);

        // Redirect lucide infinity icon to empty stub — it declares "const Infinity"
        // which shadows the global and crashes Hermes
        if (resolved && resolved.filePath && resolved.filePath.replace(/\\/g, '/').includes('lucide-react-native/dist/esm/icons/infinity.js')) {
            return { filePath: emptyModule, type: 'sourceFile' };
        }

        return resolved;
    },
};

module.exports = config;
