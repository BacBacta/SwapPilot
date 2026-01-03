"use client";

import { useMemo } from "react";
import type { RankedQuote } from "@swappilot/shared";

/**
 * Dynamic slippage calculation based on token characteristics and swap context.
 * Returns recommended slippage in basis points (100 = 1%).
 */

export type DynamicSlippageParams = {
  /** The selected quote with risk signals */
  quote: RankedQuote | null;
  /** User's manual slippage setting (as fallback/minimum) */
  userSlippageBps: number;
  /** Whether auto-slippage is enabled */
  autoSlippageEnabled: boolean;
  /** Token symbol for display */
  tokenSymbol?: string;
};

export type DynamicSlippageResult = {
  /** The recommended slippage in basis points */
  slippageBps: number;
  /** Whether this is an auto-calculated value */
  isAuto: boolean;
  /** Human-readable explanation */
  reason: string;
  /** Risk level indicator */
  riskLevel: "low" | "medium" | "high";
  /** Suggested minimum slippage for this token/swap */
  suggestedMinBps: number;
};

/**
 * Calculates dynamic slippage based on quote signals and token characteristics.
 * 
 * Factors considered:
 * - Sellability status (tokens with uncertain sellability need higher slippage)
 * - MEV exposure (high MEV = more price manipulation = higher slippage)
 * - Revert risk (high revert risk = higher slippage buffer)
 * - Provider type (DEX direct swaps often need higher slippage than aggregators)
 */
export function useDynamicSlippage({
  quote,
  userSlippageBps,
  autoSlippageEnabled,
  tokenSymbol,
}: DynamicSlippageParams): DynamicSlippageResult {
  return useMemo(() => {
    // If auto-slippage is disabled, use user's setting
    if (!autoSlippageEnabled) {
      return {
        slippageBps: userSlippageBps,
        isAuto: false,
        reason: "Manual slippage",
        riskLevel: userSlippageBps <= 100 ? "low" : userSlippageBps <= 300 ? "medium" : "high",
        suggestedMinBps: 50,
      };
    }

    // No quote yet - use default
    if (!quote) {
      return {
        slippageBps: userSlippageBps,
        isAuto: false,
        reason: "Waiting for quote",
        riskLevel: "low",
        suggestedMinBps: 50,
      };
    }

    // Start with base slippage
    let baseBps = 100; // 1% default
    let reason = "Standard slippage";
    let riskLevel: "low" | "medium" | "high" = "low";
    const factors: string[] = [];

    // Factor 1: Sellability status
    const sellability = quote.signals?.sellability;
    if (sellability) {
      if (sellability.status === "FAIL") {
        // Token cannot be sold - very risky
        baseBps = Math.max(baseBps, 500); // 5%
        factors.push("risky token (sell check failed)");
        riskLevel = "high";
      } else if (sellability.status === "UNCERTAIN" || sellability.confidence < 0.5) {
        // Unknown token - higher slippage needed
        baseBps = Math.max(baseBps, 300); // 3%
        factors.push("uncertain sellability");
        riskLevel = "medium";
      } else if (sellability.confidence < 0.8) {
        // Somewhat uncertain
        baseBps = Math.max(baseBps, 200); // 2%
        factors.push("lower confidence");
        riskLevel = "medium";
      }
    }

    // Factor 2: MEV exposure
    const mevExposure = quote.signals?.mevExposure;
    if (mevExposure) {
      if (mevExposure.level === "HIGH") {
        baseBps = Math.max(baseBps, 250); // 2.5%
        factors.push("high MEV exposure");
        riskLevel = riskLevel === "high" ? "high" : "medium";
      } else if (mevExposure.level === "MEDIUM") {
        baseBps = Math.max(baseBps, 150); // 1.5%
        factors.push("moderate MEV risk");
      }
    }

    // Factor 3: Revert risk
    const revertRisk = quote.signals?.revertRisk;
    if (revertRisk) {
      if (revertRisk.level === "HIGH") {
        baseBps = Math.max(baseBps, 300); // 3%
        factors.push("high revert risk");
        riskLevel = "high";
      } else if (revertRisk.level === "MEDIUM") {
        baseBps = Math.max(baseBps, 200); // 2%
        factors.push("moderate revert risk");
        riskLevel = riskLevel === "low" ? "medium" : riskLevel;
      }
    }

    // Factor 4: Provider type (DEX direct vs aggregator)
    if (quote.sourceType === "dex") {
      // DEX direct swaps often have less optimal routing
      baseBps = Math.max(baseBps, 150); // 1.5% minimum for DEX
      factors.push("direct DEX swap");
    }

    // Factor 5: Check revert risk reasons for fee-on-transfer indicators
    const revertReasons = quote.signals?.revertRisk?.reasons ?? [];
    const sellabilityReasons = quote.signals?.sellability?.reasons ?? [];
    const allReasons = [...revertReasons, ...sellabilityReasons];
    const hasFeeOnTransfer = allReasons.some(
      (r: string) =>
        r.toLowerCase().includes("fee") ||
        r.toLowerCase().includes("tax") ||
        r.toLowerCase().includes("transfer")
    );
    if (hasFeeOnTransfer) {
      baseBps = Math.max(baseBps, 400); // 4% for fee tokens
      factors.push("possible transfer fee");
      riskLevel = "high";
    }

    // Build reason string
    if (factors.length > 0) {
      reason = `Auto: ${factors.join(", ")}`;
    } else {
      reason = "Auto: standard token";
    }

    // Use the calculated base slippage when auto is enabled
    // Don't force it higher than what's calculated - user can still set higher manually
    const finalBps = baseBps;

    return {
      slippageBps: finalBps,
      isAuto: true,
      reason,
      riskLevel,
      suggestedMinBps: baseBps,
    };
  }, [quote, userSlippageBps, autoSlippageEnabled]);
}

/**
 * Quick slippage suggestion based on common token patterns.
 * Used when we don't have full quote signals yet.
 */
export function suggestSlippageForToken(tokenAddress: string): number {
  const addr = tokenAddress.toLowerCase();
  
  // Known stablecoins - low slippage
  const stablecoins = [
    "0x55d398326f99059ff775485246999027b3197955", // USDT
    "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
    "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
    "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3", // DAI
  ];
  if (stablecoins.includes(addr)) {
    return 50; // 0.5%
  }

  // Native/wrapped native - low slippage
  const native = [
    "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WBNB
    "0x0000000000000000000000000000000000000000",
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  ];
  if (native.includes(addr)) {
    return 100; // 1%
  }

  // Major tokens - standard slippage
  const majorTokens = [
    "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // ETH
    "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", // BTCB
    "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", // CAKE
  ];
  if (majorTokens.includes(addr)) {
    return 100; // 1%
  }

  // Unknown token - higher default
  return 200; // 2%
}
