const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add any custom Metro configuration here
config.resolver.assetExts.push('cjs');

// Add Node.js polyfills for React Native
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  stream: require.resolve('readable-stream'),
  process: require.resolve('process/browser'),
  buffer: require.resolve('buffer'),
};

// Add platform-specific extensions
config.resolver.sourceExts = [...config.resolver.sourceExts, 'native.ts', 'native.js'];

// Ensure pino-pretty and other Node-specific modules are not bundled
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Skip Node.js specific modules that shouldn't be in React Native
  const nodeOnlyModules = [
    'pino-pretty', 
    'rotating-file-stream', 
    'os', 
    'fs', 
    'path', 
    'child_process',
    'async_hooks',
    'crypto',
    'pino'
  ];
  
  if (nodeOnlyModules.includes(moduleName)) {
    // Return empty module for these
    return {
      type: 'empty',
    };
  }
  
  // Default resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;