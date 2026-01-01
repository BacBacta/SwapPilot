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
      preflight: { ok: true, pRevert: 0, confidence: 1, reasons: [] },
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

  it('ranks larger buyAmount higher when sellability is equal', () => {
    const assumptions = defaultAssumptions();
    // Simulating real scenario: Odos returns ~6k tokens, others return ~39k tokens
    const quotes = [
      makeQuote({ providerId: 'odos', buyAmount: '5939199929033357787136', mode: 'NORMAL', sellability: 'OK' }),
      makeQuote({ providerId: 'paraswap', buyAmount: '38701337942755908699944', mode: 'NORMAL', sellability: 'OK' }),
      makeQuote({ providerId: 'kyberswap', buyAmount: '38500000000000000000000', mode: 'NORMAL', sellability: 'OK' }),
    ];

    const providerMeta = new Map<string, ProviderMeta>([
      ['odos', { providerId: 'odos', displayName: 'Odos', category: 'aggregator', homepageUrl: 'x', capabilities: { quote: true, buildTx: true, deepLink: true }, integrationConfidence: 0.9, notes: '' }],
      ['paraswap', { providerId: 'paraswap', displayName: 'ParaSwap', category: 'aggregator', homepageUrl: 'x', capabilities: { quote: true, buildTx: true, deepLink: true }, integrationConfidence: 0.9, notes: '' }],
      ['kyberswap', { providerId: 'kyberswap', displayName: 'KyberSwap', category: 'aggregator', homepageUrl: 'x', capabilities: { quote: true, buildTx: true, deepLink: true }, integrationConfidence: 0.9, notes: '' }],
    ]);

    const out = rankQuotes({ mode: 'NORMAL', providerMeta, quotes, assumptions });
    
    // ParaSwap should be #1 because it has the highest buyAmount
    expect(out.rankedQuotes[0].providerId).toBe('paraswap');
    expect(out.beqRecommendedProviderId).toBe('paraswap');
    
    // Odos should be last because it has the lowest buyAmount
    expect(out.rankedQuotes[out.rankedQuotes.length - 1].providerId).toBe('odos');
  });

  it('does not catastrophically penalize missing provider meta', () => {
    const assumptions = defaultAssumptions();
    const quotes = [
      makeQuote({ providerId: 'odos', buyAmount: '5939199929033357787136', mode: 'NORMAL', sellability: 'OK' }),
      makeQuote({ providerId: 'okx-dex', buyAmount: '38701337942755908699944', mode: 'NORMAL', sellability: 'OK' }),
    ];

    // Only Odos is present in providerMeta (simulates a meta wiring bug).
    const providerMeta = new Map<string, ProviderMeta>([
      ['odos', { providerId: 'odos', displayName: 'Odos', category: 'aggregator', homepageUrl: 'x', capabilities: { quote: true, buildTx: true, deepLink: true }, integrationConfidence: 0.9, notes: '' }],
    ]);

    const out = rankQuotes({ mode: 'NORMAL', providerMeta, quotes, assumptions });
    expect(out.rankedQuotes[0].providerId).toBe('okx-dex');
    expect(out.beqRecommendedProviderId).toBe('okx-dex');
  });
});
