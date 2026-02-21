/**
 * BEQ v2 - Best Executable Quote Scoring System
 * 
 * A transparent, traceable, and robust scoring methodology.
 * 
 * ## Formula
 * 
 * BEQ Score = OutputScore × QualityMultiplier × RiskMultiplier
 * 
 * Where:
 * - OutputScore (0-100): How much NET output this quote provides relative to the best quote
 *   - Net output = buyAmount - fees - gas cost (in token terms)
 * - QualityMultiplier (0-1): Integration reliability + sellability confidence
 * - RiskMultiplier (0-1): Risk-adjusted factor based on revert/MEV/churn signals
 * 
 * ## Transparency Principles
 * 
 * 1. All factors are on human-readable scales (0-100 or 0-1)
 * 2. Every component is exposed in the score breakdown
 * 3. The formula is deterministic and reproducible
 * 4. No hidden fallbacks or arbitrary constants
 */

import type { QuoteMode, RiskSignals, ScoringOptions } from '@swappilot/shared';

// ============================================================================
// TYPES
// ============================================================================

export type BeqV2Input = {
  providerId: string;
  buyAmount: bigint;
  maxBuyAmount: bigint; // The highest buyAmount across all quotes (for normalization)
  /** Optional: max NET buy amount across all quotes (preferred normalization basis). */
  maxNetBuyAmount?: bigint;
  feeBps: number | null;
  integrationConfidence: number; // 0..1
  signals: RiskSignals;
  mode: QuoteMode;
  scoringOptions?: ScoringOptions | undefined;
  /** Estimated gas cost in USD (from adapter/API) */
  estimatedGasUsd?: string | null | undefined;
  /** Buy token price in USD (for converting gas cost to token terms) */
  buyTokenPriceUsd?: number | null | undefined;
  /** Buy token decimals (for gas cost conversion) */
  buyTokenDecimals?: number | undefined;
};

export type BeqV2Components = {
  /** 0-100: Output relative to best quote */
  outputScore: number;
  /** 0-1: Integration reliability factor */
  reliabilityFactor: number;
  /** 0-1: Sellability confidence factor */
  sellabilityFactor: number;
  /** 0-1: Risk-adjusted multiplier (revert + MEV + churn) */
  riskFactor: number;
  /** 0-1: Liquidity risk factor */
  liquidityFactor?: number;
  /** 0-1: Slippage risk factor */
  slippageFactor?: number;
  /** 0-1: Protocol multi-domain risk factor */
  protocolFactor?: number;
  /** 0-1: Preflight success factor */
  preflightFactor: number;
  /** Combined quality multiplier = reliability × sellability */
  qualityMultiplier: number;
  /** Combined risk multiplier = risk × preflight × mlConfidenceFactor */
  riskMultiplier: number;
  /** ML confidence factor: 0-1, default 1.0 (no penalty when ML disabled) */
  mlConfidenceFactor?: number;
  /** Agent trust factor: 0-1, default 1.0 (no penalty when < 100 swaps) */
  agentTrustFactor?: number;
};

