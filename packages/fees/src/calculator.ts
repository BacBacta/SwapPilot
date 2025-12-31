/**
 * SwapPilot Fee Calculator
 * 
 * Calculates platform fees based on:
 * - Swap value in USD
 * - User's PILOT token holdings
 * - Referral status
 */

import { FEE_CONFIG } from './config.js';

export type FeeCalculationInput = {
  /** Swap value in USD (e.g., 150.50) */
  swapValueUsd: number;
  /** User's PILOT token balance in wei (18 decimals) */
  pilotBalance: bigint;
  /** Whether user was referred (for referral tracking) */
  hasReferrer?: boolean;
  /** Referrer address if applicable */
  referrerAddress?: string;
};

export type FeeCalculationResult = {
  /** Whether fees apply to this swap */
  feeApplies: boolean;
  /** Base fee in basis points before discount */
  baseFeesBps: number;
  /** Discount percentage from PILOT holdings (0-20) */
  discountPercent: number;
  /** Final fee in basis points after discount */
  finalFeeBps: number;
  /** Fee amount in USD */
  feeAmountUsd: number;
  /** User's PILOT tier name */
  pilotTier: 'none' | 'bronze' | 'silver' | 'gold';
  /** Breakdown of fee distribution */
  distribution: {
    burnUsd: number;
    treasuryUsd: number;
    referralUsd: number;
  };
};

/**
 * Get the PILOT tier based on token holdings
 */
export function getPilotTier(pilotBalance: bigint): {
  tier: 'none' | 'bronze' | 'silver' | 'gold';
  discountPercent: number;
} {
  for (const tierConfig of FEE_CONFIG.PILOT_TIERS) {
    if (pilotBalance >= tierConfig.minHolding) {
      // Determine tier name based on discount
      const tier = tierConfig.discountPercent >= 20 ? 'gold' :
                   tierConfig.discountPercent >= 15 ? 'silver' : 'bronze';
      return { tier, discountPercent: tierConfig.discountPercent };
    }
  }
  return { tier: 'none', discountPercent: 0 };
}

/**
 * Calculate fees for a swap
 */
export function calculateFees(input: FeeCalculationInput): FeeCalculationResult {
  const { swapValueUsd, pilotBalance } = input;

  // Check if swap is below free tier threshold
  if (swapValueUsd < FEE_CONFIG.FREE_TIER_THRESHOLD_USD) {
    return {
      feeApplies: false,
      baseFeesBps: 0,
      discountPercent: 0,
      finalFeeBps: 0,
      feeAmountUsd: 0,
      pilotTier: getPilotTier(pilotBalance).tier,
      distribution: {
        burnUsd: 0,
        treasuryUsd: 0,
        referralUsd: 0,
      },
    };
  }

  // Get PILOT tier and discount
  const { tier, discountPercent } = getPilotTier(pilotBalance);

  // Calculate fee with discount
  const baseFeesBps = FEE_CONFIG.BASE_FEE_BPS;
  const discountMultiplier = (100 - discountPercent) / 100;
  const finalFeeBps = Math.round(baseFeesBps * discountMultiplier);
  
  // Calculate fee amount in USD
  const feeAmountUsd = (swapValueUsd * finalFeeBps) / 10_000;

  // Calculate distribution
  const burnUsd = (feeAmountUsd * FEE_CONFIG.DISTRIBUTION.BURN) / 100;
  const treasuryUsd = (feeAmountUsd * FEE_CONFIG.DISTRIBUTION.TREASURY) / 100;
  const referralUsd = (feeAmountUsd * FEE_CONFIG.DISTRIBUTION.REFERRAL) / 100;

  return {
    feeApplies: true,
    baseFeesBps,
    discountPercent,
    finalFeeBps,
    feeAmountUsd,
    pilotTier: tier,
    distribution: {
      burnUsd,
      treasuryUsd,
      referralUsd,
    },
  };
}

/**
 * Calculate the fee amount to deduct from output tokens
 * @param outputAmount - The output amount in token wei
 * @param feeBps - Fee in basis points
 * @returns Object with fee amount and net amount user receives
 */
export function calculateOutputFee(
  outputAmount: bigint,
  feeBps: number,
): { feeAmount: bigint; netAmount: bigint } {
  if (feeBps <= 0) {
    return { feeAmount: 0n, netAmount: outputAmount };
  }

  const feeAmount = (outputAmount * BigInt(feeBps)) / 10_000n;
  const netAmount = outputAmount - feeAmount;

  return { feeAmount, netAmount };
}

/**
 * Format fee for display
 */
export function formatFeeDisplay(feeBps: number): string {
  if (feeBps === 0) return 'Free';
  const percent = feeBps / 100;
  return `${percent.toFixed(2)}%`;
}

/**
 * Format PILOT balance for display
 */
export function formatPilotBalance(balance: bigint): string {
  const whole = balance / (10n ** 18n);
  if (whole >= 10_000n) {
    return `${(Number(whole) / 1000).toFixed(1)}K`;
  }
  return whole.toLocaleString();
}
