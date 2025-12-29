"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ========================================
   TYPES
   ======================================== */
export interface TokenPrice {
  usd: number;
  usd_24h_change?: number;
}

export interface TokenPrices {
  [tokenId: string]: TokenPrice;
}

interface UsePricesReturn {
  prices: TokenPrices;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getPrice: (symbol: string) => number | null;
  formatUsd: (amount: number, symbol: string) => string;
}

/* ========================================
   COINGECKO TOKEN ID MAPPING
   Maps our token symbols to CoinGecko IDs
   ======================================== */
const COINGECKO_IDS: Record<string, string> = {
  BNB: "binancecoin",
  ETH: "ethereum",
  USDT: "tether",
  USDC: "usd-coin",
  WBTC: "wrapped-bitcoin",
  CAKE: "pancakeswap-token",
  SOL: "solana",
  BUSD: "binance-usd",
  DAI: "dai",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  MATIC: "matic-network",
  ARB: "arbitrum",
  OP: "optimism",
};

/* ========================================
   CACHE
   ======================================== */
const CACHE_DURATION_MS = 60_000; // 1 minute
let cachedPrices: TokenPrices = {};
let lastFetchTime = 0;

/* ========================================
   FETCH PRICES VIA API ROUTE (avoids CORS)
   ======================================== */
async function fetchPricesFromCoinGecko(symbols: string[]): Promise<TokenPrices> {
  // Use our API route to proxy CoinGecko requests (avoids CORS and rate limits)
  const response = await fetch('/api/prices', {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Prices API error: ${response.status}`);
  }

  const data = await response.json();

  // Convert CoinGecko IDs back to our symbols
  const prices: TokenPrices = {};
  for (const [symbol, coinGeckoId] of Object.entries(COINGECKO_IDS)) {
    if (data[coinGeckoId]) {
      prices[symbol] = {
        usd: data[coinGeckoId].usd,
        usd_24h_change: data[coinGeckoId].usd_24h_change,
      };
    }
  }

  return prices;
}

/* ========================================
   HOOK: useTokenPrices
   ======================================== */
export function useTokenPrices(symbols: string[] = Object.keys(COINGECKO_IDS)): UsePricesReturn {
  const [prices, setPrices] = useState<TokenPrices>(cachedPrices);
  const [loading, setLoading] = useState(Object.keys(cachedPrices).length === 0);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const fetchPrices = useCallback(async () => {
    // Avoid concurrent fetches
    if (fetchingRef.current) return;
    
    // Check cache
    const now = Date.now();
    if (now - lastFetchTime < CACHE_DURATION_MS && Object.keys(cachedPrices).length > 0) {
      setPrices(cachedPrices);
      setLoading(false);
      return;
    }

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const newPrices = await fetchPricesFromCoinGecko(symbols);
      cachedPrices = { ...cachedPrices, ...newPrices };
      lastFetchTime = now;
      setPrices(cachedPrices);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch prices");
      // Keep using cached prices on error
      if (Object.keys(cachedPrices).length > 0) {
        setPrices(cachedPrices);
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [symbols]);

  useEffect(() => {
    fetchPrices();
    
    // Refresh every minute
    const interval = setInterval(fetchPrices, CACHE_DURATION_MS);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const getPrice = useCallback(
    (symbol: string): number | null => {
      return prices[symbol.toUpperCase()]?.usd ?? null;
    },
    [prices]
  );

  const formatUsd = useCallback(
    (amount: number, symbol: string): string => {
      const price = getPrice(symbol);
      if (price === null) return "—";
      const value = amount * price;
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
    [getPrice]
  );

  return {
    prices,
    loading,
    error,
    refetch: fetchPrices,
    getPrice,
    formatUsd,
  };
}

/* ========================================
   UTILITY: Get static price (server-side or fallback)
   ======================================== */
export function getStaticPrice(symbol: string): number {
  // Fallback static prices if API fails
  const STATIC_PRICES: Record<string, number> = {
    BNB: 600,
    ETH: 3500,
    USDT: 1,
    USDC: 1,
    WBTC: 95000,
    CAKE: 2.5,
    SOL: 200,
    BUSD: 1,
    DAI: 1,
    LINK: 22,
    UNI: 12,
    AAVE: 350,
  };
  return STATIC_PRICES[symbol.toUpperCase()] ?? 1;
}

/* ========================================
   UTILITY: Convert token amount to USD
   ======================================== */
export function tokenToUsd(amount: number, symbol: string, prices: TokenPrices): number {
  const price = prices[symbol.toUpperCase()]?.usd ?? getStaticPrice(symbol);
  return amount * price;
}

/* ========================================
   UTILITY: Convert USD to token amount
   ======================================== */
export function usdToToken(usdAmount: number, symbol: string, prices: TokenPrices): number {
  const price = prices[symbol.toUpperCase()]?.usd ?? getStaticPrice(symbol);
  if (price === 0) return 0;
  return usdAmount / price;
}
