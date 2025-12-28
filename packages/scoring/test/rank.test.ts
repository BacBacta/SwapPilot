import { describe, expect, it } from 'vitest';

import type { ProviderMeta } from '@swappilot/adapters';
import type { QuoteMode, RankedQuote } from '@swappilot/shared';

import { defaultAssumptions, normalizeQuote } from '../src/normalize';
import { rankQuotes } from '../src/rank';

function makeQuote(params: {
  providerId: string;
  buyAmount: string;
  mode: QuoteMode;
  sellability: 'OK' | 'UNCERTAIN' | 'FAIL';
}): RankedQuote {
  const assumptions = defaultAssumptions();
  const raw = {
    sellAmount: '1000',
    buyAmount: params.buyAmount,
    estimatedGas: 210000,
    feeBps: 0,
    route: ['0x0000000000000000000000000000000000000001'],
  };

  return {
    providerId: params.providerId,
    sourceType: 'aggregator',
    capabilities: { quote: true, buildTx: false, deepLink: true },
    raw,
    normalized: normalizeQuote({ raw, assumptions }),
    signals: {
      sellability: { status: params.sellability, confidence: 0.9, reasons: [] },
      revertRisk: { level: 'LOW', reasons: [] },
      mevExposure: { level: 'LOW', reasons: [] },
      churn: { level: 'LOW', reasons: [] },
      preflight: { ok: true, reasons: [] },
    },
    score: { beqScore: 0, rawOutputRank: 0 },
    deepLink: 'https://example.com',
  };
}

describe('rankQuotes', () => {
  it('returns bestRawQuotes sorted by buyAmount desc', () => {
    const assumptions = defaultAssumptions();
    const quotes = [
      makeQuote({ providerId: 'a', buyAmount: '2000', mode: 'NORMAL', sellability: 'OK' }),
      makeQuote({ providerId: 'b', buyAmount: '3000', mode: 'NORMAL', sellability: 'OK' }),
      makeQuote({ providerId: 'c', buyAmount: '1000', mode: 'NORMAL', sellability: 'OK' }),
    ];

    const providerMeta = new Map<string, ProviderMeta>([
      ['a', { providerId: 'a', displayName: 'a', category: 'aggregator', homepageUrl: 'x', capabilities: { quote: true, buildTx: false, deepLink: true }, integrationConfidence: 1, notes: '' }],
      ['b', { providerId: 'b', displayName: 'b', category: 'aggregator', homepageUrl: 'x', capabilities: { quote: true, buildTx: false, deepLink: true }, integrationConfidence: 1, notes: '' }],
      ['c', { providerId: 'c', displayName: 'c', category: 'aggregator', homepageUrl: 'x', capabilities: { quote: true, buildTx: false, deepLink: true }, integrationConfidence: 1, notes: '' }],
    ]);

    const out = rankQuotes({ mode: 'NORMAL', providerMeta, quotes, assumptions });
    expect(out.bestRawQuotes.map((q) => q.providerId)).toEqual(['b', 'a', 'c']);
    expect(out.bestRawQuotes.map((q) => q.score.rawOutputRank)).toEqual([0, 1, 2]);
  });

  it('SAFE excludes disqualified quotes from BEQ ranking', () => {
    const assumptions = defaultAssumptions();
    const quotes = [
      makeQuote({ providerId: 'ok', buyAmount: '2000', mode: 'SAFE', sellability: 'OK' }),
      makeQuote({ providerId: 'bad', buyAmount: '999999', mode: 'SAFE', sellability: 'FAIL' }),
    ];

    const providerMeta = new Map<string, ProviderMeta>([
      ['ok', { providerId: 'ok', displayName: 'ok', category: 'aggregator', homepageUrl: 'x', capabilities: { quote: true, buildTx: false, deepLink: true }, integrationConfidence: 1, notes: '' }],
      ['bad', { providerId: 'bad', displayName: 'bad', category: 'aggregator', homepageUrl: 'x', capabilities: { quote: true, buildTx: false, deepLink: true }, integrationConfidence: 1, notes: '' }],
    ]);

    const out = rankQuotes({ mode: 'SAFE', providerMeta, quotes, assumptions });
    expect(out.rankedQuotes.map((q) => q.providerId)).toEqual(['ok']);
    expect(out.beqRecommendedProviderId).toBe('ok');
    expect(out.whyWinner[0]).toBe('ranked_by_beq');
  });
});
