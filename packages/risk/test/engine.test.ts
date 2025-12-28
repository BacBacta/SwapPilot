import { describe, expect, it } from 'vitest';

import { createRiskEngine } from '../src/engine';

describe('risk engine', () => {
  it('MEME + preflight fail => sellability FAIL', () => {
    const engine = createRiskEngine({ knownTokens: [], memeTokens: ['0x0000000000000000000000000000000000000002'] });

    const signals = engine.assess({
      request: {
        chainId: 56,
        sellToken: '0x0000000000000000000000000000000000000001',
        buyToken: '0x0000000000000000000000000000000000000002',
        sellAmount: '1000',
        slippageBps: 100,
        mode: 'NORMAL',
      },
      quote: {
        providerId: 'p',
        sourceType: 'aggregator',
        capabilities: { quote: true, buildTx: false, deepLink: true },
        raw: { sellAmount: '1000', buyAmount: '2000', estimatedGas: 1, feeBps: 0, route: [] },
        normalized: { buyAmount: '2000', effectivePrice: '2', estimatedGasUsd: null, feesUsd: null },
        signals: {
          sellability: { status: 'UNCERTAIN', confidence: 0.1, reasons: [] },
          revertRisk: { level: 'LOW', reasons: [] },
          mevExposure: { level: 'LOW', reasons: [] },
          churn: { level: 'LOW', reasons: [] },
          preflight: { ok: true, pRevert: 0.5, confidence: 0, reasons: [] },
        },
        score: { beqScore: 0, rawOutputRank: 0 },
        deepLink: null,
      },
      preflight: { ok: false, pRevert: 1, confidence: 1, reasons: ['revert'] },
    });

    expect(signals.sellability.status).toBe('FAIL');
    expect(signals.sellability.reasons.join('|')).toContain('token_class:meme');
  });
});
