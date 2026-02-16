"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BASE_TOKENS, NATIVE_BNB, type TokenInfo, isAddress, loadCustomTokens, normalizeAddress, normalizeSymbol, saveCustomTokens } from './tokens';

type TokenListToken = {
  chainId?: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
};

type TokenList = {
  name?: string;
  timestamp?: string;
  tokens: TokenListToken[];
};

const DEFAULT_TOKEN_LIST_URL = 'https://tokens.pancakeswap.finance/pancakeswap-extended.json';
const BSC_CHAIN_ID = 56;

const LIST_CACHE_KEY = 'swappilot_token_list_cache_v1';
const LIST_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

function getTokenImageProxyUrl(address: string): string {
  const rawApiUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    (process.env.NODE_ENV === 'production' ? 'https://swappilot-api.fly.dev' : 'http://localhost:3001');
  // If API URL is set, prefer same-origin rewrite (/api/v1/...) to avoid CSP/image domain issues.
  if (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL) {
    return `/api/v1/token-image/${address}`;
  }
  const base = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;
  return `${base}/v1/token-image/${address}`;
}

function getTokenListUrl(): string {
  return process.env.NEXT_PUBLIC_TOKEN_LIST_URL ?? DEFAULT_TOKEN_LIST_URL;
}

function parseTokenList(json: unknown): TokenInfo[] {
  const obj = json as Partial<TokenList> | null;
  const tokens = Array.isArray(obj?.tokens) ? obj!.tokens : [];

  return tokens
    .filter((t): t is TokenListToken => Boolean(t && typeof t === 'object'))
    .filter((t) => (t.chainId == null ? true : t.chainId === BSC_CHAIN_ID))
    .map((t): TokenInfo | null => {
      const address = String((t as any).address ?? '');
      const symbol = String((t as any).symbol ?? '');
      const name = String((t as any).name ?? '');
      const decimals = Number((t as any).decimals ?? 18);
      if (!isAddress(address) || !symbol) return null;

      // Option B: never load third-party logoURI directly in the browser.
      // Always use the API proxy endpoint for the token address.
      const logoURI = getTokenImageProxyUrl(normalizeAddress(address));
      return {
        address,
        symbol: normalizeSymbol(symbol),
        name: name || symbol,
        decimals: Number.isFinite(decimals) ? decimals : 18,
        logoURI,
      };
    })
    .filter((x): x is TokenInfo => x !== null);
}

function loadCachedList(): { tokens: TokenInfo[]; cachedAt: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LIST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    if (!parsed || !Array.isArray(parsed.tokens) || typeof parsed.cachedAt !== 'number') return null;
    return { tokens: parsed.tokens as TokenInfo[], cachedAt: parsed.cachedAt as number };
  } catch {
    return null;
  }
}

function saveCachedList(tokens: TokenInfo[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      LIST_CACHE_KEY,
      JSON.stringify({ tokens, cachedAt: Date.now() }),
    );
  } catch {
    // ignore
  }
}

export function useTokenRegistry() {
  const [listTokens, setListTokens] = useState<TokenInfo[]>([]);
  const [customTokens, setCustomTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCustomTokens(loadCustomTokens());
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const cached = loadCachedList();
    if (cached && Date.now() - cached.cachedAt < LIST_CACHE_TTL_MS) {
      setListTokens(cached.tokens);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(getTokenListUrl(), { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`token_list_http_${res.status}`);
      const json = (await res.json()) as unknown;
      const parsed = parseTokenList(json);
      setListTokens(parsed);
      saveCachedList(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'token_list_fetch_failed');
      setListTokens([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const tokens = useMemo(() => {
    // Start with base tokens as fallback (always available)
    const map = new Map<string, TokenInfo>();
    for (const t of BASE_TOKENS) map.set(normalizeAddress(t.address), t);

    // Add tokens from external list (may override base tokens with richer data)
    for (const t of listTokens) map.set(normalizeAddress(t.address), t);
    
    // Add custom tokens (highest priority)
    for (const t of customTokens) map.set(normalizeAddress(t.address), t);

    return Array.from(map.values());
  }, [listTokens, customTokens]);

  const byAddress = useMemo(() => {
    const m = new Map<string, TokenInfo>();
    for (const t of tokens) m.set(normalizeAddress(t.address), t);
    return m;
  }, [tokens]);

  const bySymbol = useMemo(() => {
    const m = new Map<string, TokenInfo[]>();
    for (const t of tokens) {
      const key = normalizeSymbol(t.symbol);
      const arr = m.get(key) ?? [];
      arr.push(t);
      m.set(key, arr);
    }
    return m;
  }, [tokens]);

  const resolveToken = useCallback(
    (tokenOrSymbolOrAddress: string): TokenInfo | null => {
      const raw = tokenOrSymbolOrAddress.trim();
      if (!raw) return null;
      if (isAddress(raw)) return byAddress.get(normalizeAddress(raw)) ?? { symbol: raw.slice(0, 6) + '…', name: 'Unknown Token', address: raw, decimals: 18, isCustom: true };
      const list = bySymbol.get(normalizeSymbol(raw));
      return list?.[0] ?? null;
    },
    [byAddress, bySymbol],
  );

  const upsertCustomToken = useCallback(
    (token: TokenInfo) => {
      setCustomTokens((prev) => {
        const next = prev.filter((t) => normalizeAddress(t.address) !== normalizeAddress(token.address));
        next.unshift({ ...token, symbol: normalizeSymbol(token.symbol), isCustom: true });
        saveCustomTokens(next);
        return next;
      });
    },
    [],
  );

  return {
    tokens,
    loading,
    error,
    refresh,
    resolveToken,
    upsertCustomToken,
  };
}
