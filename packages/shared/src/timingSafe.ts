import { timingSafeEqual } from 'crypto';

/**
 * Timing-safe string comparison utilities
 * 
 * Prevents timing attacks that could leak information about token addresses
 * or other sensitive string comparisons through execution time measurements.
 */

/**
 * Compare two Ethereum addresses in a timing-safe manner
 * 
 * Regular string comparison (===, toLowerCase) can leak information through
 * timing side-channels. This function uses constant-time comparison.
 * 
 * @param a - First address (with or without 0x prefix)
 * @param b - Second address (with or without 0x prefix)
 * @returns true if addresses are equal (case-insensitive)
 */
export function timingSafeAddressEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Remove 0x prefix and normalize to lowercase
  const normA = a.startsWith('0x') ? a.slice(2).toLowerCase() : a.toLowerCase();
  const normB = b.startsWith('0x') ? b.slice(2).toLowerCase() : b.toLowerCase();

  // Ethereum addresses are 40 hex characters
  if (normA.length !== 40 || normB.length !== 40) {
    return false;
  }

  // Convert to buffers for timing-safe comparison
  const bufA = Buffer.from(normA, 'utf8');
  const bufB = Buffer.from(normB, 'utf8');

  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    // timingSafeEqual throws if buffers have different lengths (shouldn't happen after length check)
    return false;
  }
}

/**
 * Normalize an Ethereum address to lowercase with 0x prefix
 * 
 * @param address - Address to normalize
 * @returns Normalized address (0x + 40 lowercase hex chars)
 */
export function normalizeAddress(address: string): string {
  if (typeof address !== 'string') {
    throw new TypeError('Address must be a string');
  }

  const clean = address.trim();
  const withoutPrefix = clean.startsWith('0x') ? clean.slice(2) : clean;

  if (withoutPrefix.length !== 40) {
    throw new Error(`Invalid Ethereum address length: ${clean}`);
  }

  if (!/^[0-9a-fA-F]{40}$/.test(withoutPrefix)) {
    throw new Error(`Invalid Ethereum address format: ${clean}`);
  }

  return `0x${withoutPrefix.toLowerCase()}`;
}

/**
 * Check if a value is a valid Ethereum address
 * 
 * @param value - Value to check
 * @returns true if value is a valid Ethereum address
 */
export function isValidAddress(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    normalizeAddress(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Timing-safe string equality check
 * 
 * For non-address strings that still need timing-safe comparison.
 * Pads strings to same length to avoid length-based timing leaks.
 * 
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Pad to same length to avoid length-based timing leaks
  const maxLen = Math.max(a.length, b.length, 1);
  const bufA = Buffer.alloc(maxLen);
  const bufB = Buffer.alloc(maxLen);

  bufA.write(a, 'utf8');
  bufB.write(b, 'utf8');

  try {
    return timingSafeEqual(bufA, bufB) && a.length === b.length;
  } catch {
    return false;
  }
}
