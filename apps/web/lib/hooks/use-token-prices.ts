"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// CoinGecko API for token prices (free tier)
const COINGECKO_API = "https://api.coingecko.com/api/v3";

// Token address to CoinGecko ID mapping for BSC tokens
const TOKEN_TO_COINGECKO: Record<string, string> = {
  // Native BNB
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "binancecoin",
  // WBNB
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": "binancecoin",
  // ETH (BSC pegged)
  "0x2170ed0880ac9a755fd29b2688956bd959f933f8": "ethereum",
  // USDT (BSC)
  "0x55d398326f99059ff775485246999027b3197955": "tether",
  // USDC (BSC)
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": "usd-coin",
  // BTCB
  "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c": "bitcoin",
  // CAKE
  "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82": "pancakeswap-token",
  // BUSD
  "0xe9e7cea3dedca5984780bafc599bd69add087d56": "binance-usd",
  // DAI
  "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3": "dai",
};

export type TokenPrices = Record<string, number>;

export interface UseTokenPricesReturn {
  prices: TokenPrices;
  isLoading: boolean;
  error: string | null;
  getPrice: (address: string) => number | null;
  formatUsd: (address: string, amount: number) => string;
  refetch: () => void;
}

// Cache prices for 60 seconds
let priceCache: { prices: TokenPrices; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000;

// Cache for unknown token lookups (to avoid repeated failures)
const unknownTokenCache = new Map<string, { price: number | null; timestamp: number }>();
const UNKNOWN_CACHE_TTL_MS = 5 * 60_000; // 5 minutes for unknown tokens

// Fetch price for unknown BSC token via CoinGecko contract API
async function fetchBscTokenPrice(address: string): Promise<number | null> {
  const normalizedAddr = address.toLowerCase();
  
  // Check cache first
  const cached = unknownTokenCache.get(normalizedAddr);
  if (cached && Date.now() - cached.timestamp < UNKNOWN_CACHE_TTL_MS) {
    return cached.price;
  }
  
  // Skip native address
  if (normalizedAddr === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
    return null;
  }
  
  try {
    const response = await fetch(
      `${COINGECKO_API}/simple/token_price/binance-smart-chain?contract_addresses=${normalizedAddr}&vs_currencies=usd`,
      { cache: "no-store" }
    );
    
    if (!response.ok) {
      unknownTokenCache.set(normalizedAddr, { price: null, timestamp: Date.now() });
      return null;
    }
    
    const data = await response.json() as Record<string, { usd?: number }>;
    const price = data[normalizedAddr]?.usd ?? null;
    unknownTokenCache.set(normalizedAddr, { price, timestamp: Date.now() });
    return price;
  } catch {
    unknownTokenCache.set(normalizedAddr, { price: null, timestamp: Date.now() });
    return null;
  }
}

export function useTokenPrices(tokenAddresses: string[] = []): UseTokenPricesReturn {
  const [prices, setPrices] = useState<TokenPrices>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingFetches = useRef<Set<string>>(new Set());

  const fetchPrices = useCallback(async () => {
    const normalizedAddresses = tokenAddresses.map((a) => a.toLowerCase());
    
    // Check cache first for known tokens
    if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL_MS) {
      // Use cached prices but check for new unknown tokens
      const newPrices = { ...priceCache.prices };
      let hasNewPrices = false;
      
      // Fetch prices for unknown tokens not in cache
      for (const addr of normalizedAddresses) {
        if (!TOKEN_TO_COINGECKO[addr] && !newPrices[addr] && !pendingFetches.current.has(addr)) {
          pendingFetches.current.add(addr);
          fetchBscTokenPrice(addr).then((price) => {
            if (price !== null) {
              setPrices((prev) => ({ ...prev, [addr]: price }));
            }
            pendingFetches.current.delete(addr);
          });
        }
      }
      
      setPrices(newPrices);
      if (!hasNewPrices) return;
    }

    const geckoIds = normalizedAddresses
      .map((addr) => TOKEN_TO_COINGECKO[addr])
      .filter((id): id is string => !!id);

    setIsLoading(true);
    setError(null);

    try {
      const newPrices: TokenPrices = {};
      
      // Fetch known token prices
      if (geckoIds.length > 0) {
        const idsParam = [...new Set(geckoIds)].join(",");
        const response = await fetch(
          `${COINGECKO_API}/simple/price?ids=${idsParam}&vs_currencies=usd`,
          { cache: "no-store" }
        );

        if (response.ok) {
          const data = (await response.json()) as Record<string, { usd?: number }>;

          // Map back to addresses
          for (const addr of normalizedAddresses) {
            const geckoId = TOKEN_TO_COINGECKO[addr];
            if (geckoId && data[geckoId]?.usd !== undefined) {
              newPrices[addr] = data[geckoId].usd;
            }
          }
        }
      }
      
      // Fetch unknown token prices in parallel
      const unknownAddresses = normalizedAddresses.filter(
        (addr) => !TOKEN_TO_COINGECKO[addr] && !newPrices[addr]
      );
      
      const unknownPrices = await Promise.all(
        unknownAddresses.map(async (addr) => {
          const price = await fetchBscTokenPrice(addr);
          return { addr, price };
        })
      );
      
      for (const { addr, price } of unknownPrices) {
        if (price !== null) {
          newPrices[addr] = price;
        }
      }

      setPrices(newPrices);
      priceCache = { prices: newPrices, timestamp: Date.now() };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch prices");
    } finally {
      setIsLoading(false);
    }
  }, [tokenAddresses]);

  useEffect(() => {
    if (tokenAddresses.length > 0) {
      void fetchPrices();
    }
  }, [fetchPrices, tokenAddresses]);

  const getPrice = useCallback(
    (address: string): number | null => {
      return prices[address.toLowerCase()] ?? null;
    },
    [prices]
  );

  const formatUsd = useCallback(
    (address: string, amount: number): string => {
      const price = getPrice(address);
      // If amount is 0, always show $0.00
      if (amount === 0) {
        return "$0.00";
      }
      // If price is not available, show dash
      if (price === null || !Number.isFinite(amount)) {
        return "—";
      }
      const usdValue = amount * price;
      if (usdValue < 0.01 && usdValue > 0) {
        return "<$0.01";
      }
      return `$${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
    [getPrice]
  );

  return {
    prices,
    isLoading,
    error,
    getPrice,
    formatUsd,
    refetch: fetchPrices,
  };
}
