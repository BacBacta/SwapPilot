/**
 * SwapPilot Fee Configuration
 * 
 * Fee Structure:
 * - Base fee: 0.1% (10 bps) for swaps >= $50
 * - Free tier: $0 for swaps < $50
 * 
 * PILOT Token Discounts:
 * - >= 100 PILOT: 10% discount
 * - >= 1,000 PILOT: 15% discount  
 * - >= 10,000 PILOT: 20% discount
 * 
 * Fee Distribution:
 * - 15% -> PILOT burn (deflationary)
 * - 80% -> Treasury (operations)
 * - 5% -> Referral rewards (PILOT incentives, managed by ReferralRewards)
 */

/** Fee configuration constants */
export const FEE_CONFIG = {
  /** Base fee in basis points (0.1% = 10 bps) */
  BASE_FEE_BPS: 10,
  
  /** Minimum swap value in USD to charge fees */
  FREE_TIER_THRESHOLD_USD: 50,
  
  /** Fee distribution percentages (must sum to 100) */
  DISTRIBUTION: {
    BURN: 15,      // 15% -> Buy and burn PILOT
    TREASURY: 80,  // 80% -> Treasury wallet
    REFERRAL: 5,   // 5% -> Referral rewards
  },
  
  /** PILOT token holding thresholds for discounts */
  PILOT_TIERS: [
    { minHolding: 10_000n * 10n ** 18n, discountPercent: 20 }, // 10,000 PILOT = 20% off
    { minHolding: 1_000n * 10n ** 18n, discountPercent: 15 },  // 1,000 PILOT = 15% off
    { minHolding: 100n * 10n ** 18n, discountPercent: 10 },    // 100 PILOT = 10% off
  ],
} as const;

/** Treasury and token addresses (BSC Mainnet) */
export const FEE_ADDRESSES = {
  /** Treasury wallet - receives 80% of fees */
  TREASURY: '0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8' as const,
  
  /** PILOT token contract address */
  PILOT_TOKEN: '0xe3f77E20226fdc7BA85E495158615dEF83b48192' as const,
  
  /** Burn address for PILOT tokens */
  BURN_ADDRESS: '0x000000000000000000000000000000000000dEaD' as const,
  
  /** FeeCollector referral pool (receives 5% of BNB fees) */
  REFERRAL_POOL: '0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8' as const,

  /** Referral rewards (PILOT) are managed by ReferralRewards */
  REFERRAL_REWARDS: '0x3b39d37F4bB831AD7783D982a46cAb85AA887d3E' as const,
  
  /** FeeCollector contract address (V1 - deprecated after V2 deployment) */
  FEE_COLLECTOR: '0xEe841Def61326C116F92e71FceF8cb11FBC05034' as const,
  
  // ========== V2 CONTRACTS (Update after deployment) ==========
  
  /** FeeCollectorV2 (DappBay compliant with Pausable, events, slippage protection) */
  FEE_COLLECTOR_V2: (process.env.FEE_COLLECTOR_V2 || '0x2083B8b745Ff78c6a00395b1800469c0Dddc966c') as `0x${string}`,
  
  /** TimelockController (24h delay for all admin operations) */
  TIMELOCK_CONTROLLER: (process.env.TIMELOCK_CONTROLLER || '0xF98a25C78Ba1B8d7bC2D816993faD7E7f825B75b') as `0x${string}`,
} as const;

export type FeeConfig = typeof FEE_CONFIG;
export type FeeAddresses = typeof FEE_ADDRESSES;
