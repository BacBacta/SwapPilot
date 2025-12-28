import { describe, expect, it } from 'vitest';

import type { QuoteMode, RiskSignals } from '@swappilot/shared';

import { computeBeqScore } from '../src/beq';

function signals(status: 'OK' | 'UNCERTAIN' | 'FAIL'): RiskSignals {
  return {
    sellability: { status, confidence: 0.9, reasons: ['test'] },
    revertRisk: { level: 'LOW', reasons: [] },
    mevExposure: { level: 'LOW', reasons: [] },
    churn: { level: 'LOW', reasons: [] },
    preflight: { ok: true, reasons: [] },
  };
}

function score(mode: QuoteMode, sellability: 'OK' | 'UNCERTAIN' | 'FAIL') {
  return computeBeqScore({
    providerId: 'p',
    buyAmount: 10_000n,
    feeBps: 0,
    integrationConfidence: 1,
    signals: signals(sellability),
    mode,
  });
}

describe('computeBeqScore', () => {
  it('SAFE disqualifies FAIL sellability', () => {
    const out = score('SAFE', 'FAIL');
    expect(out.disqualified).toBe(true);
    expect(out.beqScore).toBe(0);
    expect(out.why).toContain('mode_safe_excludes_fail_sellability');
  });

  it('NORMAL does not disqualify FAIL sellability (but heavily penalizes)', () => {
    const out = score('NORMAL', 'FAIL');
    expect(out.disqualified).toBe(false);
    expect(out.beqScore).toBeGreaterThanOrEqual(0);
  });

  it('UNCERTAIN yields lower score than OK (same buyAmount)', () => {
    const ok = score('NORMAL', 'OK');
    const un = score('NORMAL', 'UNCERTAIN');
    expect(ok.beqScore).toBeGreaterThan(un.beqScore);
  });
});
