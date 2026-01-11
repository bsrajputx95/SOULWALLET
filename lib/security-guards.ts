/**
 * Security Guards - Client-side runtime protection
 * Anti-debugging, biometric enforcement, memory protection
 */

import { Platform, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// ============================================
// SECURITY CONFIGURATION
// ============================================

export const SECURITY_CONFIG = {
  // Biometric required for amounts above this (in USD)
  BIOMETRIC_THRESHOLD_USD: 1000,
  // Maximum failed biometric attempts before lockout
  MAX_BIOMETRIC_FAILURES: 3,
  // Lockout duration in milliseconds (15 minutes)
  BIOMETRIC_LOCKOUT_MS: 15 * 60 * 1000,
  // Enable security checks in production only
  ENABLED: !__DEV__,
};

// ============================================
// SECURITY STATE
// ============================================

interface SecurityState {
  biometricFailures: number;
  biometricLockoutUntil: number | null;
  lastSecurityCheck: number;
  securityAlerts: string[];
}

let securityState: SecurityState = {
  biometricFailures: 0,
  biometricLockoutUntil: null,
  lastSecurityCheck: 0,
  securityAlerts: [],
};

// ============================================
// ANTI-DEBUGGING CHECKS
// ============================================

/**
 * Check if running in development mode
 */
export function isDevMode(): boolean {
  return __DEV__;
}

/**
 * Check for suspicious console overrides (potential debugging)
 */
export function checkConsoleIntegrity(): boolean {
  if (!SECURITY_CONFIG.ENABLED) return true;
  
  try {
    // Check if console.log has been tampered with
    const originalLog = console.log.toString();
    if (!originalLog.includes('native code') && !originalLog.includes('[native code]')) {
      // Console may have been overridden
      securityState.securityAlerts.push('console_override_detected');
      return false;
    }
    return true;
  } catch (e) {
    return true; // Fail open in case of error
  }
}

/**
 * Detect React DevTools
 */
export function isReactDevToolsAttached(): boolean {
  if (!SECURITY_CONFIG.ENABLED) return false;
  
  try {
    // @ts-ignore - Check for React DevTools global
    return typeof window !== 'undefined' && 
           (window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined ||
            window.__REACT_DEVTOOLS_ATTACH__ !== undefined);
  } catch (e) {
    return false;
  }
}

// ============================================
// BIOMETRIC AUTHENTICATION
// ============================================

/**
 * Check if biometric authentication is available
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch (e) {
    console.error('[Security] Biometric check failed:', e);
    return false;
  }
}

/**
 * Get supported biometric types
 */
export async function getSupportedBiometricTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
  try {
    return await LocalAuthentication.supportedAuthenticationTypesAsync();
  } catch (e) {
    return [];
  }
}

/**
 * Check if user is locked out from biometric auth
 */
export function isBiometricLockedOut(): boolean {
  if (!securityState.biometricLockoutUntil) return false;
  
  if (Date.now() >= securityState.biometricLockoutUntil) {
    // Lockout expired, reset
    securityState.biometricLockoutUntil = null;
    securityState.biometricFailures = 0;
    return false;
  }
  
  return true;
}

/**
 * Get remaining lockout time in seconds
 */
export function getBiometricLockoutRemaining(): number {
  if (!securityState.biometricLockoutUntil) return 0;
  const remaining = securityState.biometricLockoutUntil - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000));
}

/**
 * Require biometric authentication
 * @param reason - Reason shown to user
 * @returns true if authenticated, false otherwise
 */
export async function requireBiometric(reason: string): Promise<boolean> {
  // Skip in dev mode
  if (!SECURITY_CONFIG.ENABLED) return true;
  
  // Check lockout
  if (isBiometricLockedOut()) {
    const remaining = getBiometricLockoutRemaining();
    Alert.alert(
      'Temporarily Locked',
      `Too many failed attempts. Please try again in ${Math.ceil(remaining / 60)} minutes.`
    );
    return false;
  }
  
  // Check availability
  const available = await isBiometricAvailable();
  if (!available) {
    // Biometric not available, allow operation but log
    console.warn('[Security] Biometric not available, allowing operation');
    return true;
  }
  
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false, // Allow PIN/password fallback
      fallbackLabel: 'Use Passcode',
    });
    
    if (result.success) {
      // Reset failure count on success
      securityState.biometricFailures = 0;
      return true;
    } else {
      // Track failure
      securityState.biometricFailures++;
      
      if (securityState.biometricFailures >= SECURITY_CONFIG.MAX_BIOMETRIC_FAILURES) {
        // Trigger lockout
        securityState.biometricLockoutUntil = Date.now() + SECURITY_CONFIG.BIOMETRIC_LOCKOUT_MS;
        Alert.alert(
          'Too Many Attempts',
          'Biometric authentication has been temporarily disabled. Please try again later.'
        );
      }
      
      return false;
    }
  } catch (e) {
    console.error('[Security] Biometric auth error:', e);
    return false;
  }
}

