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
   CACHE & DYNAMIC FALLBACK PRICES
   ======================================== */
const CACHE_DURATION_MS = 60_000; // 1 minute
let lastFetchTime = 0;

// Seed prices - only used before first successful API call
// These are intentionally conservative; real prices replace them immediately
const SEED_PRICES: TokenPrices = {
  BNB: { usd: 700, usd_24h_change: 0 },
  ETH: { usd: 3500, usd_24h_change: 0 },
  USDT: { usd: 1, usd_24h_change: 0 },
  USDC: { usd: 1, usd_24h_change: 0 },
  WBTC: { usd: 95000, usd_24h_change: 0 },
  BTCB: { usd: 95000, usd_24h_change: 0 },
  CAKE: { usd: 2.50, usd_24h_change: 0 },
  SOL: { usd: 200, usd_24h_change: 0 },
  BUSD: { usd: 1, usd_24h_change: 0 },
  DAI: { usd: 1, usd_24h_change: 0 },
  LINK: { usd: 20, usd_24h_change: 0 },
  UNI: { usd: 12, usd_24h_change: 0 },
  AAVE: { usd: 300, usd_24h_change: 0 },
  MATIC: { usd: 0.50, usd_24h_change: 0 },
  ARB: { usd: 0.80, usd_24h_change: 0 },
  OP: { usd: 2.00, usd_24h_change: 0 },
};

// Dynamic cache: starts with seeds, updated with real prices on successful fetch
let cachedPrices: TokenPrices = { ...SEED_PRICES };

/* ========================================
   FETCH PRICES VIA API ROUTE (avoids CORS)
   ======================================== */
async function fetchPricesFromAPI(): Promise<TokenPrices> {
  try {
    const response = await fetch('/api/prices', {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.warn('[Prices] API returned', response.status, '- using cached prices');
      return cachedPrices; // Return last known good prices
    }

    const data = await response.json();

    // Convert CoinGecko IDs back to our symbols
    const prices: TokenPrices = { ...cachedPrices }; // Start with cached to preserve known prices
    for (const [symbol, coinGeckoId] of Object.entries(COINGECKO_IDS)) {
      if (data[coinGeckoId]) {
        prices[symbol] = {
          usd: data[coinGeckoId].usd,
          usd_24h_change: data[coinGeckoId].usd_24h_change,
        };
      }
    }

    return prices;
  } catch (err) {
    console.warn('[Prices] Failed to fetch, using cached prices:', err);
    return cachedPrices; // Return last known good prices
  }
}

/* ========================================
   HOOK: useTokenPrices
   ======================================== */
export function useTokenPrices(symbols: string[] = Object.keys(COINGECKO_IDS)): UsePricesReturn {
  const [prices, setPrices] = useState<TokenPrices>(cachedPrices);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const fetchPrices = useCallback(async () => {
    // Avoid concurrent fetches
    if (fetchingRef.current) return;
    
    // Check cache
    const now = Date.now();
    if (now - lastFetchTime < CACHE_DURATION_MS) {
      setPrices(cachedPrices);
      return;
    }

    fetchingRef.current = true;
    // Don't show loading - we already have static prices
    setError(null);

    try {
      const newPrices = await fetchPricesFromAPI();
      cachedPrices = newPrices;
      lastFetchTime = now;
      setPrices(cachedPrices);
    } catch (err) {
      // Silent fail - keep using static/cached prices
      console.warn('[Prices] Error:', err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

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
   UTILITY: Get cached/seed price (server-side or fallback)
   ======================================== */
export function getStaticPrice(symbol: string): number {
  // Use cached prices if available (dynamically updated), otherwise seed prices
  const cached = cachedPrices[symbol.toUpperCase()]?.usd;
  if (cached != null) return cached;
  
  const seed = SEED_PRICES[symbol.toUpperCase()]?.usd;
  return seed ?? 1;
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
