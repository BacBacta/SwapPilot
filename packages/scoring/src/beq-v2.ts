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
 * - OutputScore (0-100): How much output this quote provides relative to the best quote
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
  feeBps: number | null;
  integrationConfidence: number; // 0..1
  signals: RiskSignals;
  mode: QuoteMode;
  scoringOptions?: ScoringOptions | undefined;
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
  /** 0-1: Preflight success factor */
  preflightFactor: number;
  /** Combined quality multiplier = reliability × sellability */
  qualityMultiplier: number;
  /** Combined risk multiplier = risk × preflight */
  riskMultiplier: number;
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
  };
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate net output after fees
 */
function calculateNetOutput(buyAmount: bigint, feeBps: number | null): bigint {
  if (!feeBps || feeBps <= 0) return buyAmount;
  const feeMultiplier = 10_000n - BigInt(Math.min(feeBps, 10_000));
  return (buyAmount * feeMultiplier) / 10_000n;
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

/**
 * Calculate risk factor based on revert/MEV/churn signals
 */
function calculateRiskFactor(
  signals: RiskSignals,
  mode: QuoteMode,
  options?: ScoringOptions,
): { factor: number; reason: string } {
  const revertLevel = signals.revertRisk.level;
  const mevLevel = options?.mevAwareScoring === false ? 'LOW' : signals.mevExposure.level;
  const churnLevel = signals.churn.level;

  // Convert levels to numeric penalties
  const levelToScore = (level: 'LOW' | 'MEDIUM' | 'HIGH'): number => {
    switch (level) {
      case 'LOW': return 1.0;
      case 'MEDIUM': return 0.85;
      case 'HIGH': return 0.6;
    }
  };

  const revertScore = levelToScore(revertLevel);
  const mevScore = levelToScore(mevLevel);
  const churnScore = levelToScore(churnLevel);

  // Weighted average: revert is most important, then MEV, then churn
  const weights = mode === 'SAFE' 
    ? { revert: 0.5, mev: 0.35, churn: 0.15 }
    : mode === 'DEGEN'
      ? { revert: 0.4, mev: 0.3, churn: 0.3 }
      : { revert: 0.45, mev: 0.35, churn: 0.2 };

  const factor = (revertScore * weights.revert) + (mevScore * weights.mev) + (churnScore * weights.churn);
  
  const risks = [];
  if (revertLevel !== 'LOW') risks.push(`Revert:${revertLevel}`);
  if (mevLevel !== 'LOW') risks.push(`MEV:${mevLevel}`);
  if (churnLevel !== 'LOW') risks.push(`Churn:${churnLevel}`);
  
  const reason = risks.length === 0 
    ? 'All risk signals LOW' 
    : `Risk factors: ${risks.join(', ')}`;

  return { factor: clamp(factor, 0, 1), reason };
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
    return { factor: 0.8, disqualified: false, reason: 'No preflight data (default 80%)' };
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
  const factor = 1 - (pRevert * 0.8); // pRevert of 1.0 → factor of 0.2
  const reason = pRevert < 0.1 
    ? 'Preflight OK, low revert probability'
    : `Preflight OK, ${(pRevert * 100).toFixed(0)}% revert probability`;
  
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
 * - QualityMultiplier = reliabilityFactor × sellabilityFactor
 * - RiskMultiplier = riskFactor × preflightFactor
 */
export function computeBeqScoreV2(input: BeqV2Input): BeqV2Output {
  const explanation: string[] = [];

  // 1. Calculate net output after fees
  const netBuyAmount = calculateNetOutput(input.buyAmount, input.feeBps);
  
  // 2. Calculate output score (0-100)
  const outputScore = calculateOutputScore(netBuyAmount, input.maxBuyAmount);
  explanation.push(`Output: ${outputScore.toFixed(1)}% of best quote`);

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
  const qualityMultiplier = reliabilityFactor * sellabilityFactor;
  const riskMultiplier = riskFactor * preflightFactor;

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
      preflightFactor: Math.round(preflightFactor * 1000) / 1000,
      qualityMultiplier: Math.round(qualityMultiplier * 1000) / 1000,
      riskMultiplier: Math.round(riskMultiplier * 1000) / 1000,
    },
    disqualified,
    explanation,
    rawData: {
      buyAmount: input.buyAmount.toString(),
      maxBuyAmount: input.maxBuyAmount.toString(),
      feeBps: input.feeBps,
      integrationConfidence: input.integrationConfidence,
      netBuyAmount: netBuyAmount.toString(),
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
