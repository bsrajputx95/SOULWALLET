import * as Crypto from 'expo-crypto';

/**
 * Check if a password has been found in known data breaches
 * Uses the Have I Been Pwned API with k-anonymity (only sends first 5 chars of hash)
 * 
 * @param password - The password to check
 * @returns true if password was found in breach database, false otherwise
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    // Hash the password with SHA-1 (required by HIBP API)
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA1,
      password
    );
    
    // k-anonymity: only send first 5 characters of hash
    const prefix = hash.substring(0, 5).toUpperCase();
    const suffix = hash.substring(5).toUpperCase();
    
    // Query HIBP API - returns all hashes starting with prefix
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: {
          'Add-Padding': 'true', // Prevents response size analysis attacks
        },
      }
    );
    
    if (!response.ok) {
      // Don't block signup if API is unavailable
      console.warn('HIBP API unavailable, skipping breach check');
      return false;
    }
    
    const text = await response.text();
    const hashes = text.split('\n');
    
    // Check if our hash suffix is in the response
    for (const line of hashes) {
      const parts = line.split(':');
      const hashSuffix = parts[0];
      if (hashSuffix && hashSuffix.trim() === suffix) {
        return true; // Password found in breach database
      }
    }
    
    return false;
  } catch (error) {
    // Don't block signup on error - just log and continue
    console.error('Password breach check failed:', error);
    return false;
  }
}

/**
 * Get the number of times a password has appeared in breaches
 * Returns 0 if not found or on error
 * 
 * @param password - The password to check
 * @returns Number of times password appeared in breaches
 */
export async function getBreachCount(password: string): Promise<number> {
  try {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA1,
      password
    );
    
    const prefix = hash.substring(0, 5).toUpperCase();
    const suffix = hash.substring(5).toUpperCase();
    
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: {
          'Add-Padding': 'true',
        },
      }
    );
    
    if (!response.ok) {
      return 0;
    }
    
    const text = await response.text();
    const hashes = text.split('\n');
    
    for (const line of hashes) {
      const parts = line.split(':');
      const hashSuffix = parts[0];
      const count = parts[1];
      if (hashSuffix && hashSuffix.trim() === suffix) {
        return parseInt(count?.trim() || '0', 10) || 0;
      }
    }
    
    return 0;
  } catch (error) {
    console.error('Breach count check failed:', error);
    return 0;
  }
}
