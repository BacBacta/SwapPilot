import {
  QuoteRequestSchema,
  type QuoteRequest,
  type RankedQuote,
  type DecisionReceipt,
  deterministicHash,
  sha256Hex,
} from '@swappilot/shared';

import { getEnabledProviders } from '@swappilot/adapters';
import { deepLinkBuilder } from '@swappilot/deeplinks';

import { defaultAssumptions, normalizeQuote, defaultPlaceholderSignals, rankQuotes } from '@swappilot/scoring';

export function buildDeterministicMockQuote(request: QuoteRequest): {
  receiptId: string;
  rankedQuotes: RankedQuote[];
  bestRawQuotes: RankedQuote[];
  bestExecutableQuoteProviderId: string | null;
  bestRawOutputProviderId: string | null;
  beqRecommendedProviderId: string | null;
  receipt: DecisionReceipt;
} {
  const parsed = QuoteRequestSchema.parse(request);
  const hash = deterministicHash(parsed);
  const receiptId = `rcpt_${hash.slice(0, 24)}`;

  const enabledProviders = getEnabledProviders({ providers: parsed.providers });
  const providerMeta = new Map(enabledProviders.map((p) => [p.providerId, p] as const));

  const assumptions = defaultAssumptions();

  const quotes: RankedQuote[] = enabledProviders.map((provider) => {
    const providerHash = sha256Hex(`${hash}:${provider.providerId}`);
    const base = BigInt('0x' + providerHash.slice(0, 12));

    const isDeepLinkOnly = provider.capabilities.quote === false;
    const buyAmount = isDeepLinkOnly ? '0' : (base % 10_000n + 1_000n).toString();

    const deepLink = deepLinkBuilder(provider.providerId, parsed);

    const raw = {
      sellAmount: parsed.sellAmount,
      buyAmount,
      estimatedGas: isDeepLinkOnly ? null : 210000,
      feeBps: isDeepLinkOnly ? null : 30,
      route: [parsed.sellToken, parsed.buyToken],
    };

    const normalized = normalizeQuote({ raw, assumptions });

    const signals = defaultPlaceholderSignals({
      mode: parsed.mode ?? 'NORMAL',
      quoteIsAvailable: provider.capabilities.quote,
      isDeepLinkOnly,
      reason: isDeepLinkOnly ? 'deep_link_only_quote_not_available' : 'stub_quote_integration_not_implemented',
    });

    return {
      providerId: provider.providerId,
      sourceType: provider.category === 'dex' ? 'dex' : 'aggregator',
      capabilities: provider.capabilities,
      raw,
      normalized,
      signals,
      score: {
        beqScore: 0,
        rawOutputRank: 0,
      },
      deepLink: deepLink.url,
    };
  });

  const ranked = rankQuotes({
    mode: parsed.mode ?? 'NORMAL',
    providerMeta,
    quotes,
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