/**
 * Check if biometric is required for a transaction amount
 */
export function requiresBiometricForAmount(amountUsd: number): boolean {
  if (!SECURITY_CONFIG.ENABLED) return false;
  return amountUsd >= SECURITY_CONFIG.BIOMETRIC_THRESHOLD_USD;
}

// ============================================
// MEMORY PROTECTION
// ============================================

/**
 * Securely clear sensitive data from memory
 * Note: JavaScript doesn't guarantee memory clearing, but this helps
 */
export function secureClear(data: string | null | undefined): void {
  if (data && typeof data === 'string') {
    // Overwrite string content (limited effectiveness in JS)
    try {
      // @ts-ignore - Attempt to overwrite
      data = '\0'.repeat(data.length);
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Securely clear an object's sensitive fields
 */
export function secureClearObject(obj: Record<string, any>, sensitiveFields: string[]): void {
  for (const field of sensitiveFields) {
    if (obj[field]) {
      secureClear(obj[field]);
      obj[field] = null;
    }
  }
}

// ============================================
// SECURE STORAGE HELPERS
// ============================================

const SECURITY_STORAGE_KEY = 'security_state';

/**
 * Save security state to secure storage
 */
export async function saveSecurityState(): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      SECURITY_STORAGE_KEY,
      JSON.stringify({
        biometricFailures: securityState.biometricFailures,
        biometricLockoutUntil: securityState.biometricLockoutUntil,
      })
    );
  } catch (e) {
    console.error('[Security] Failed to save security state:', e);
  }
}

/**
 * Load security state from secure storage
 */
export async function loadSecurityState(): Promise<void> {
  try {
    const stored = await SecureStore.getItemAsync(SECURITY_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      securityState.biometricFailures = parsed.biometricFailures || 0;
      securityState.biometricLockoutUntil = parsed.biometricLockoutUntil || null;
    }
  } catch (e) {
    console.error('[Security] Failed to load security state:', e);
  }
}

// ============================================
// COMPREHENSIVE SECURITY CHECK
// ============================================

export interface ClientSecurityCheckResult {
  isDevMode: boolean;
  consoleIntegrity: boolean;
  devToolsAttached: boolean;
  biometricAvailable: boolean;
  biometricLockedOut: boolean;
  alerts: string[];
  riskScore: number;
  shouldBlockSensitiveOps: boolean;
}

/**
 * Perform comprehensive client-side security check
 */
export async function performClientSecurityCheck(): Promise<ClientSecurityCheckResult> {
  const isDevModeResult = isDevMode();
  const consoleIntegrity = checkConsoleIntegrity();
  const devToolsAttached = isReactDevToolsAttached();
  const biometricAvailable = await isBiometricAvailable();
  const biometricLockedOut = isBiometricLockedOut();
  
  // Calculate risk score
  let riskScore = 0;
  const alerts: string[] = [...securityState.securityAlerts];
  
  if (!consoleIntegrity) {
    riskScore += 20;
    alerts.push('console_tampered');
  }
  
  if (devToolsAttached && !isDevModeResult) {
    riskScore += 30;
    alerts.push('devtools_in_production');
  }
  
  if (biometricLockedOut) {
    riskScore += 10;
    alerts.push('biometric_lockout');
  }
  
  // Update last check time
  securityState.lastSecurityCheck = Date.now();
  
  return {
    isDevMode: isDevModeResult,
    consoleIntegrity,
    devToolsAttached,
    biometricAvailable,
    biometricLockedOut,
    alerts,
    riskScore: Math.min(100, riskScore),
    shouldBlockSensitiveOps: riskScore >= 50 || biometricLockedOut,
  };
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize security guards
 * Call this on app startup
 */
export async function initializeSecurityGuards(): Promise<void> {
  await loadSecurityState();
  
  if (SECURITY_CONFIG.ENABLED) {
    const result = await performClientSecurityCheck();
    
    if (result.alerts.length > 0) {
      console.warn('[Security] Alerts detected:', result.alerts);
    }
    
    if (result.riskScore > 0) {
      console.warn('[Security] Risk score:', result.riskScore);
    }
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  SECURITY_CONFIG,
  isDevMode,
  checkConsoleIntegrity,
  isReactDevToolsAttached,
  isBiometricAvailable,
  getSupportedBiometricTypes,
  isBiometricLockedOut,
  getBiometricLockoutRemaining,
  requireBiometric,
  requiresBiometricForAmount,
  secureClear,
  secureClearObject,
  performClientSecurityCheck,
  initializeSecurityGuards,
};
