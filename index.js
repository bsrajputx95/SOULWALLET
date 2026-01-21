// CRITICAL: Polyfills must be imported FIRST before any other code
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import process from 'process';

// Make Buffer and process available globally for crypto libraries
global.Buffer = Buffer;
global.process = process;

// Comprehensive Buffer polyfill - ensure all methods are available
if (!Buffer.prototype.slice) {
  Buffer.prototype.slice = function (start, end) {
    return this.subarray(start, end);
  };
}

// Additional Buffer methods that might be missing
if (!Buffer.isBuffer) {
  Buffer.isBuffer = function (obj) {
    return obj != null && obj._isBuffer === true;
  };
}

// Ensure Buffer constructor works properly
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Polyfill for process.nextTick if missing
if (!global.process.nextTick) {
  global.process.nextTick = function (callback, ...args) {
    setImmediate(() => callback(...args));
  };
}

// Stream polyfills for crypto libraries (ed25519-hd-key, etc.)
import Stream from 'stream-browserify';
import ReadableStream from 'readable-stream';

// Make stream available globally for packages that expect Node.js stream module
global.stream = Stream;
global.Stream = Stream;
global.ReadableStream = ReadableStream;

// Ensure stream classes are available
if (!global.Readable) {
  global.Readable = ReadableStream.Readable;
}
if (!global.Writable) {
  global.Writable = ReadableStream.Writable;
}
if (!global.Duplex) {
  global.Duplex = ReadableStream.Duplex;
}
if (!global.Transform) {
  global.Transform = ReadableStream.Transform;
}

import 'expo-router/entry';
