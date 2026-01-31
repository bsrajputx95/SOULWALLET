// Global type declarations for SOULWALLET

import { Buffer } from 'buffer';

declare global {
  // Buffer polyfill for React Native
  var Buffer: typeof Buffer;

  // Development flag
  var __DEV__: boolean;

  // Window object for web compatibility
  interface Window {
    Buffer: typeof Buffer;
  }
}

// Stream polyfill module declarations
declare module 'stream-browserify';
declare module 'readable-stream';

export { };