export type BeqV2Output = {
  providerId: string;
  /** Final BEQ score (0-100 scale) */
  beqScore: number;
  /** Detailed breakdown of all scoring components */
  components: BeqV2Components;
  /** Whether this quote is disqualified from BEQ ranking */
  disqualified: boolean;
  /** Reason for disqualification, if any */
  disqualifiedReason?: string;
  /** Human-readable explanation of the score */
  explanation: string[];
  /** Raw data used for scoring (for audit trail) */
  rawData: {
    buyAmount: string;
    maxBuyAmount: string;
    feeBps: number | null;
    integrationConfidence: number;
    netBuyAmount: string;
    gasCostInTokens: string | null;
    estimatedGasUsd: string | null;
  };
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert gas cost in USD to equivalent tokens
 * Returns the gas cost as a bigint in token units
 */
function calculateGasCostInTokens(
  estimatedGasUsd: string | null | undefined,
  buyTokenPriceUsd: number | null | undefined,
  buyTokenDecimals: number = 18
): bigint {
  if (!estimatedGasUsd || !buyTokenPriceUsd || buyTokenPriceUsd <= 0) {
    return 0n;
  }

  const gasUsd = parseFloat(estimatedGasUsd);
  if (isNaN(gasUsd) || gasUsd <= 0) {
    return 0n;
  }

  // Convert USD gas cost to token amount
  // gasCostInTokens = gasUsd / tokenPriceUsd
  const gasInTokens = gasUsd / buyTokenPriceUsd;
  
  // Convert to bigint with proper decimals
  const multiplier = 10 ** buyTokenDecimals;
  return BigInt(Math.floor(gasInTokens * multiplier));
}

/**
 * Calculate net output after fees and gas costs
 */
function calculateNetOutput(
  buyAmount: bigint, 
  feeBps: number | null,
  gasCostInTokens: bigint = 0n
): bigint {
  let netAmount = buyAmount;
  
  // Apply fee deduction
  if (feeBps && feeBps > 0) {
    const feeMultiplier = 10_000n - BigInt(Math.min(feeBps, 10_000));
    netAmount = (netAmount * feeMultiplier) / 10_000n;
  }
  
  // Subtract gas cost (but don't go negative)
  if (gasCostInTokens > 0n) {
    netAmount = netAmount > gasCostInTokens ? netAmount - gasCostInTokens : 0n;
  }
  
  return netAmount;
}

/**
 * Compute net buy amount for BEQ v2 using the same logic as scoring.
 * Exported so ranking can normalize output net-vs-net.
 */
export function computeNetBuyAmountV2(input: {
  buyAmount: bigint;
  feeBps: number | null;
  estimatedGasUsd?: string | null | undefined;
  buyTokenPriceUsd?: number | null | undefined;
  buyTokenDecimals?: number | undefined;
}): { netBuyAmount: bigint; gasCostInTokens: bigint } {
  const gasCostInTokens = calculateGasCostInTokens(
    input.estimatedGasUsd,
    input.buyTokenPriceUsd,
    input.buyTokenDecimals ?? 18,
  );
  const netBuyAmount = calculateNetOutput(input.buyAmount, input.feeBps, gasCostInTokens);
  return { netBuyAmount, gasCostInTokens };
}

/**
 * Calculate output score (0-100) relative to the best quote
 */
function calculateOutputScore(netBuyAmount: bigint, maxBuyAmount: bigint): number {
  if (maxBuyAmount <= 0n || netBuyAmount <= 0n) return 0;
  // Use high precision to avoid rounding issues with large numbers
  const ratio = Number((netBuyAmount * 10000n) / maxBuyAmount) / 100;
  return clamp(ratio, 0, 100);
}

function normalizeWeights<T extends Record<string, number>>(weights: T): T {
  const sum = Object.values(weights).reduce((acc, v) => acc + v, 0);
  if (sum <= 0) return weights;
  return Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, value / sum]),
  ) as T;
}

function levelToScore(level: 'LOW' | 'MEDIUM' | 'HIGH'): number {
  switch (level) {
    case 'LOW':
      return 1.0;
    case 'MEDIUM':
      return 0.85;
    case 'HIGH':
      return 0.6;
  }
}

/**
 * Calculate sellability factor based on status and mode
 */
