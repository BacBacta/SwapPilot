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
 * - 5% -> Referral pool
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
  TREASURY: '0xa5ad3569b95f56a2777206934f2af8a4b4c5d8be' as const,
  
  /** PILOT token contract address */
  PILOT_TOKEN: '0x0000000000000000000000000000000000000000' as const, // TODO: Deploy and set
  
  /** Burn address for PILOT tokens */
  BURN_ADDRESS: '0x000000000000000000000000000000000000dEaD' as const,
  
  /** Referral pool contract/wallet */
  REFERRAL_POOL: '0xa5ad3569b95f56a2777206934f2af8a4b4c5d8be' as const,
} as const;

export type FeeConfig = typeof FEE_CONFIG;
export type FeeAddresses = typeof FEE_ADDRESSES;
