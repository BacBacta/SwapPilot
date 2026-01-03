"use client";

import { useState, useEffect, useCallback } from "react";

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

export function useTokenPrices(tokenAddresses: string[] = []): UseTokenPricesReturn {
  const [prices, setPrices] = useState<TokenPrices>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    // Check cache first
    if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL_MS) {
      setPrices(priceCache.prices);
      return;
    }

    const normalizedAddresses = tokenAddresses.map((a) => a.toLowerCase());
    const geckoIds = normalizedAddresses
      .map((addr) => TOKEN_TO_COINGECKO[addr])
      .filter((id): id is string => !!id);

    if (geckoIds.length === 0) {
      // If no known tokens, skip API call
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const idsParam = [...new Set(geckoIds)].join(",");
      const response = await fetch(
        `${COINGECKO_API}/simple/price?ids=${idsParam}&vs_currencies=usd`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = (await response.json()) as Record<string, { usd?: number }>;

      // Map back to addresses
      const newPrices: TokenPrices = {};
      for (const addr of normalizedAddresses) {
        const geckoId = TOKEN_TO_COINGECKO[addr];
        if (geckoId && data[geckoId]?.usd !== undefined) {
          newPrices[addr] = data[geckoId].usd;
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
      if (price === null || !Number.isFinite(amount)) {
        return "$0.00";
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
