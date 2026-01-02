import {
  QuoteRequestSchema,
  type QuoteRequest,
  type RankedQuote,
  type DecisionReceipt,
  type PreflightResult,
  deterministicHash,
  sha256Hex,
} from '@swappilot/shared';

import { getEnabledProviders } from '@swappilot/adapters';
import type { Adapter } from '@swappilot/adapters';
import { deepLinkBuilder } from '@swappilot/deeplinks';

import { defaultAssumptions, normalizeQuote, defaultPlaceholderSignals, rankQuotes } from '@swappilot/scoring';

import type { PreflightClient, TxRequest } from '@swappilot/preflight';
import type { RiskEngine } from '@swappilot/risk';

import type { Metrics } from './obs/metrics';
import type { QuoteCache } from './cache/quoteCache';
import { ProviderHealthTracker } from './obs/providerHealth';
import { getProviderConcurrencyLimiter, type ProviderConcurrencyLimiter } from './obs/providerConcurrency';
import { assessOnchainSellability } from './risk/onchainSellability';
import { assessTokenSecuritySellability } from './risk/tokenSecurity';

type Logger = {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  debug(obj: unknown, msg?: string): void;
};

const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function buildQuotes(
  request: QuoteRequest,
  deps: {
    preflightClient: PreflightClient;
    riskEngine: RiskEngine;
    adapters?: Map<string, Adapter>;
    quoteCache?: QuoteCache;
    quoteCacheTtlSeconds?: number;
    logger?: Logger;
    metrics?: Metrics;
    providerHealth?: ProviderHealthTracker;
    rpc?: { bscUrls: string[]; timeoutMs: number };
    sellability?: {
      multicall3Address: string;
      baseTokensBsc: string[];
      pancake: { v2Factory: string; v3Factory: string; wbnb: string };
    };
    tokenSecurity?: {
      enabled: boolean;
      goPlusEnabled: boolean;
      goPlusBaseUrl: string;
      honeypotIsEnabled: boolean;
      honeypotIsBaseUrl: string;
      timeoutMs: number;
      cacheTtlMs: number;
      taxStrictMaxPercent: number;
    };
  },
): Promise<{
  receiptId: string;
  rankedQuotes: RankedQuote[];
  bestRawQuotes: RankedQuote[];
  bestExecutableQuoteProviderId: string | null;
  bestRawOutputProviderId: string | null;
  beqRecommendedProviderId: string | null;
  receipt: DecisionReceipt;
}> {
  return buildQuotesImpl(request, deps);
}

