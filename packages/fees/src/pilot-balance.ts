/**
 * PILOT Token Balance Reader
 * 
 * Reads user's PILOT token balance to determine fee discount tier.
 */

import { FEE_ADDRESSES } from './config.js';

/** Standard ERC-20 balanceOf ABI */
const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

export type PilotBalanceReaderConfig = {
  /** RPC URL for the chain where PILOT is deployed */
  rpcUrl: string;
  /** PILOT token address (optional, uses default from config) */
  pilotTokenAddress?: string;
  /** Request timeout in ms */
  timeoutMs?: number;
};

/**
 * Read PILOT token balance for a user
 */
export async function getPilotBalance(
  userAddress: string,
  config: PilotBalanceReaderConfig,
): Promise<bigint> {
  const tokenAddress = config.pilotTokenAddress ?? FEE_ADDRESSES.PILOT_TOKEN;
  
  // If token not deployed yet, return 0
  if (tokenAddress === '0x0000000000000000000000000000000000000000') {
    return 0n;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 5000);

  try {
    // Encode balanceOf call
    const data = encodeBalanceOfCall(userAddress);

    const response = await fetch(config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          { to: tokenAddress, data },
          'latest',
        ],
      }),
      signal: controller.signal,
    });

    const json = await response.json() as 
      | { jsonrpc: '2.0'; id: number; result: string }
      | { jsonrpc: '2.0'; id: number; error: { code: number; message: string } };

    if ('error' in json) {
      console.warn('[pilot] balance read failed:', json.error.message);
      return 0n;
    }

    // Decode uint256 result
    if (!json.result || json.result === '0x') {
      return 0n;
    }

    return BigInt(json.result);
  } catch (err) {
    console.warn('[pilot] balance read error:', err);
    return 0n;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Encode balanceOf(address) function call
 */
function encodeBalanceOfCall(address: string): `0x${string}` {
  // balanceOf(address) selector: 0x70a08231
  const selector = '70a08231';
  // Pad address to 32 bytes
  const paddedAddress = address.toLowerCase().replace('0x', '').padStart(64, '0');
  return `0x${selector}${paddedAddress}`;
}

/**
 * Cache for PILOT balances to avoid repeated RPC calls
 */
const balanceCache = new Map<string, { balance: bigint; timestamp: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute cache

/**
 * Get PILOT balance with caching
 */
export async function getPilotBalanceCached(
  userAddress: string,
  config: PilotBalanceReaderConfig,
): Promise<bigint> {
  const cacheKey = `${userAddress.toLowerCase()}`;
  const cached = balanceCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.balance;
  }

  const balance = await getPilotBalance(userAddress, config);
  
  balanceCache.set(cacheKey, {
    balance,
    timestamp: Date.now(),
  });

  return balance;
}

/**
 * Clear the balance cache (useful after token transfers)
 */
export function clearBalanceCache(userAddress?: string): void {
  if (userAddress) {
    balanceCache.delete(userAddress.toLowerCase());
  } else {
    balanceCache.clear();
  }
}