function calculateSellabilityFactor(
  signals: RiskSignals,
  mode: QuoteMode,
  options?: ScoringOptions,
): { factor: number; disqualified: boolean; reason: string } {
  if (options?.sellabilityCheck === false) {
    return { factor: 1, disqualified: false, reason: 'Sellability check disabled' };
  }

  const status = signals.sellability.status;
  const confidence = signals.sellability.confidence;

  if (status === 'OK') {
    // OK status: factor based on confidence (0.8 - 1.0)
    const factor = 0.8 + (confidence * 0.2);
    return { factor, disqualified: false, reason: `Sellability OK (${(confidence * 100).toFixed(0)}% confidence)` };
  }

  if (status === 'UNCERTAIN') {
    // UNCERTAIN: penalize based on mode
    const baseFactor = mode === 'SAFE' ? 0.5 : mode === 'NORMAL' ? 0.7 : 0.85;
    const factor = baseFactor * (0.5 + confidence * 0.5);
    return { factor, disqualified: false, reason: `Sellability uncertain (${(confidence * 100).toFixed(0)}% confidence)` };
  }

  // FAIL status
  if (mode === 'SAFE') {
    return { factor: 0, disqualified: true, reason: 'Sellability FAIL - disqualified in SAFE mode' };
  }

  const factor = mode === 'NORMAL' ? 0.2 : 0.4;
  return { factor, disqualified: false, reason: `Sellability FAIL (penalized to ${(factor * 100).toFixed(0)}%)` };
}

function calculateProtocolFactor(
  signals: RiskSignals,
  options?: ScoringOptions,
): { factor: number; reason: string } {
  const protocolRisk = signals.protocolRisk;
  if (!protocolRisk) {
    return { factor: 1, reason: 'Protocol risk: not available (neutral)' };
  }

  const defaultWeights = normalizeWeights({
    security: 0.3,
    compliance: 0.1,
    financial: 0.15,
    technology: 0.15,
    operations: 0.15,
    governance: 0.15,
  });

  const overrides = options?.protocolRiskWeights ?? {};
  const weights = normalizeWeights({
    security: overrides.security ?? defaultWeights.security,
    compliance: overrides.compliance ?? defaultWeights.compliance,
    financial: overrides.financial ?? defaultWeights.financial,
    technology: overrides.technology ?? defaultWeights.technology,
    operations: overrides.operations ?? defaultWeights.operations,
    governance: overrides.governance ?? defaultWeights.governance,
  });

  const factor =
    levelToScore(protocolRisk.security.level) * weights.security +
    levelToScore(protocolRisk.compliance.level) * weights.compliance +
    levelToScore(protocolRisk.financial.level) * weights.financial +
    levelToScore(protocolRisk.technology.level) * weights.technology +
    levelToScore(protocolRisk.operations.level) * weights.operations +
    levelToScore(protocolRisk.governance.level) * weights.governance;

  const reason = `Protocol risk: sec=${protocolRisk.security.level}, comp=${protocolRisk.compliance.level}, fin=${protocolRisk.financial.level}, tech=${protocolRisk.technology.level}, ops=${protocolRisk.operations.level}, gov=${protocolRisk.governance.level}`;
  return { factor: clamp(factor, 0, 1), reason };
}

/**
 * Calculate risk factor based on revert/MEV/churn signals
 */
