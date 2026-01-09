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
  tokenSymbol?: string | undefined;
  /** Sell token address for risk assessment */
  sellTokenAddress?: string | undefined;
  /** Buy token address for risk assessment */
  buyTokenAddress?: string | undefined;
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
  /** Detected tax percentages */
  detectedTaxes?: {
    buyTaxPercent: number | null;
    sellTaxPercent: number | null;
    transferTaxPercent: number | null;
  } | undefined;
};

/**
 * Parse tax data from security check reasons.
 * Extracts buy_tax, sell_tax, transfer_tax from GoPlus and Honeypot.is responses.
 */
function parseTaxesFromReasons(reasons: string[]): {
  buyTaxPercent: number | null;
  sellTaxPercent: number | null;
  transferTaxPercent: number | null;
  holderAvgTaxPercent: number | null;
  isHoneypot: boolean;
  cannotSellAll: boolean;
} {
  let buyTaxPercent: number | null = null;
  let sellTaxPercent: number | null = null;
  let transferTaxPercent: number | null = null;
  let holderAvgTaxPercent: number | null = null;
  let isHoneypot = false;
  let cannotSellAll = false;

  for (const reason of reasons) {
    // Parse tax values from GoPlus/Honeypot.is
    const buyTaxMatch = reason.match(/buy_tax:([0-9.]+)/);
    if (buyTaxMatch && buyTaxMatch[1]) buyTaxPercent = parseFloat(buyTaxMatch[1]);

    const sellTaxMatch = reason.match(/sell_tax:([0-9.]+)/);
    if (sellTaxMatch && sellTaxMatch[1]) sellTaxPercent = parseFloat(sellTaxMatch[1]);

    const transferTaxMatch = reason.match(/transfer_tax:([0-9.]+)/);
    if (transferTaxMatch && transferTaxMatch[1]) transferTaxPercent = parseFloat(transferTaxMatch[1]);

    const holderAvgMatch = reason.match(/holder_avg_tax:([0-9.]+)/);
    if (holderAvgMatch && holderAvgMatch[1]) holderAvgTaxPercent = parseFloat(holderAvgMatch[1]);

    // Detect critical flags
    if (reason.includes("is_honeypot")) isHoneypot = true;
    if (reason.includes("cannot_sell_all")) cannotSellAll = true;
  }

  return {
    buyTaxPercent,
    sellTaxPercent,
    transferTaxPercent,
    holderAvgTaxPercent,
    isHoneypot,
    cannotSellAll,
  };
}

