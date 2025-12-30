"use client";

export type Address = `0x${string}`;

export type TokenInfo = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  logoURI?: string;
  isCustom?: boolean;
  isNative?: boolean;
};

export const NATIVE_BNB: TokenInfo = {
  symbol: 'BNB',
  name: 'BNB',
  address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  decimals: 18,
  isNative: true,
};

// Base tokens always available (fallback when token list fails to load)
export const BASE_TOKENS: TokenInfo[] = [
  NATIVE_BNB,
  {
    symbol: 'ETH',
    name: 'Binance-Peg Ethereum',
    address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    decimals: 18,
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 18,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    decimals: 18,
  },
  {
    symbol: 'BTCB',
    name: 'Bitcoin BEP20',
    address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    decimals: 18,
  },
  {
    symbol: 'CAKE',
    name: 'PancakeSwap',
    address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    decimals: 18,
  },
  {
    symbol: 'BUSD',
    name: 'Binance USD',
    address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    decimals: 18,
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
    decimals: 18,
  },
];

export function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

const CUSTOM_TOKENS_KEY = 'swappilot_custom_tokens';

export function loadCustomTokens(): TokenInfo[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CUSTOM_TOKENS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t): t is any => Boolean(t && typeof t === 'object'))
      .map((t): TokenInfo | null => {
        const symbol = typeof t.symbol === 'string' ? t.symbol : '';
        const name = typeof t.name === 'string' ? t.name : 'Unknown Token';
        const address = typeof t.address === 'string' ? t.address : '';
        const decimals = typeof t.decimals === 'number' ? t.decimals : 18;
        if (!symbol || !isAddress(address)) return null;
        return {
          symbol: normalizeSymbol(symbol),
          name,
          address,
          decimals,
          isCustom: true,
        };
      })
      .filter((x): x is TokenInfo => x !== null);
  } catch {
    return [];
  }
}

export function saveCustomTokens(tokens: TokenInfo[]): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = tokens.map((t) => ({
      symbol: normalizeSymbol(t.symbol),
      name: t.name,
      address: t.address,
      decimals: t.decimals,
      isCustom: true,
    }));
    localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}
