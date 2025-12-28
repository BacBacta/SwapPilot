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

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function buildDeterministicMockQuote(
  request: QuoteRequest,
  deps: {
    preflightClient: PreflightClient;
    riskEngine: RiskEngine;
    pancakeSwapAdapter?: Adapter;
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
  return buildDeterministicMockQuoteImpl(request, deps);
}

async function buildDeterministicMockQuoteImpl(
  request: QuoteRequest,
  deps: {
    preflightClient: PreflightClient;
    riskEngine: RiskEngine;
    pancakeSwapAdapter?: Adapter;
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

  const pancakeMeta = deps.pancakeSwapAdapter?.getProviderMeta();
  const enabledProviders = getEnabledProviders({ providers: parsed.providers }).map((p) =>
    p.providerId === 'pancakeswap' && pancakeMeta ? pancakeMeta : p,
  );
  const providerMeta = new Map(enabledProviders.map((p) => [p.providerId, p] as const));

  const assumptions = defaultAssumptions();

  const parts = enabledProviders.map((provider) => {
    const providerHash = sha256Hex(`${hash}:${provider.providerId}`);
    const base = BigInt('0x' + providerHash.slice(0, 12));

    const deepLink = deepLinkBuilder(provider.providerId, parsed);

    const adapterQuotePromise =
      provider.providerId === 'pancakeswap' && deps.pancakeSwapAdapter
        ? deps.pancakeSwapAdapter.getQuote(parsed)
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

      const baseSignals = defaultPlaceholderSignals({
        mode: parsed.mode ?? 'NORMAL',
        quoteIsAvailable: capabilities.quote,
        isDeepLinkOnly,
        reason: isDeepLinkOnly
          ? 'deep_link_only_quote_not_available'
          : adapterQuote && adapterQuote.isStub === false
            ? 'pancakeswap_v2_onchain_quote'
            : 'stub_quote_integration_not_implemented',
      });

      // Mock txRequest path: provide a minimal txRequest for at least one provider.
      // This is used to exercise the preflight + risk pipeline without executing anything.
      const txRequest: TxRequest | null = item.provider.providerId === '1inch'
        ? {
            from: parsed.account ?? ZERO_ADDRESS,
            to: parsed.buyToken,
            data: '0x',
            value: '0x0',
          }
        : null;

      const preflightFallback: PreflightResult = {
        ok: true,
        pRevert: 0.5,
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

      return {
        providerId: item.provider.providerId,
        sourceType: item.provider.category === 'dex' ? 'dex' : 'aggregator',
        capabilities: item.capabilities,
        raw: item.raw,
        normalized: item.normalized,
        signals: riskSignals,
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
      'stub_only_no_live_integrations',
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