/**
 * Calculates dynamic slippage based on quote signals and token characteristics.
 * 
 * Factors considered:
 * - Actual tax rates from GoPlus and Honeypot.is (buy/sell/transfer taxes)
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
  sellTokenAddress,
  buyTokenAddress,
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

    // Get token address from params for risk assessment
    const buyAddr = buyTokenAddress?.toLowerCase() ?? "";
    const sellAddr = sellTokenAddress?.toLowerCase() ?? "";
    
    // Check if either token is a known safe token
    const safeTokens = [
      "0x55d398326f99059ff775485246999027b3197955", // USDT
      "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
      "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
      "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3", // DAI
      "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WBNB
      "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // ETH
      "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", // BTCB
      "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", // CAKE
      "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // Native
      "0x0000000000000000000000000000000000000000", // Native
    ];
    
    const isBuyTokenSafe = !buyAddr || safeTokens.includes(buyAddr);
    const isSellTokenSafe = !sellAddr || safeTokens.includes(sellAddr);
    const hasUnknownToken = !isBuyTokenSafe || !isSellTokenSafe;

    // Extract tax data from sellability reasons
    const sellabilityReasons = quote.signals?.sellability?.reasons ?? [];
    const revertReasons = quote.signals?.revertRisk?.reasons ?? [];
    const allReasons = [...sellabilityReasons, ...revertReasons];
    
    const taxData = parseTaxesFromReasons(allReasons);
    const { buyTaxPercent, sellTaxPercent, transferTaxPercent, holderAvgTaxPercent, isHoneypot, cannotSellAll } = taxData;

    // Calculate max tax from all sources
    const maxTax = Math.max(
      buyTaxPercent ?? 0,
      sellTaxPercent ?? 0,
      transferTaxPercent ?? 0,
      holderAvgTaxPercent ?? 0
    );
    
    const hasTaxData = buyTaxPercent !== null || sellTaxPercent !== null || transferTaxPercent !== null;
    const isFeeOnTransfer = maxTax > 0.1;

    // Build factors list and calculate slippage
    const factors: string[] = [];
    let baseBps = 50; // Start with 0.5% base
    let riskLevel: "low" | "medium" | "high" = "low";

    // ============================================
    // PRIORITY 1: Honeypot / Cannot Sell (Critical)
    // ============================================
    if (isHoneypot || cannotSellAll) {
      factors.push("⚠️ honeypot/cannot-sell detected");
      baseBps = Math.max(baseBps, 4900); // 49% - near maximum
      riskLevel = "high";
    }

    // ============================================
    // PRIORITY 2: Actual Tax Data from Oracles
    // ============================================
    else if (hasTaxData && maxTax > 0) {
      // Convert tax percent to bps and add 30% safety margin
      const taxBps = Math.round(maxTax * 100 * 1.3);
      baseBps = Math.max(baseBps, taxBps + 50); // Tax + 0.5% buffer
      
      if (buyTaxPercent !== null && buyTaxPercent > 0) {
        factors.push(`buy tax: ${buyTaxPercent.toFixed(1)}%`);
      }
      if (sellTaxPercent !== null && sellTaxPercent > 0) {
        factors.push(`sell tax: ${sellTaxPercent.toFixed(1)}%`);
      }
      if (transferTaxPercent !== null && transferTaxPercent > 0) {
        factors.push(`transfer tax: ${transferTaxPercent.toFixed(1)}%`);
      }
      
      // Use holder analysis for more accurate real-world data
      if (holderAvgTaxPercent !== null && holderAvgTaxPercent > maxTax) {
        const holderTaxBps = Math.round(holderAvgTaxPercent * 100 * 1.3);
        baseBps = Math.max(baseBps, holderTaxBps + 50);
        factors.push(`observed avg: ${holderAvgTaxPercent.toFixed(1)}%`);
      }

      // Set risk level based on tax amount
      if (maxTax >= 15) {
        riskLevel = "high";
      } else if (maxTax >= 5) {
        riskLevel = "medium";
      }
    }

    // ============================================
    // PRIORITY 3: Sellability Status (No Tax Data)
    // ============================================
    else {
      const sellability = quote.signals?.sellability;
      if (sellability) {
        if (sellability.status === "FAIL") {
          // Token cannot be sold - very risky, likely has transfer fees
          baseBps = Math.max(baseBps, 1500); // 15% for tokens with sell issues
          factors.push("risky token (sell check failed)");
          riskLevel = "high";
        } else if (sellability.status === "UNCERTAIN" || sellability.confidence < 0.5) {
          // Unknown token - higher slippage needed
          baseBps = Math.max(baseBps, 800); // 8%
          factors.push("uncertain sellability");
          riskLevel = "high";
        } else if (sellability.confidence < 0.8) {
          // Somewhat uncertain
          baseBps = Math.max(baseBps, 400); // 4%
          factors.push("lower confidence");
          riskLevel = "medium";
        }
      }

      // Unknown token without tax data - use precautionary slippage
      if (hasUnknownToken && !hasTaxData) {
        baseBps = Math.max(baseBps, 500); // 5% for unknown tokens without data
        factors.push("unknown token");
        riskLevel = riskLevel === "low" ? "medium" : riskLevel;
      }
    }

    // ============================================
    // ADDITIONAL FACTORS
    // ============================================

    // Factor: MEV exposure
    const mevExposure = quote.signals?.mevExposure;
    if (mevExposure) {
      if (mevExposure.level === "HIGH") {
        baseBps = Math.max(baseBps, baseBps + 100); // Add 1%
        factors.push("high MEV exposure");
        riskLevel = riskLevel === "high" ? "high" : "medium";
      } else if (mevExposure.level === "MEDIUM") {
        baseBps = Math.max(baseBps, baseBps + 50); // Add 0.5%
        factors.push("moderate MEV risk");
      }
    }

    // Factor: Revert risk
    const revertRisk = quote.signals?.revertRisk;
    if (revertRisk) {
      if (revertRisk.level === "HIGH") {
        baseBps = Math.max(baseBps, baseBps + 100); // Add 1%
        factors.push("high revert risk");
        riskLevel = "high";
      } else if (revertRisk.level === "MEDIUM") {
        baseBps = Math.max(baseBps, baseBps + 50); // Add 0.5%
        if (!factors.includes("moderate revert risk")) factors.push("moderate revert risk");
      }
    }

    // Factor: Provider type (DEX direct vs aggregator)
    if (quote.sourceType === "dex") {
      baseBps = Math.max(baseBps, baseBps + 50); // Add 0.5% for DEX
      factors.push("direct DEX swap");
    }

    // Cap at reasonable maximum
    baseBps = Math.min(baseBps, 4900);

    // Build reason string
    let reason: string;
    if (factors.length > 0) {
      reason = `Auto: ${factors.join(", ")}`;
    } else if (isBuyTokenSafe && isSellTokenSafe) {
      reason = "Auto: safe tokens";
    } else {
      reason = "Auto: standard";
    }

    return {
      slippageBps: baseBps,
      isAuto: true,
      reason,
      riskLevel,
      suggestedMinBps: baseBps,
      detectedTaxes: hasTaxData ? {
        buyTaxPercent,
        sellTaxPercent,
        transferTaxPercent,
      } : undefined,
    };
  }, [quote, userSlippageBps, autoSlippageEnabled, sellTokenAddress, buyTokenAddress]);
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

  // Unknown token - higher default for safety
  return 500; // 5% for unknown tokens (may have transfer fees)
}
