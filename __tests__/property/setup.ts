/**
 * Property Test Setup
 * Minimal setup for property-based tests without React Native dependencies
 */

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
