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
