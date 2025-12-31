"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { BASE_TOKENS, NATIVE_BNB, type TokenInfo, isAddress, loadCustomTokens, normalizeAddress, normalizeSymbol, saveCustomTokens } from '@/lib/tokens';
import { resolveTokenMetadata } from '@/lib/api';

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
      const logoURI = typeof (t as any).logoURI === 'string' ? (t as any).logoURI : undefined;
      if (!isAddress(address) || !symbol) return null;
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

interface TokenRegistryContextType {
  tokens: TokenInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  resolveToken: (tokenOrSymbolOrAddress: string) => TokenInfo | null;
  upsertCustomToken: (token: TokenInfo) => void;
}

const TokenRegistryContext = createContext<TokenRegistryContextType | null>(null);

export function TokenRegistryProvider({ children }: { children: ReactNode }) {
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
    const map = new Map<string, TokenInfo>();
    for (const t of BASE_TOKENS) map.set(normalizeAddress(t.address), t);
    for (const t of listTokens) map.set(normalizeAddress(t.address), t);
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

  // Track pending resolution requests to avoid duplicates
  const pendingResolutions = useRef<Set<string>>(new Set());

  const resolveToken = useCallback(
    (tokenOrSymbolOrAddress: string): TokenInfo | null => {
      const raw = tokenOrSymbolOrAddress.trim();
      if (!raw) return null;
      if (isAddress(raw)) {
        const existing = byAddress.get(normalizeAddress(raw));
        if (existing) return existing;
        
        // Token not in registry - trigger async resolution if not already pending
        const normalizedAddr = normalizeAddress(raw);
        if (!pendingResolutions.current.has(normalizedAddr)) {
          pendingResolutions.current.add(normalizedAddr);
          
          // Fire and forget - will update customTokens when resolved
          resolveTokenMetadata({ address: raw as `0x${string}`, timeoutMs: 5000 })
            .then((meta) => {
              const newToken: TokenInfo = {
                address: raw as `0x${string}`,
                symbol: meta.symbol ?? raw.slice(0, 6) + '…',
                name: meta.name ?? 'Unknown Token',
                decimals: meta.decimals,
                isCustom: true,
                isNative: meta.isNative,
              };
              // Add to custom tokens to persist and trigger re-render
              setCustomTokens((prev) => {
                // Don't add if already exists
                if (prev.some(t => normalizeAddress(t.address) === normalizedAddr)) return prev;
                const next = [...prev, newToken];
                saveCustomTokens(next);
                return next;
              });
            })
            .catch(() => {
              // Ignore errors - will use default decimals
            })
            .finally(() => {
              pendingResolutions.current.delete(normalizedAddr);
            });
        }
        
        // Return placeholder immediately with default decimals
        // Will be updated on next render after async resolution completes
        return { 
          symbol: raw.slice(0, 6) + '…', 
          name: 'Unknown Token', 
          address: raw as `0x${string}`, 
          decimals: 18, 
          isCustom: true 
        };
      }
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

  const value = useMemo(() => ({
    tokens,
    loading,
    error,
    refresh,
    resolveToken,
    upsertCustomToken,
  }), [tokens, loading, error, refresh, resolveToken, upsertCustomToken]);

  return (
    <TokenRegistryContext.Provider value={value}>
      {children}
    </TokenRegistryContext.Provider>
  );
}

export function useTokenRegistry() {
  const context = useContext(TokenRegistryContext);
  if (!context) {
    throw new Error('useTokenRegistry must be used within a TokenRegistryProvider');
  }
  return context;
}
