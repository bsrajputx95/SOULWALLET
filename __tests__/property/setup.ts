/**
 * Property Test Setup
 * Minimal setup for property-based tests without React Native dependencies
 */

// Import reflect-metadata first for DI decorators
import 'reflect-metadata';

// Initialize DI container before any tests run
try {
    const { setupContainer } = require('../../src/lib/di/container');
    setupContainer();
} catch (error) {
    // Container may already be set up or not needed for some tests
    // Silently continue
}

// Suppress console output in tests unless DEBUG is set
if (!process.env.DEBUG) {
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'debug').mockImplementation(() => { });
    jest.spyOn(console, 'info').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
    // Keep error for debugging
}

// Set timeout for property tests (fast-check may need more time)
jest.setTimeout(30000);

