import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address');

export const BigIntStringSchema = z
  .string()
  .regex(/^[0-9]+$/, 'Expected an integer string');

export const ProviderCapabilitiesSchema = z.object({
  quote: z.boolean(),
  buildTx: z.boolean(),
  deepLink: z.boolean(),
});

export type ProviderCapabilities = z.infer<typeof ProviderCapabilitiesSchema>;

export const QuoteModeSchema = z.enum(['SAFE', 'NORMAL', 'DEGEN']);
export type QuoteMode = z.infer<typeof QuoteModeSchema>;

export const ScoringOptionsSchema = z.object({
  sellabilityCheck: z.boolean().optional(),
  mevAwareScoring: z.boolean().optional(),
  canonicalPoolsOnly: z.boolean().optional(),
  riskWeights: z
    .object({
      revert: z.number().min(0).max(1).optional(),
      mev: z.number().min(0).max(1).optional(),
      churn: z.number().min(0).max(1).optional(),
      liquidity: z.number().min(0).max(1).optional(),
      slippage: z.number().min(0).max(1).optional(),
      protocol: z.number().min(0).max(1).optional(),
    })
    .optional(),
  protocolRiskWeights: z
    .object({
      security: z.number().min(0).max(1).optional(),
      compliance: z.number().min(0).max(1).optional(),
      financial: z.number().min(0).max(1).optional(),
      technology: z.number().min(0).max(1).optional(),
      operations: z.number().min(0).max(1).optional(),
      governance: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

export type ScoringOptions = z.infer<typeof ScoringOptionsSchema>;

// Base QuoteRequest schema for POST body (strict number types)
export const QuoteRequestSchema = z.object({
  chainId: z.number().int().positive(),
  sellToken: AddressSchema,
  buyToken: AddressSchema,
  sellAmount: BigIntStringSchema,
  slippageBps: z.number().int().min(0).max(5000),
  account: AddressSchema.optional(),
  providers: z.array(z.string().min(1)).optional(),
  mode: QuoteModeSchema.optional(),
  scoringOptions: ScoringOptionsSchema.optional(),
  // Token decimals for accurate quote calculation
  sellTokenDecimals: z.number().int().min(0).max(18).optional(),
  buyTokenDecimals: z.number().int().min(0).max(18).optional(),
  // Token price in USD for gas-adjusted BEQ scoring
  buyTokenPriceUsd: z.number().positive().optional(),
});

// Query string version - coerces string to number (HTTP query params are always strings)
export const QuoteRequestQuerySchema = z.object({
  chainId: z.coerce.number().int().positive(),
  sellToken: AddressSchema,
  buyToken: AddressSchema,
  sellAmount: BigIntStringSchema,
  slippageBps: z.coerce.number().int().min(0).max(5000),
  account: AddressSchema.optional(),
  providers: z.array(z.string().min(1)).optional(),
  mode: QuoteModeSchema.optional(),
  // Token decimals for accurate quote calculation
  sellTokenDecimals: z.coerce.number().int().min(0).max(18).optional(),
  buyTokenDecimals: z.coerce.number().int().min(0).max(18).optional(),
  // Token price in USD for gas-adjusted BEQ scoring
  buyTokenPriceUsd: z.coerce.number().positive().optional(),
});

export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

export const ProviderQuoteRawSchema = z.object({
  sellAmount: BigIntStringSchema,
  buyAmount: BigIntStringSchema,
  estimatedGas: z.number().int().nonnegative().nullable(),
  feeBps: z.number().int().min(0).max(10000).nullable(),
  route: z.array(AddressSchema).optional(),
});

export type ProviderQuoteRaw = z.infer<typeof ProviderQuoteRawSchema>;

export const ProviderQuoteNormalizedSchema = z.object({
  buyAmount: BigIntStringSchema,
  effectivePrice: z.string(),
  estimatedGasUsd: z.string().nullable(),
  feesUsd: z.string().nullable(),
});

export type ProviderQuoteNormalized = z.infer<typeof ProviderQuoteNormalizedSchema>;

export const PreflightResultSchema = z.object({
  ok: z.boolean(),
  // Estimated probability of revert based on quorum of RPC simulations.
  pRevert: z.number().min(0).max(1),
  // Confidence in the estimate based on consistency across RPCs.
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  // Simulated output amount (when available from eth_call decode)
  simulatedOutput: z.string().optional(),
  // Mismatch ratio between promised and simulated output (1.0 = match, <1 = less than promised)
  outputMismatchRatio: z.number().optional(),
});

export type PreflightResult = z.infer<typeof PreflightResultSchema>;

export const SellabilitySchema = z.object({
  status: z.enum(['OK', 'UNCERTAIN', 'FAIL']),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
});

export const RiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const RiskSignalsSchema = z.object({
  sellability: SellabilitySchema,
  revertRisk: z.object({ level: RiskLevelSchema, reasons: z.array(z.string()) }),
  mevExposure: z.object({ level: RiskLevelSchema, reasons: z.array(z.string()) }),
  churn: z.object({ level: RiskLevelSchema, reasons: z.array(z.string()) }),
  liquidity: z.object({ level: RiskLevelSchema, reasons: z.array(z.string()) }).optional(),
  slippage: z.object({ level: RiskLevelSchema, reasons: z.array(z.string()) }).optional(),
  protocolRisk: z
    .object({
      security: z.object({ level: RiskLevelSchema, reasons: z.array(z.string()) }),
      compliance: z.object({ level: RiskLevelSchema, reasons: z.array(z.string()) }),
      financial: z.object({ level: RiskLevelSchema, reasons: z.array(z.string()) }),
      technology: z.object({ level: RiskLevelSchema, reasons: z.array(z.string()) }),
      operations: z.object({ level: RiskLevelSchema, reasons: z.array(z.string()) }),
      governance: z.object({ level: RiskLevelSchema, reasons: z.array(z.string()) }),
    })
    .optional(),
  preflight: PreflightResultSchema.optional(),
});

export type RiskSignals = z.infer<typeof RiskSignalsSchema>;

// BEQ v2 Score Components - transparent and traceable scoring breakdown
export const BeqV2ComponentsSchema = z.object({
  /** Output score: 0-100, relative to best quote */
  outputScore: z.number().min(0).max(100),
  /** Reliability factor: 0-1, based on integration confidence */
  reliabilityFactor: z.number().min(0).max(1),
  /** Sellability factor: 0-1, based on token sellability assessment */
  sellabilityFactor: z.number().min(0).max(1),
  /** Risk factor: 0-1, aggregated from revert/MEV/churn risk */
  riskFactor: z.number().min(0).max(1),
  /** Liquidity factor: 0-1, based on depth and liquidity risk */
  liquidityFactor: z.number().min(0).max(1).optional(),
  /** Slippage factor: 0-1, based on estimated slippage risk */
  slippageFactor: z.number().min(0).max(1).optional(),
  /** Protocol risk factor: 0-1, multi-domain protocol risk */
  protocolFactor: z.number().min(0).max(1).optional(),
  /** Preflight factor: 0-1, based on simulation result */
  preflightFactor: z.number().min(0).max(1),
  /** Combined quality multiplier = reliability × sellability */
  qualityMultiplier: z.number().min(0).max(1),
  /** Combined risk multiplier = risk × preflight */
  riskMultiplier: z.number().min(0).max(1),
});

export type BeqV2Components = z.infer<typeof BeqV2ComponentsSchema>;

export const BeqV2DetailsSchema = z.object({
  /** Final BEQ score: 0-100 */
  beqScore: z.number(),
  /** Whether this quote was disqualified */
  disqualified: z.boolean(),
  /** Reason for disqualification, if any */
  disqualifiedReason: z.string().optional(),
  /** Score component breakdown */
  components: BeqV2ComponentsSchema,
  /** Human-readable explanation of the score */
  explanation: z.array(z.string()),
  /** Raw data for audit trail */
  rawData: z.object({
    buyAmount: z.string(),
    maxBuyAmount: z.string(),
    /** Optional: max NET buy amount used for output normalization */
    maxNetBuyAmount: z.string().optional(),
    feeBps: z.number().nullable(),
    integrationConfidence: z.number(),
    netBuyAmount: z.string(),
    /** Optional: gas cost converted to buy token units */
    gasCostInTokens: z.string().nullable().optional(),
    /** Optional: estimated gas cost in USD (as provided by adapter/API) */
    estimatedGasUsd: z.string().nullable().optional(),
  }),
});

export type BeqV2Details = z.infer<typeof BeqV2DetailsSchema>;

export const RankedQuoteSchema = z.object({
  providerId: z.string().min(1),
  sourceType: z.enum(['aggregator', 'dex']),
  capabilities: ProviderCapabilitiesSchema,
  raw: ProviderQuoteRawSchema,
  normalized: ProviderQuoteNormalizedSchema,
  signals: RiskSignalsSchema,
  score: z.object({
    beqScore: z.number(),
    rawOutputRank: z.number().int().nonnegative(),
    /** BEQ v2 detailed breakdown (optional for backward compatibility) */
    v2Details: BeqV2DetailsSchema.optional(),
  }),
  deepLink: z.string().url().nullable(),
});

export type RankedQuote = z.infer<typeof RankedQuoteSchema>;

export const NormalizationAssumptionsSchema = z.object({
  priceModel: z.literal('ratio_sell_buy'),
  effectivePriceScale: z.number().int().positive(),
  gasUsdPerTx: z.string().nullable(),
  feeModel: z.literal('feeBps_on_buyAmount'),
});

export type NormalizationAssumptions = z.infer<typeof NormalizationAssumptionsSchema>;

export const QuoteResponseSchema = z.object({
  receiptId: z.string().min(1),
  bestExecutableQuoteProviderId: z.string().nullable(),
  bestRawOutputProviderId: z.string().nullable(),
  beqRecommendedProviderId: z.string().nullable(),
  rankedQuotes: z.array(RankedQuoteSchema),
  bestRawQuotes: z.array(RankedQuoteSchema),
  // Optional: embed the full receipt to avoid a follow-up fetch.
  // This is particularly useful when the backend receipt store is ephemeral.
  receipt: z.lazy(() => DecisionReceiptSchema).optional(),
});

export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;

export const DecisionReceiptSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  request: QuoteRequestSchema,
  bestExecutableQuoteProviderId: z.string().nullable(),
  bestRawOutputProviderId: z.string().nullable(),
  beqRecommendedProviderId: z.string().nullable(),
  rankedQuotes: z.array(RankedQuoteSchema),
  bestRawQuotes: z.array(RankedQuoteSchema),
  normalization: z.object({
    assumptions: NormalizationAssumptionsSchema,
  }),
  whyWinner: z.array(z.string()),
  ranking: z.object({
    mode: QuoteModeSchema.default('NORMAL'),
    rationale: z.array(z.string()),
  }),
  warnings: z.array(z.string()),
});

export type DecisionReceipt = z.infer<typeof DecisionReceiptSchema>;
