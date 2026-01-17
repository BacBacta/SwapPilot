import type { QuoteMode, RiskSignals, ScoringOptions } from '@swappilot/shared';

import type { ScoreInput, ScoreOutput, WhyRule } from './types';

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function riskPenaltyFromSignals(
  mode: QuoteMode,
  signals: RiskSignals,
  options?: ScoringOptions,
): { penalty: number; why: WhyRule[] } {
  // If MEV-aware scoring is disabled, ignore MEV exposure
  const mevLevel = options?.mevAwareScoring === false ? 'LOW' : signals.mevExposure.level;
  const levels = [signals.revertRisk.level, mevLevel, signals.churn.level];
  const worst = levels.includes('HIGH') ? 'HIGH' : levels.includes('MEDIUM') ? 'MEDIUM' : 'LOW';

  const base = worst === 'LOW' ? 1 : worst === 'MEDIUM' ? 0.8 : 0.5;

  // SAFE penalizes HIGH more strongly.
  const penalty = mode === 'SAFE' && worst === 'HIGH' ? 0.3 : base;

  const why: WhyRule[] = worst === 'LOW' ? ['risk_low'] : worst === 'MEDIUM' ? ['risk_medium'] : ['risk_high'];
  if (options?.mevAwareScoring === false) {
    why.push('mev_scoring_disabled');
  }
  return { penalty, why };
}

function sellFactorFromSignals(
  mode: QuoteMode,
  signals: RiskSignals,
  options?: ScoringOptions,
): { factor: number; disqualified: boolean; why: WhyRule[] } {
  // If sellability check is disabled, treat all as OK
  if (options?.sellabilityCheck === false) {
    return { factor: 1, disqualified: false, why: ['sellability_check_disabled'] };
  }

  const status = signals.sellability.status;

  if (status === 'OK') return { factor: 1, disqualified: false, why: ['sellability_ok'] };

  if (status === 'UNCERTAIN') {
    const factor = mode === 'SAFE' ? 0.6 : mode === 'NORMAL' ? 0.75 : 0.9;
    return { factor, disqualified: false, why: ['sellability_uncertain'] };
  }

  // FAIL
  if (mode === 'SAFE') {
    return {
      factor: 0,
      disqualified: true,
      why: ['sellability_fail', 'mode_safe_excludes_fail_sellability'],
    };
  }

  const factor = mode === 'NORMAL' ? 0.1 : 0.5;
  return { factor, disqualified: false, why: ['sellability_fail'] };
}

function netOutFromBuyAmount(buyAmount: bigint, feeBps: number | null): bigint {
  if (!feeBps || feeBps <= 0) return buyAmount;
  const numerator = 10_000n - BigInt(feeBps);
  return (buyAmount * numerator) / 10_000n;
}

export function computeBeqScore(input: ScoreInput): ScoreOutput {
  const why: WhyRule[] = ['beq_formula'];

  const preflight = input.signals.preflight;
  if (preflight) {
    if (preflight.ok) {
      why.push('preflight_ok');
    } else {
      why.push('preflight_failed');
      if (input.mode === 'SAFE') {
        return {
          providerId: input.providerId,
          beqScore: 0,
          components: {
            netOut: 0n,
            reliability: 0,
            sellFactor: 0,
            riskPenalty: 0,
          },
          disqualified: true,
          why: [...why, 'mode_safe_excludes_preflight_fail'],
        };
      }
    }
  }

  const { factor: sellFactor, disqualified, why: whySell } = sellFactorFromSignals(input.mode, input.signals, input.scoringOptions);
  why.push(...whySell);

  const { penalty: riskPenalty, why: whyRisk } = riskPenaltyFromSignals(input.mode, input.signals, input.scoringOptions);
  why.push(...whyRisk);

  const reliability = clamp01(input.integrationConfidence);
  why.push('integration_confidence');

  const netOut = netOutFromBuyAmount(input.buyAmount, input.feeBps);

  // Apply preflight revert probability as a multiplicative penalty when available.
  const preflightPenalty = preflight ? 1 - clamp01(preflight.pRevert) : 1;

  // Convert bigint to comparable number for scoring.
  // Use the provided scaleFactor for consistent comparison across all quotes.
  // If no scaleFactor provided, calculate one for this quote alone (fallback).
  let netOutScaled: number;
  if (netOut <= 0n) {
    netOutScaled = 0;
  } else {
    const scaleFactor = input.scaleFactor ?? Math.max(0, netOut.toString().length - 12);
    netOutScaled = Number(netOut / 10n ** BigInt(scaleFactor));
  }

  const beqScore = disqualified
    ? 0
    : Math.max(0, Math.round(netOutScaled * reliability * sellFactor * riskPenalty * preflightPenalty));

  return {
    providerId: input.providerId,
    beqScore,
    components: {
      netOut,
      reliability,
      sellFactor,
      riskPenalty,
    },
    disqualified,
    why,
  };
}

export function defaultPlaceholderSignals(params: {
  mode: QuoteMode;
  quoteIsAvailable: boolean;
  isDeepLinkOnly: boolean;
  reason: string;
}): RiskSignals {
  const sellability = params.isDeepLinkOnly
    ? { status: 'UNCERTAIN' as const, confidence: 0.9, reasons: [params.reason] }
    : params.quoteIsAvailable
      ? { status: 'UNCERTAIN' as const, confidence: 0.25, reasons: [params.reason] }
      : { status: 'FAIL' as const, confidence: 0.9, reasons: [params.reason] };

  return {
    sellability,
    revertRisk: { level: 'MEDIUM', reasons: ['stub_only'] },
    mevExposure: { level: 'MEDIUM', reasons: ['stub_only'] },
    churn: { level: 'LOW', reasons: ['registry_based'] },
    liquidity: { level: 'LOW', reasons: ['stub_only'] },
    slippage: { level: 'LOW', reasons: ['stub_only'] },
    protocolRisk: {
      security: { level: 'LOW', reasons: ['stub_only'] },
      compliance: { level: 'LOW', reasons: ['stub_only'] },
      financial: { level: 'LOW', reasons: ['stub_only'] },
      technology: { level: 'LOW', reasons: ['stub_only'] },
      operations: { level: 'LOW', reasons: ['stub_only'] },
      governance: { level: 'LOW', reasons: ['stub_only'] },
    },
    preflight: { ok: true, pRevert: 0.5, confidence: 0, reasons: ['preflight_not_run_stub'] },
  };
}