async function buildQuotesImpl(
  request: QuoteRequest,
  deps: {
    preflightClient: PreflightClient;
    riskEngine: RiskEngine;
    adapters?: Map<string, Adapter>;
    quoteCache?: QuoteCache;
    quoteCacheTtlSeconds?: number;
    logger?: Logger;
    metrics?: Metrics;
    providerHealth?: ProviderHealthTracker;
    rpc?: { bscUrls: string[]; timeoutMs: number };
    sellability?: {
      multicall3Address: string;
      baseTokensBsc: string[];
      pancake: { v2Factory: string; v3Factory: string; wbnb: string };
    };
    tokenSecurity?: {
      enabled: boolean;
      goPlusEnabled: boolean;
      goPlusBaseUrl: string;
      honeypotIsEnabled: boolean;
      honeypotIsBaseUrl: string;
      timeoutMs: number;
      cacheTtlMs: number;
      taxStrictMaxPercent: number;
    };
  },
): Promise<{
  receiptId: string;
  rankedQuotes: RankedQuote[];
  bestRawQuotes: RankedQuote[];
  bestExecutableQuoteProviderId: string | null;
  bestRawOutputProviderId: string | null;
  beqRecommendedProviderId: string | null;
  receipt: DecisionReceipt;
}> {
  const parsed = QuoteRequestSchema.parse(request);
  const hash = deterministicHash(parsed);
  const receiptId = `rcpt_${hash.slice(0, 24)}`;

  const log = deps.logger ?? noopLogger;
  const metrics = deps.metrics;
  const providerHealth = deps.providerHealth;
  const rpc = deps.rpc;
  const sellability = deps.sellability;
  const tokenSecurity = deps.tokenSecurity;
  const quoteCache = deps.quoteCache;
  const quoteCacheTtlSeconds = deps.quoteCacheTtlSeconds ?? 10;

  const adapters = deps.adapters ?? new Map<string, Adapter>();

  // Get enabled providers, replacing registry meta with adapter meta when available
  const enabledProviders = getEnabledProviders({ providers: parsed.providers }).map((p) => {
    const adapter = adapters.get(p.providerId);
    if (adapter) {
      return adapter.getProviderMeta();
    }
    return p;
  });

  // Dynamic integration confidence: base * runtime health factor.
  const providerMeta = new Map(
    enabledProviders.map((p) => {
      const base = p.integrationConfidence;
      const integrationConfidence = providerHealth
        ? providerHealth.getIntegrationConfidence({ providerId: p.providerId, base })
        : base;
      return [p.providerId, { ...p, integrationConfidence }] as const;
    }),
  );

  const assumptions = defaultAssumptions();

  const parts = enabledProviders.map((provider) => {
    const providerHash = sha256Hex(`${hash}:${provider.providerId}`);
    const base = BigInt('0x' + providerHash.slice(0, 12));

    const deepLink = deepLinkBuilder(provider.providerId, parsed);

    const cacheKeyBase = deterministicHash({
      chainId: parsed.chainId,
      sellToken: parsed.sellToken,
      buyToken: parsed.buyToken,
      sellAmount: parsed.sellAmount,
      slippageBps: parsed.slippageBps,
      mode: parsed.mode ?? 'NORMAL',
    });
    const cacheKey = `swappilot:quote:${provider.providerId}:${cacheKeyBase}`;

    // Get adapter for this provider if available
    const providerAdapter = adapters.get(provider.providerId);

    const adapterQuotePromise = providerAdapter
        ? (async () => {
            const providerId = provider.providerId;
            const start = process.hrtime.bigint();
            const concurrencyLimiter = getProviderConcurrencyLimiter();
            const providerCategory = provider.category === 'dex' ? 'dex' : provider.category === 'wallet' ? 'wallet' : 'aggregator';

            try {
              if (quoteCache) {
                const cached = await quoteCache.get(cacheKey);
                if (cached) {
                  metrics?.providerQuoteRequestsTotal.labels({ providerId, status: 'cache_hit' }).inc();
                  const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
                  metrics?.providerQuoteDurationMs.labels({ providerId, status: 'cache_hit' }).observe(durationMs);
                  providerHealth?.record({ providerId, status: 'cache_hit', durationMs });
                  log.info({ providerId, cache: 'hit', durationMs }, 'provider.quote');
                  return {
                    providerId,
                    sourceType: 'dex',
                    capabilities: cached.capabilities,
                    raw: cached.raw,
                    normalized: cached.normalized,
                    signals: defaultPlaceholderSignals({
                      mode: parsed.mode ?? 'NORMAL',
                      quoteIsAvailable: cached.capabilities.quote,
                      isDeepLinkOnly: cached.capabilities.quote === false,
                      reason: 'cache_hit',
                    }),
                    deepLink: null,
                    warnings: [...cached.warnings, 'cache_hit'],
                    isStub: cached.isStub,
                  };
                }
              }

              metrics?.providerQuoteRequestsTotal.labels({ providerId, status: 'cache_miss' }).inc();
              providerHealth?.record({ providerId, status: 'cache_miss', durationMs: null });

              // Use concurrency limiter with built-in retry logic
              const quote = await concurrencyLimiter.execute(
                providerId,
                providerCategory,
                async () => {
                  log.info({ providerId }, 'provider.quote.start');
                  return providerAdapter.getQuote(parsed);
                },
              );

              const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
              const status = quote.isStub || quote.capabilities.quote === false ? 'stub' : 'success';
              metrics?.providerQuoteRequestsTotal.labels({ providerId, status }).inc();
              metrics?.providerQuoteDurationMs.labels({ providerId, status }).observe(durationMs);
              providerHealth?.record({ providerId, status, durationMs });
              log.info(
                {
                  providerId,
                  status,
                  durationMs,
                  buyAmount: quote.raw.buyAmount,
                  quoteEnabled: quote.capabilities.quote,
                  warnings: quote.warnings?.length ? quote.warnings : undefined,
                },
                'provider.quote.end',
              );

              if (quoteCache && status === 'success') {
                await quoteCache.set(
                  cacheKey,
                  {
                    providerId,
                    cachedAt: new Date().toISOString(),
                    raw: quote.raw,
                    normalized: quote.normalized,
                    capabilities: quote.capabilities,
                    isStub: quote.isStub,
                    warnings: quote.warnings,
                  },
                  quoteCacheTtlSeconds,
                );
              }

              return quote;
            } catch (err) {
              const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
              metrics?.providerQuoteRequestsTotal.labels({ providerId, status: 'failure' }).inc();
              metrics?.providerQuoteDurationMs.labels({ providerId, status: 'failure' }).observe(durationMs);
              providerHealth?.record({ providerId, status: 'failure', durationMs });
              log.error(
                { providerId, durationMs, error: err instanceof Error ? err.message : String(err) },
                'provider.quote.failed',
              );
              return null;
            }
          })()
        : null;

    return {
      provider,
      base,
      deepLink,
      adapterQuotePromise,
      providerHash,
    };
  });

  const resolvedInputs = await Promise.all(
    parts.map(async (item) => {
      const adapterQuote = item.adapterQuotePromise ? await item.adapterQuotePromise : null;

      const capabilities = adapterQuote?.capabilities ?? item.provider.capabilities;
      const isDeepLinkOnly = capabilities.quote === false;
      const buyAmount = isDeepLinkOnly ? '0' : (item.base % 10_000n + 1_000n).toString();

      const raw = adapterQuote?.raw ?? {
        sellAmount: parsed.sellAmount,
        buyAmount,
        estimatedGas: isDeepLinkOnly ? null : 210000,
        feeBps: isDeepLinkOnly ? null : 30,
        route: [parsed.sellToken, parsed.buyToken],
      };

      const normalized = adapterQuote?.normalized ?? normalizeQuote({ raw, assumptions });

      // Use adapter-provided signals if available, otherwise use placeholder signals.
      // Adapter signals are based on actual quote data; placeholders are used when
      // the adapter couldn't fetch a real quote (e.g., missing API key).
      const baseSignals =
        adapterQuote && adapterQuote.isStub === false && adapterQuote.signals
          ? adapterQuote.signals
          : defaultPlaceholderSignals({
              mode: parsed.mode ?? 'NORMAL',
              quoteIsAvailable: capabilities.quote,
              isDeepLinkOnly,
              reason: isDeepLinkOnly
                ? 'deep_link_only_quote_not_available'
                : adapterQuote && adapterQuote.isStub === false
                  ? `${item.provider.providerId}_live_quote`
                  : 'stub_quote_integration_not_implemented',
            });

      // Try to build a real txRequest for preflight simulation when the adapter supports it
      let txRequest: TxRequest | null = null;
      const adapter = deps.adapters?.get(item.provider.providerId);
      
      if (adapter?.buildTx && capabilities.buildTx && adapterQuote && !adapterQuote.isStub && parsed.account) {
        try {
          const builtTx = await adapter.buildTx(parsed, adapterQuote);
          txRequest = {
            from: parsed.account,
            to: builtTx.to,
            data: builtTx.data as `0x${string}`,
            value: builtTx.value ? (`0x${BigInt(builtTx.value).toString(16)}` as `0x${string}`) : '0x0',
            // Pass expected output for simulation comparison
            expectedBuyAmount: raw.buyAmount,
            buyToken: parsed.buyToken,
          };
        } catch (err) {
          log.debug({ providerId: item.provider.providerId, error: (err as Error).message }, 'buildTx for preflight failed');
        }
      }
      
      // Fallback: minimal txRequest for providers without buildTx
      if (!txRequest && item.provider.providerId === '1inch') {
        txRequest = {
            from: parsed.account ?? ZERO_ADDRESS,
            to: parsed.buyToken,
            data: '0x',
            value: '0x0',
            expectedBuyAmount: raw.buyAmount,
            buyToken: parsed.buyToken,
          };
      }

      const preflightFallback: PreflightResult = {
        ok: true,
        pRevert: 0.2, // Low default when we can't verify; don't assume bad
        confidence: 0,
        reasons: ['no_txRequest_available'],
      };

      return {
        provider: item.provider,
        capabilities,
        isDeepLinkOnly,
        deepLink: item.deepLink,
        raw,
        normalized,
        baseSignals,
        txRequest,
        preflightFallback,
      };
    }),
  );

  const resolvedQuotes: RankedQuote[] = await Promise.all(
    resolvedInputs.map(async (item) => {
      const preflightResult = item.txRequest
        ? await deps.preflightClient.verify(item.txRequest)
        : item.preflightFallback;

      metrics?.preflightVerificationsTotal.labels({ status: preflightResult.ok ? 'ok' : 'fail' }).inc();

      const riskSignals = deps.riskEngine.assess({
        request: parsed,
        quote: {
          providerId: item.provider.providerId,
          sourceType: item.provider.category === 'dex' ? 'dex' : 'aggregator',
          capabilities: item.capabilities,
          raw: item.raw,
          normalized: item.normalized,
          signals: item.baseSignals,
          score: { beqScore: 0, rawOutputRank: 0 },
          deepLink: item.deepLink.url,
        },
        preflight: preflightResult,
      });

      // Best-effort on-chain heuristic: detects obvious non-contract/non-ERC20 tokens.
      const onchainSellability = rpc
        ? await assessOnchainSellability({
            chainId: parsed.chainId,
            buyToken: parsed.buyToken,
            rpcUrls: rpc.bscUrls,
            timeoutMs: rpc.timeoutMs,
            multicall3Address: sellability?.multicall3Address ?? null,
            baseTokens: sellability?.baseTokensBsc ?? null,
            pancake: sellability?.pancake ?? null,
          })
        : null;

      const tokenSecuritySellability = tokenSecurity
        ? await assessTokenSecuritySellability({
            chainId: parsed.chainId,
            token: parsed.buyToken,
            mode: parsed.mode ?? 'NORMAL',
            config: {
              enabled: tokenSecurity.enabled,
              goPlusEnabled: tokenSecurity.goPlusEnabled,
              goPlusBaseUrl: tokenSecurity.goPlusBaseUrl,
              honeypotIsEnabled: tokenSecurity.honeypotIsEnabled,
              honeypotIsBaseUrl: tokenSecurity.honeypotIsBaseUrl,
              timeoutMs: tokenSecurity.timeoutMs,
              cacheTtlMs: tokenSecurity.cacheTtlMs,
              taxStrictMaxPercent: tokenSecurity.taxStrictMaxPercent,
            },
          })
        : null;

      // Merge sellability signals intelligently:
      // - Token security FAIL or UNCERTAIN (SAFE mode) takes priority for honeypot/tax protection
      // - Onchain OK/FAIL with high confidence is authoritative for liquidity
      // - Adapter signals are used as fallback
      // - Risk engine classification provides context
      const mode = parsed.mode ?? 'NORMAL';
      const mergedSignals = onchainSellability
        ? {
            ...riskSignals,
            sellability: (() => {
              const reasons = [
                ...riskSignals.sellability.reasons,
                ...onchainSellability.reasons,
                ...(tokenSecuritySellability?.reasons ?? []),
              ];
              const maxConfidence = Math.max(
                riskSignals.sellability.confidence,
                onchainSellability.confidence,
                tokenSecuritySellability?.confidence ?? 0,
              );

              // Token security FAIL should override everything (honeypot/cannot-sell/tax).
              if (tokenSecuritySellability?.status === 'FAIL' && tokenSecuritySellability.confidence >= 0.8) {
                return { status: 'FAIL' as const, confidence: maxConfidence, reasons };
              }

              // SAFE mode: token security UNCERTAIN also blocks OK (fail-closed policy).
              if (mode === 'SAFE' && tokenSecuritySellability?.status === 'UNCERTAIN') {
                return { status: 'UNCERTAIN' as const, confidence: maxConfidence, reasons };
              }

              // Onchain FAIL with good confidence = definitive FAIL
              if (onchainSellability.status === 'FAIL' && onchainSellability.confidence >= 0.8) {
                return { status: 'FAIL' as const, confidence: maxConfidence, reasons };
              }

              // SAFE mode: require token security OK for full OK (multi-oracle + tax check)
              if (mode === 'SAFE') {
                if (tokenSecuritySellability?.status === 'OK' && onchainSellability.status === 'OK') {
                  return { status: 'OK' as const, confidence: maxConfidence, reasons };
                }
                // If on-chain OK but token security not OK or missing, UNCERTAIN
                if (onchainSellability.status === 'OK') {
                  return { status: 'UNCERTAIN' as const, confidence: maxConfidence, reasons: [...reasons, 'safe_mode:missing_oracle_ok'] };
                }
              }

              // Onchain OK with good confidence = trust it (real liquidity detected)
              if (onchainSellability.status === 'OK' && onchainSellability.confidence >= 0.7) {
                return { status: 'OK' as const, confidence: maxConfidence, reasons };
              }

              // Token security OK is supporting evidence when onchain doesn't contradict.
              if (tokenSecuritySellability?.status === 'OK' && onchainSellability.status !== 'FAIL') {
                return { status: 'OK' as const, confidence: maxConfidence, reasons };
              }

              // Adapter says OK and onchain doesn't contradict = OK
              if (item.baseSignals.sellability.status === 'OK' && onchainSellability.status !== 'FAIL') {
                return { status: 'OK' as const, confidence: maxConfidence, reasons };
              }

              // Otherwise, use risk engine assessment
              return { status: riskSignals.sellability.status, confidence: maxConfidence, reasons };
            })(),
          }
        : riskSignals;

      return {
        providerId: item.provider.providerId,
        sourceType: item.provider.category === 'dex' ? 'dex' : 'aggregator',
        capabilities: item.capabilities,
        raw: item.raw,
        normalized: item.normalized,
        signals: mergedSignals,
        score: { beqScore: 0, rawOutputRank: 0 },
        deepLink: item.deepLink.url,
      };
    }),
  );

  const ranked = rankQuotes({
    mode: parsed.mode ?? 'NORMAL',
    providerMeta,
    quotes: resolvedQuotes,
    assumptions,
    ...(parsed.scoringOptions ? { scoringOptions: parsed.scoringOptions } : {}),
    buyTokenPriceUsd: parsed.buyTokenPriceUsd ?? null,
    buyTokenDecimals: parsed.buyTokenDecimals ?? 18,
  });

  const bestRawOutputProviderId =
    BigInt(ranked.bestRawQuotes[0]?.raw.buyAmount ?? '0') > 0n ? ranked.bestRawQuotes[0]!.providerId : null;

  const executable = ranked.rankedQuotes.find((q) => q.capabilities.buildTx);
  const bestExecutableQuoteProviderId = executable ? executable.providerId : null;

  const receipt: DecisionReceipt = {
    id: receiptId,
    createdAt: new Date(0).toISOString(),
    request: parsed,
    bestExecutableQuoteProviderId,
    bestRawOutputProviderId,
    beqRecommendedProviderId: ranked.beqRecommendedProviderId,
    rankedQuotes: ranked.rankedQuotes,
    bestRawQuotes: ranked.bestRawQuotes,
    normalization: {
      assumptions,
    },
    whyWinner: ranked.whyWinner,
    ranking: {
      mode: parsed.mode ?? 'NORMAL',
      rationale: [
        'registry_providers_enumerated',
        'ranked_by_beq',
        bestExecutableQuoteProviderId ? 'beq_executable_present' : 'beq_no_executable_quotes',
        bestRawOutputProviderId ? 'best_raw_output_selected' : 'no_quotes_available',
      ],
    },
    warnings: [
      ...ranked.bestRawQuotes
        .filter((q) => q.capabilities.quote === false)
        .map((q) => `deep_link_only:${q.providerId}`),
    ],
  };

  return {
    receiptId,
    rankedQuotes: ranked.rankedQuotes,
    bestRawQuotes: ranked.bestRawQuotes,
    bestExecutableQuoteProviderId,
    bestRawOutputProviderId,
    beqRecommendedProviderId: ranked.beqRecommendedProviderId,
    receipt,
  };
}