function calculateRiskFactor(
  signals: RiskSignals,
  mode: QuoteMode,
  options?: ScoringOptions,
): { factor: number; reason: string; liquidityFactor: number; slippageFactor: number; protocolFactor: number } {
  const revertLevel = signals.revertRisk.level;
  const mevLevel = options?.mevAwareScoring === false ? 'LOW' : signals.mevExposure.level;
  const churnLevel = signals.churn.level;
  const liquidityLevel = signals.liquidity?.level ?? 'LOW';
  const slippageLevel = signals.slippage?.level ?? 'LOW';

  const revertScore = levelToScore(revertLevel);
  const mevScore = levelToScore(mevLevel);
  const churnScore = levelToScore(churnLevel);
  const liquidityScore = levelToScore(liquidityLevel);
  const slippageScore = levelToScore(slippageLevel);

  const protocol = calculateProtocolFactor(signals, options);

  const defaultWeights = mode === 'SAFE'
    ? { revert: 0.35, mev: 0.20, churn: 0.1, liquidity: 0.20, slippage: 0.10, protocol: 0.05 }
    : mode === 'DEGEN'
      ? { revert: 0.25, mev: 0.15, churn: 0.20, liquidity: 0.15, slippage: 0.15, protocol: 0.10 }
      : { revert: 0.25, mev: 0.15, churn: 0.15, liquidity: 0.20, slippage: 0.15, protocol: 0.10 };

  const overrides = options?.riskWeights ?? {};
  const weights = normalizeWeights({
    revert: overrides.revert ?? defaultWeights.revert,
    mev: overrides.mev ?? defaultWeights.mev,
    churn: overrides.churn ?? defaultWeights.churn,
    liquidity: overrides.liquidity ?? defaultWeights.liquidity,
    slippage: overrides.slippage ?? defaultWeights.slippage,
    protocol: overrides.protocol ?? defaultWeights.protocol,
  });

  const factor =
    revertScore * weights.revert +
    mevScore * weights.mev +
    churnScore * weights.churn +
    liquidityScore * weights.liquidity +
    slippageScore * weights.slippage +
    protocol.factor * weights.protocol;

  const risks = [];
  if (revertLevel !== 'LOW') risks.push(`Revert:${revertLevel}`);
  if (mevLevel !== 'LOW') risks.push(`MEV:${mevLevel}`);
  if (churnLevel !== 'LOW') risks.push(`Churn:${churnLevel}`);
  if (liquidityLevel !== 'LOW') risks.push(`Liquidity:${liquidityLevel}`);
  if (slippageLevel !== 'LOW') risks.push(`Slippage:${slippageLevel}`);

  const reason = risks.length === 0
    ? `All risk signals LOW; ${protocol.reason}`
    : `Risk factors: ${risks.join(', ')}; ${protocol.reason}`;

  return {
    factor: clamp(factor, 0, 1),
    reason,
    liquidityFactor: clamp(liquidityScore, 0, 1),
    slippageFactor: clamp(slippageScore, 0, 1),
    protocolFactor: clamp(protocol.factor, 0, 1),
  };
}

/**
 * Calculate preflight factor based on simulation results
 */
