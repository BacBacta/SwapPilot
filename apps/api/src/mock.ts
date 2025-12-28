import { createHash } from 'node:crypto';

import {
  QuoteRequestSchema,
  type QuoteRequest,
  type RankedQuote,
  type DecisionReceipt,
} from '@swappilot/shared';

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
  bestExecutableQuoteProviderId: string;
  bestRawOutputProviderId: string;
  receipt: DecisionReceipt;
} {
  const hash = quoteRequestHash(request);
  const receiptId = `rcpt_${hash.slice(0, 24)}`;

  const base = BigInt('0x' + hash.slice(0, 12));
  const buyAmount = (base % 10_000n + 1_000n).toString();

  const rankedQuotes: RankedQuote[] = [
    {
      providerId: 'mock',
      sourceType: 'aggregator',
      capabilities: { quote: true, buildTx: false, deepLink: true },
      raw: {
        sellAmount: request.sellAmount,
        buyAmount,
        estimatedGas: 210000,
        feeBps: 30,
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
          confidence: 0.5,
          reasons: ['mock_only'],
        },
        revertRisk: { level: 'MEDIUM', reasons: ['mock_only'] },
        mevExposure: { level: 'MEDIUM', reasons: ['mock_only'] },
        churn: { level: 'LOW', reasons: ['deterministic_mock'] },
        preflight: { ok: true, reasons: [] },
      },
      score: {
        beqScore: Number(base % 1000n),
        rawOutputRank: 0,
      },
      deepLink: `https://example.com/swap?sell=${request.sellToken}&buy=${request.buyToken}&amount=${request.sellAmount}`,
    },
  ];

  const first = rankedQuotes[0]!;
  const bestExecutableQuoteProviderId = first.providerId;
  const bestRawOutputProviderId = first.providerId;

  const receipt: DecisionReceipt = {
    id: receiptId,
    createdAt: new Date(0).toISOString(),
    request,
    bestExecutableQuoteProviderId,
    bestRawOutputProviderId,
    rankedQuotes,
    ranking: {
      mode: request.mode ?? 'NORMAL',
      rationale: ['mock_quote_selected'],
    },
    warnings: ['mock_only_no_provider_integrations'],
  };

  return {
    receiptId,
    rankedQuotes,
    bestExecutableQuoteProviderId,
    bestRawOutputProviderId,
    receipt,
  };
}
