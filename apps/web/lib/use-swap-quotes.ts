"use client";

import { useState, useCallback } from "react";
import { postQuotes, getReceipt, type ApiError } from "@/lib/api";
import type { QuoteResponse, QuoteRequest, DecisionReceipt, RankedQuote } from "@swappilot/shared";

/* ========================================
   TOKEN ADDRESSES (BNB Chain = 56)
   ======================================== */
export const TOKEN_ADDRESSES: Record<string, string> = {
  BNB: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Native
  ETH: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", // WETH on BSC
  USDT: "0x55d398326f99059fF775485246999027B3197955",
  USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  WBTC: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
  CAKE: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  SOL: "0x570A5D26f7765Ecb712C0924E4De545B89fD43dF", // Wrapped SOL on BSC
};

const TOKEN_DECIMALS: Record<string, number> = {
  BNB: 18,
  ETH: 18,
  USDT: 18,
  USDC: 18,
  WBTC: 18,
  CAKE: 18,
  SOL: 18,
};

/* ========================================
   TYPES
   ======================================== */
export type QuoteState = {
  status: "idle" | "loading" | "success" | "error";
  data: QuoteResponse | null;
  error: ApiError | null;
};

export type ReceiptState = {
  status: "idle" | "loading" | "success" | "error";
  data: DecisionReceipt | null;
  error: ApiError | null;
};

export interface UseSwapQuotesReturn {
  quotes: QuoteState;
  receipt: ReceiptState;
  fetchQuotes: (params: FetchQuotesParams) => Promise<void>;
  fetchReceipt: (receiptId: string) => Promise<void>;
  reset: () => void;
  // Computed values
  bestExecutableQuote: RankedQuote | null;
  bestRawQuote: RankedQuote | null;
  rankedQuotes: RankedQuote[];
}

export interface FetchQuotesParams {
  sellToken: string;
  buyToken: string;
  sellAmountUsd: number;
  slippageBps?: number;
  mode?: "SAFE" | "NORMAL" | "DEGEN";
}

/* ========================================
   HOOK
   ======================================== */
export function useSwapQuotes(): UseSwapQuotesReturn {
  const [quotes, setQuotes] = useState<QuoteState>({
    status: "idle",
    data: null,
    error: null,
  });

  const [receipt, setReceipt] = useState<ReceiptState>({
    status: "idle",
    data: null,
    error: null,
  });

  const fetchQuotes = useCallback(async (params: FetchQuotesParams) => {
    const sellAddress = TOKEN_ADDRESSES[params.sellToken];
    const buyAddress = TOKEN_ADDRESSES[params.buyToken];

    if (!sellAddress || !buyAddress) {
      setQuotes({
        status: "error",
        data: null,
        error: { kind: "invalid_response", message: `Unknown token: ${!sellAddress ? params.sellToken : params.buyToken}` },
      });
      return;
    }

    // Convert USD to approximate token amount (simplified)
    const decimals = TOKEN_DECIMALS[params.sellToken] ?? 18;
    // Assume 1 token ≈ $1 for simplicity in demo
    const sellAmount = BigInt(Math.floor(params.sellAmountUsd * 10 ** decimals)).toString();

    const request: QuoteRequest = {
      chainId: 56, // BNB Chain
      sellToken: sellAddress,
      buyToken: buyAddress,
      sellAmount,
      slippageBps: params.slippageBps ?? 50,
      mode: params.mode ?? "NORMAL",
    };

    setQuotes({ status: "loading", data: null, error: null });

    try {
      const response = await postQuotes({ request, timeoutMs: 15_000 });
      setQuotes({ status: "success", data: response, error: null });
    } catch (err) {
      setQuotes({
        status: "error",
        data: null,
        error: err as ApiError,
      });
    }
  }, []);

  const fetchReceipt = useCallback(async (receiptId: string) => {
    setReceipt({ status: "loading", data: null, error: null });

    try {
      const data = await getReceipt({ id: receiptId, timeoutMs: 10_000 });
      setReceipt({ status: "success", data, error: null });
    } catch (err) {
      setReceipt({
        status: "error",
        data: null,
        error: err as ApiError,
      });
    }
  }, []);

  const reset = useCallback(() => {
    setQuotes({ status: "idle", data: null, error: null });
    setReceipt({ status: "idle", data: null, error: null });
  }, []);

  // Computed values
  const rankedQuotes = quotes.data?.rankedQuotes ?? [];
  const bestExecutableQuote = quotes.data
    ? rankedQuotes.find((q) => q.providerId === quotes.data?.bestExecutableQuoteProviderId) ?? null
    : null;
  const bestRawQuote = quotes.data
    ? (quotes.data.bestRawQuotes[0] ?? null)
    : null;

  return {
    quotes,
    receipt,
    fetchQuotes,
    fetchReceipt,
    reset,
    bestExecutableQuote,
    bestRawQuote,
    rankedQuotes,
  };
}

/* ========================================
   HELPERS
   ======================================== */
export function formatQuoteOutput(quote: RankedQuote): string {
  const amount = BigInt(quote.normalized.buyAmount);
  const decimals = 18; // Assume 18 decimals
  const value = Number(amount) / 10 ** decimals;
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function formatQuoteUsd(quote: RankedQuote): string {
  // Simplified: use effectivePrice as proxy
  const price = parseFloat(quote.normalized.effectivePrice);
  const amount = Number(BigInt(quote.normalized.buyAmount)) / 10 ** 18;
  // This is simplified - in production you'd use actual price feeds
  return `$${(amount * 1).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function getConfidenceFromQuote(quote: RankedQuote): number {
  const sellability = quote.signals.sellability.confidence * 100;
  return Math.round(sellability);
}

export function getQuoteFlags(quote: RankedQuote): string[] {
  const flags: string[] = [];
  
  if (quote.signals.mevExposure.level === "HIGH") flags.push("MEV");
  if (quote.signals.sellability.status === "OK") flags.push("SELL_OK");
  if (quote.signals.sellability.status === "UNCERTAIN") flags.push("SELL_UNCERTAIN");
  if (quote.signals.revertRisk.level === "HIGH") flags.push("REVERT_RISK");
  
  return flags;
}