function calculatePreflightFactor(
  signals: RiskSignals,
  mode: QuoteMode,
): { factor: number; disqualified: boolean; reason: string } {
  const preflight = signals.preflight;
  
  if (!preflight) {
    if (mode === 'SAFE') {
      return { factor: 0, disqualified: true, reason: 'No preflight data - disqualified in SAFE mode' };
    }
    return { factor: mode === 'DEGEN' ? 0.9 : 0.8, disqualified: false, reason: 'No preflight data' };
  }

  if (!preflight.ok) {
    if (mode === 'SAFE') {
      return { factor: 0, disqualified: true, reason: 'Preflight failed - disqualified in SAFE mode' };
    }
    const factor = mode === 'NORMAL' ? 0.3 : 0.5;
    return { factor, disqualified: false, reason: `Preflight failed (penalized to ${(factor * 100).toFixed(0)}%)` };
  }

  // Preflight OK: factor based on revert probability
  const pRevert = clamp(preflight.pRevert, 0, 1);
  let factor = 1 - (pRevert * 0.8); // pRevert of 1.0 → factor of 0.2
  const reasons: string[] = [];
  
  if (pRevert < 0.1) {
    reasons.push('low revert probability');
  } else {
    reasons.push(`${(pRevert * 100).toFixed(0)}% revert probability`);
  }
  
  // Apply output mismatch penalty if available
  const mismatchRatio = preflight.outputMismatchRatio;
  if (mismatchRatio !== undefined) {
    if (mismatchRatio < 0.90) {
      // Severe mismatch: simulated output is <90% of promised
      // This often indicates hidden taxes or slippage issues
      const mismatchPenalty = mode === 'SAFE' ? 0.4 : mode === 'NORMAL' ? 0.6 : 0.8;
      factor *= mismatchPenalty;
      reasons.push(`output mismatch ${((1 - mismatchRatio) * 100).toFixed(1)}% less than promised`);
      
      // In SAFE mode, severe mismatch (>20%) disqualifies
      if (mode === 'SAFE' && mismatchRatio < 0.80) {
        return { 
          factor: 0, 
          disqualified: true, 
          reason: `Output mismatch too high (${((1 - mismatchRatio) * 100).toFixed(1)}% less) - disqualified in SAFE mode` 
        };
      }
    } else if (mismatchRatio < 0.95) {
      // Moderate mismatch: 5-10% less than promised
      factor *= 0.9;
      reasons.push(`minor output variance ${((1 - mismatchRatio) * 100).toFixed(1)}%`);
    } else if (mismatchRatio >= 0.95 && mismatchRatio <= 1.05) {
      // Good match: within 5%
      reasons.push('simulated output matches quote');
    } else if (mismatchRatio > 1.05) {
      // Higher than expected (rare but possible with positive slippage)
      reasons.push(`simulated output ${((mismatchRatio - 1) * 100).toFixed(1)}% better than quoted`);
    }
  }
  
  const reason = `Preflight OK: ${reasons.join(', ')}`;
  return { factor: clamp(factor, 0.2, 1), disqualified: false, reason };
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Compute the BEQ v2 score for a quote.
 * 
 * The formula is:
 * BEQ = OutputScore × QualityMultiplier × RiskMultiplier
 * 
 * Where:
 * - OutputScore = (netBuyAmount / maxBuyAmount) × 100
 *   - netBuyAmount = buyAmount - fees - gasCost (in token terms)
 * - QualityMultiplier = reliabilityFactor × sellabilityFactor
 * - RiskMultiplier = riskFactor × preflightFactor
 */
export function computeBeqScoreV2(input: BeqV2Input): BeqV2Output {
  const explanation: string[] = [];

  // 1. Calculate net output after fees and gas
  const { netBuyAmount, gasCostInTokens } = computeNetBuyAmountV2({
    buyAmount: input.buyAmount,
    feeBps: input.feeBps,
    estimatedGasUsd: input.estimatedGasUsd,
    buyTokenPriceUsd: input.buyTokenPriceUsd,
    buyTokenDecimals: input.buyTokenDecimals ?? 18,
  });

  // 2. Calculate output score (0-100) relative to best NET quote when available
  const outputDenominator = input.maxNetBuyAmount ?? input.maxBuyAmount;
  const outputScore = calculateOutputScore(netBuyAmount, outputDenominator);
  
  // Build explanation for output
  if (gasCostInTokens > 0n) {
    const gasPercent = input.buyAmount > 0n 
      ? Number((gasCostInTokens * 10000n) / input.buyAmount) / 100 
      : 0;
    explanation.push(`Output: ${outputScore.toFixed(1)}% of best (gas: $${input.estimatedGasUsd}, ${gasPercent.toFixed(2)}% of output)`);
  } else {
    explanation.push(`Output: ${outputScore.toFixed(1)}% of best quote`);
  }

  // 3. Calculate reliability factor
  const reliabilityFactor = clamp(input.integrationConfidence, 0, 1);
  explanation.push(`Reliability: ${(reliabilityFactor * 100).toFixed(0)}%`);

  // 4. Calculate sellability factor
  const sellability = calculateSellabilityFactor(input.signals, input.mode, input.scoringOptions);
  const sellabilityFactor = sellability.factor;
  explanation.push(sellability.reason);

  // 5. Calculate risk factor
  const risk = calculateRiskFactor(input.signals, input.mode, input.scoringOptions);
  const riskFactor = risk.factor;
  explanation.push(risk.reason);

  // 6. Calculate preflight factor
  const preflight = calculatePreflightFactor(input.signals, input.mode);
  const preflightFactor = preflight.factor;
  explanation.push(preflight.reason);

  // Check for disqualification
  const disqualified = sellability.disqualified || preflight.disqualified;
  let disqualifiedReason: string | undefined;
  if (disqualified) {
    if (sellability.disqualified) {
      disqualifiedReason = 'Sellability check failed';
    } else if (preflight.disqualified) {
      disqualifiedReason = 'Preflight simulation failed';
    }
    explanation.push('⚠️ Quote disqualified from BEQ ranking');
  }

  // 7. Calculate combined multipliers
  // mlConfidenceFactor: from signals.ml.confidence if ML enabled, else 1.0 (no penalty)
  const mlSignal = input.signals.ml;
  const mlConfidenceFactor = mlSignal?.enabled && mlSignal.confidence != null
    ? mlSignal.confidence
    : 1.0;

  // agentTrustFactor: 1.0 by default (cold-start guard — no penalty without data)
  const agentTrustFactor = 1.0;

  const qualityMultiplier = reliabilityFactor * sellabilityFactor * agentTrustFactor;
  const riskMultiplier = riskFactor * preflightFactor * mlConfidenceFactor;

  // 8. Calculate final BEQ score (0-100)
  const beqScore = disqualified
    ? 0
    : outputScore * qualityMultiplier * riskMultiplier;

  // Round to 2 decimal places for display
  const finalScore = Math.round(beqScore * 100) / 100;

  const result: BeqV2Output = {
    providerId: input.providerId,
    beqScore: finalScore,
    components: {
      outputScore: Math.round(outputScore * 100) / 100,
      reliabilityFactor: Math.round(reliabilityFactor * 1000) / 1000,
      sellabilityFactor: Math.round(sellabilityFactor * 1000) / 1000,
      riskFactor: Math.round(riskFactor * 1000) / 1000,
      liquidityFactor: Math.round(risk.liquidityFactor * 1000) / 1000,
      slippageFactor: Math.round(risk.slippageFactor * 1000) / 1000,
      protocolFactor: Math.round(risk.protocolFactor * 1000) / 1000,
      preflightFactor: Math.round(preflightFactor * 1000) / 1000,
      qualityMultiplier: Math.round(qualityMultiplier * 1000) / 1000,
      riskMultiplier: Math.round(riskMultiplier * 1000) / 1000,
      mlConfidenceFactor: Math.round(mlConfidenceFactor * 1000) / 1000,
      agentTrustFactor: Math.round(agentTrustFactor * 1000) / 1000,
    },
    disqualified,
    explanation,
    rawData: {
      buyAmount: input.buyAmount.toString(),
      maxBuyAmount: input.maxBuyAmount.toString(),
      ...(input.maxNetBuyAmount !== undefined ? { maxNetBuyAmount: input.maxNetBuyAmount.toString() } : {}),
      feeBps: input.feeBps,
      integrationConfidence: input.integrationConfidence,
      netBuyAmount: netBuyAmount.toString(),
      gasCostInTokens: gasCostInTokens > 0n ? gasCostInTokens.toString() : null,
      estimatedGasUsd: input.estimatedGasUsd ?? null,
    },
  };

  if (disqualifiedReason !== undefined) {
    result.disqualifiedReason = disqualifiedReason;
  }

  return result;
}

/**
 * Format BEQ score for display with explanation
 */
export function formatBeqScore(output: BeqV2Output): string {
  if (output.disqualified) {
    return `Disqualified`;
  }
  return `${output.beqScore.toFixed(1)}/100`;
}

/**
 * Get a short summary of why this quote scored as it did
 */
export function getScoreSummary(output: BeqV2Output): string {
  const { components } = output;
  const parts: string[] = [];

  if (components.outputScore < 95) {
    parts.push(`${(100 - components.outputScore).toFixed(0)}% less output`);
  }
  if (components.qualityMultiplier < 0.8) {
    parts.push(`quality penalty`);
  }
  if (components.riskMultiplier < 0.8) {
    parts.push(`risk penalty`);
  }

  if (parts.length === 0) {
    return 'Top performer';
  }
  return parts.join(', ');
}
