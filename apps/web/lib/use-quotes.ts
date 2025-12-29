"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { QuoteRequest, QuoteResponse, RankedQuote } from "@swappilot/shared";

/* ========================================
   API CONFIGURATION
   ======================================== */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const QUOTE_CACHE_TTL_MS = 10_000; // 10 seconds cache
const QUOTE_DEBOUNCE_MS = 500; // Debounce API calls

/* ========================================
   TYPES
   ======================================== */

export interface QuoteState {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  data: QuoteResponse | null;
  receiptId: string | null;
  bestQuote: RankedQuote | null;
  allQuotes: RankedQuote[];
  lastFetchedAt: number | null;
}

export interface UseQuotesOptions {
  /** Auto-refetch interval in ms (0 = disabled) */
  refetchInterval?: number;
  /** Enabled/disabled state */
  enabled?: boolean;
  /** On success callback */
  onSuccess?: (data: QuoteResponse) => void;
  /** On error callback */
  onError?: (error: Error) => void;
}

interface CacheEntry {
  data: QuoteResponse;
  timestamp: number;
}

/* ========================================
   CACHE
   ======================================== */

const quoteCache = new Map<string, CacheEntry>();

function getCacheKey(request: QuoteRequest): string {
  return JSON.stringify({
    chainId: request.chainId,
    sellToken: request.sellToken.toLowerCase(),
    buyToken: request.buyToken.toLowerCase(),
    sellAmount: request.sellAmount,
    slippageBps: request.slippageBps,
    mode: request.mode,
  });
}

function getCachedQuote(request: QuoteRequest): QuoteResponse | null {
  const key = getCacheKey(request);
  const entry = quoteCache.get(key);
  
  if (!entry) return null;
  
  const isExpired = Date.now() - entry.timestamp > QUOTE_CACHE_TTL_MS;
  if (isExpired) {
    quoteCache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCachedQuote(request: QuoteRequest, data: QuoteResponse): void {
  const key = getCacheKey(request);
  quoteCache.set(key, { data, timestamp: Date.now() });
  
  // Limit cache size
  if (quoteCache.size > 50) {
    const firstKey = quoteCache.keys().next().value;
    if (firstKey) quoteCache.delete(firstKey);
  }
}

/* ========================================
   API CLIENT
   ======================================== */

export async function fetchQuotes(request: QuoteRequest): Promise<QuoteResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/quotes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(`API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return data as QuoteResponse;
}

export async function fetchReceipt(receiptId: string): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}/v1/receipts/${receiptId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Receipt not found");
    }
    throw new Error(`API error ${response.status}`);
  }

  return response.json();
}

/* ========================================
   USE QUOTES HOOK
   ======================================== */

export function useQuotes(
  request: QuoteRequest | null,
  options: UseQuotesOptions = {}
): QuoteState & {
  refetch: () => Promise<void>;
  invalidate: () => void;
} {
  const { refetchInterval = 0, enabled = true, onSuccess, onError } = options;

  const [state, setState] = useState<QuoteState>({
    isLoading: false,
    isError: false,
    error: null,
    data: null,
    receiptId: null,
    bestQuote: null,
    allQuotes: [],
    lastFetchedAt: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchQuotesInternal = useCallback(
    async (req: QuoteRequest, skipCache = false) => {
      // Check cache first
      if (!skipCache) {
        const cached = getCachedQuote(req);
        if (cached) {
          setState({
            isLoading: false,
            isError: false,
            error: null,
            data: cached,
            receiptId: cached.receiptId,
            bestQuote: cached.rankedQuotes[0] ?? null,
            allQuotes: cached.rankedQuotes,
            lastFetchedAt: Date.now(),
          });
          return;
        }
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setState((prev) => ({ ...prev, isLoading: true, isError: false, error: null }));

      try {
        const data = await fetchQuotes(req);
        
        // Cache the result
        setCachedQuote(req, data);

        setState({
          isLoading: false,
          isError: false,
          error: null,
          data,
          receiptId: data.receiptId,
          bestQuote: data.rankedQuotes[0] ?? null,
          allQuotes: data.rankedQuotes,
          lastFetchedAt: Date.now(),
        });

        onSuccess?.(data);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const error = err instanceof Error ? err : new Error("Unknown error");
        
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isError: true,
          error,
        }));

        onError?.(error);
      }
    },
    [onSuccess, onError]
  );

  // Debounced fetch when request changes
  useEffect(() => {
    if (!request || !enabled) {
      return;
    }

    // Clear previous debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      fetchQuotesInternal(request);
    }, QUOTE_DEBOUNCE_MS);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [request, enabled, fetchQuotesInternal]);

  // Auto-refetch interval
  useEffect(() => {
    if (!request || !enabled || refetchInterval <= 0) {
      return;
    }

    refetchIntervalRef.current = setInterval(() => {
      fetchQuotesInternal(request, true); // Skip cache for refetch
    }, refetchInterval);

    return () => {
      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
      }
    };
  }, [request, enabled, refetchInterval, fetchQuotesInternal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
      }
    };
  }, []);

  const refetch = useCallback(async () => {
    if (request) {
      await fetchQuotesInternal(request, true);
    }
  }, [request, fetchQuotesInternal]);

  const invalidate = useCallback(() => {
    if (request) {
      const key = getCacheKey(request);
      quoteCache.delete(key);
    }
  }, [request]);

  return {
    ...state,
    refetch,
    invalidate,
  };
}

/* ========================================
   USE QUOTE REQUEST BUILDER
   ======================================== */

interface QuoteRequestBuilderState {
  sellToken: string | null;
  buyToken: string | null;
  sellAmount: string;
  slippageBps: number;
  account: string | null;
  chainId: number;
  mode: "SAFE" | "NORMAL" | "DEGEN";
}

export function useQuoteRequestBuilder(initialChainId = 56) {
  const [state, setState] = useState<QuoteRequestBuilderState>({
    sellToken: null,
    buyToken: null,
    sellAmount: "",
    slippageBps: 50, // 0.5% default
    account: null,
    chainId: initialChainId,
    mode: "NORMAL",
  });

  const setField = useCallback(
    <K extends keyof QuoteRequestBuilderState>(
      field: K,
      value: QuoteRequestBuilderState[K]
    ) => {
      setState((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const isValid =
    state.sellToken !== null &&
    state.buyToken !== null &&
    state.sellAmount !== "" &&
    state.sellAmount !== "0" &&
    BigInt(state.sellAmount) > 0n;

  const request: QuoteRequest | null = isValid
    ? {
        chainId: state.chainId,
        sellToken: state.sellToken!,
        buyToken: state.buyToken!,
        sellAmount: state.sellAmount,
        slippageBps: state.slippageBps,
        account: state.account ?? undefined,
        mode: state.mode,
      }
    : null;

  const swapTokens = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sellToken: prev.buyToken,
      buyToken: prev.sellToken,
      sellAmount: "", // Reset amount on swap
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      sellToken: null,
      buyToken: null,
      sellAmount: "",
      slippageBps: 50,
      account: null,
      chainId: initialChainId,
      mode: "NORMAL",
    });
  }, [initialChainId]);

  return {
    ...state,
    setField,
    isValid,
    request,
    swapTokens,
    reset,
  };
}
