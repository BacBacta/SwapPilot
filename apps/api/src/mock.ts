import { createHash } from 'node:crypto';

import {
  QuoteRequestSchema,
  type QuoteRequest,
  type RankedQuote,
  type DecisionReceipt,
} from '@swappilot/shared';

import { getEnabledProviders } from '@swappilot/adapters';
import { deepLinkBuilder } from '@swappilot/deeplinks';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function quoteRequestHash(input: QuoteRequest): string {
  const parsed = QuoteRequestSchema.parse(input);
  const canonical = stableStringify(parsed);
  return createHash('sha256').update(canonical).digest('hex');
}

export function buildDeterministicMockQuote(request: QuoteRequest): {
  receiptId: string;
  rankedQuotes: RankedQuote[];
  bestExecutableQuoteProviderId: string | null;
  bestRawOutputProviderId: string | null;
  receipt: DecisionReceipt;
} {
  const hash = quoteRequestHash(request);
  const receiptId = `rcpt_${hash.slice(0, 24)}`;

  const enabledProviders = getEnabledProviders({ providers: request.providers });

  const rankedQuotes: RankedQuote[] = enabledProviders.map((provider) => {
    const providerHash = createHash('sha256').update(`${hash}:${provider.providerId}`).digest('hex');
    const base = BigInt('0x' + providerHash.slice(0, 12));

    const isDeepLinkOnly = provider.capabilities.quote === false;
    const buyAmount = isDeepLinkOnly ? '0' : (base % 10_000n + 1_000n).toString();

    const deepLink = deepLinkBuilder(provider.providerId, request);

    return {
      providerId: provider.providerId,
      sourceType: provider.category === 'dex' ? 'dex' : 'aggregator',
      capabilities: provider.capabilities,
      raw: {
        sellAmount: request.sellAmount,
        buyAmount,
        estimatedGas: isDeepLinkOnly ? null : 210000,
        feeBps: isDeepLinkOnly ? null : 30,
        route: [request.sellToken, request.buyToken],
      },
      normalized: {
        buyAmount,
        effectivePrice: '0',
        estimatedGasUsd: null,
        feesUsd: null,
      },
      signals: {
        sellability: {
          status: 'UNCERTAIN',
          confidence: isDeepLinkOnly ? 0.9 : 0.2,
          reasons: isDeepLinkOnly
            ? ['deep_link_only_quote_not_available']
            : ['stub_quote_integration_not_implemented'],
        },
        revertRisk: { level: 'MEDIUM', reasons: ['stub_only'] },
        mevExposure: { level: 'MEDIUM', reasons: ['stub_only'] },
        churn: { level: 'LOW', reasons: ['registry_based'] },
        preflight: { ok: true, reasons: [] },
      },
      score: {
        beqScore: Number(base % 1000n),
        rawOutputRank: 0,
      },
      deepLink: deepLink.url,
    };
  });

  const byRawOutput = [...rankedQuotes].sort((a, b) => {
    const aAmt = BigInt(a.raw.buyAmount);
    const bAmt = BigInt(b.raw.buyAmount);
    if (aAmt === bAmt) return a.providerId.localeCompare(b.providerId);
    return aAmt > bAmt ? -1 : 1;
  });

  for (const [index, quote] of byRawOutput.entries()) {
    quote.score.rawOutputRank = index;
  }

  const bestRawOutputProviderId = BigInt(byRawOutput[0]?.raw.buyAmount ?? '0') > 0n ? byRawOutput[0]!.providerId : null;

  const executable = rankedQuotes.find((q) => q.capabilities.buildTx);
  const bestExecutableQuoteProviderId = executable ? executable.providerId : null;

  // Return quotes ranked by raw output for now.
  const rankedByOutput = byRawOutput;

  const receipt: DecisionReceipt = {
    id: receiptId,
    createdAt: new Date(0).toISOString(),
    request,
    bestExecutableQuoteProviderId,
    bestRawOutputProviderId,
    rankedQuotes: rankedByOutput,
    ranking: {
      mode: request.mode ?? 'NORMAL',
      rationale: [
        'registry_providers_enumerated',
        bestExecutableQuoteProviderId ? 'beq_executable_present' : 'beq_no_executable_quotes',
        bestRawOutputProviderId ? 'best_raw_output_selected' : 'no_quotes_available',
      ],
    },
    warnings: [
      'stub_only_no_live_integrations',
      ...rankedByOutput
        .filter((q) => q.capabilities.quote === false)
        .map((q) => `deep_link_only:${q.providerId}`),
    ],
  };

  return {
    receiptId,
    rankedQuotes: rankedByOutput,
    bestExecutableQuoteProviderId,
    bestRawOutputProviderId,
    receipt,
  };
}
