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

export const QuoteRequestSchema = z.object({
  chainId: z.number().int().positive(),
  sellToken: AddressSchema,
  buyToken: AddressSchema,
  sellAmount: BigIntStringSchema,
  slippageBps: z.number().int().min(0).max(5000),
  account: AddressSchema.optional(),
  providers: z.array(z.string().min(1)).optional(),
  mode: QuoteModeSchema.optional(),
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
  reasons: z.array(z.string()),
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
  preflight: PreflightResultSchema.optional(),
});

export type RiskSignals = z.infer<typeof RiskSignalsSchema>;

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
