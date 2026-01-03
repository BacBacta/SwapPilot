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
    expect(out.rankedQuotes.length).toBeGreaterThan(0);
    expect(out.rankedQuotes[0]!.providerId).toBe('paraswap');
    expect(out.beqRecommendedProviderId).toBe('paraswap');
    
    // Odos should be last because it has the lowest buyAmount
    expect(out.rankedQuotes.length).toBeGreaterThan(0);
    expect(out.rankedQuotes[out.rankedQuotes.length - 1]!.providerId).toBe('odos');
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
    expect(out.rankedQuotes.length).toBeGreaterThan(0);
    expect(out.rankedQuotes[0]!.providerId).toBe('okx-dex');
    expect(out.beqRecommendedProviderId).toBe('okx-dex');
  });

  it('BEQ v2 produces scores in 0-100 range with detailed breakdown', () => {
    const assumptions = defaultAssumptions();
    const quotes = [
      makeQuote({ providerId: 'best', buyAmount: '100000000000000000000', mode: 'NORMAL', sellability: 'OK' }),
      makeQuote({ providerId: 'medium', buyAmount: '80000000000000000000', mode: 'NORMAL', sellability: 'OK' }),
      makeQuote({ providerId: 'worst', buyAmount: '50000000000000000000', mode: 'NORMAL', sellability: 'OK' }),
    ];

    const providerMeta = new Map<string, ProviderMeta>([
      ['best', { providerId: 'best', displayName: 'Best', category: 'aggregator', homepageUrl: 'x', capabilities: { quote: true, buildTx: true, deepLink: true }, integrationConfidence: 1.0, notes: '' }],
      ['medium', { providerId: 'medium', displayName: 'Medium', category: 'aggregator', homepageUrl: 'x', capabilities: { quote: true, buildTx: true, deepLink: true }, integrationConfidence: 0.9, notes: '' }],
      ['worst', { providerId: 'worst', displayName: 'Worst', category: 'aggregator', homepageUrl: 'x', capabilities: { quote: true, buildTx: true, deepLink: true }, integrationConfidence: 0.8, notes: '' }],
    ]);

    const out = rankQuotes({ mode: 'NORMAL', providerMeta, quotes, assumptions });
    
    // All scores should be in 0-100 range
    for (const q of out.rankedQuotes) {
      expect(q.score.beqScore).toBeGreaterThanOrEqual(0);
      expect(q.score.beqScore).toBeLessThanOrEqual(100);
      
      // v2Details should be attached
      expect(q.score.v2Details).toBeDefined();
      expect(q.score.v2Details?.components.outputScore).toBeGreaterThanOrEqual(0);
      expect(q.score.v2Details?.components.outputScore).toBeLessThanOrEqual(100);
      expect(q.score.v2Details?.explanation.length).toBeGreaterThan(0);
    }
    
    // Best should have highest score (100 output × factors)
    expect(out.rankedQuotes.length).toBeGreaterThanOrEqual(3);
    expect(out.rankedQuotes[0]!.providerId).toBe('best');
    // Score is 100 * quality * risk, so may be slightly less than 100
    expect(out.rankedQuotes[0]!.score.beqScore).toBeGreaterThan(90);
    
    // Medium should have ~80% output score
    expect(out.rankedQuotes[1]!.providerId).toBe('medium');
    expect(out.rankedQuotes[1]!.score.v2Details?.components.outputScore).toBeCloseTo(80, 0);
    
    // Worst should have ~50% output score
    expect(out.rankedQuotes[2]!.providerId).toBe('worst');
    expect(out.rankedQuotes[2]!.score.v2Details?.components.outputScore).toBeCloseTo(50, 0);
  });
});
