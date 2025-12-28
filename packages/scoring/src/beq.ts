import type { QuoteMode, RiskSignals } from '@swappilot/shared';

import type { ScoreInput, ScoreOutput, WhyRule } from './types';

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function riskPenaltyFromSignals(mode: QuoteMode, signals: RiskSignals): { penalty: number; why: WhyRule[] } {
  const levels = [signals.revertRisk.level, signals.mevExposure.level, signals.churn.level];
  const worst = levels.includes('HIGH') ? 'HIGH' : levels.includes('MEDIUM') ? 'MEDIUM' : 'LOW';

  const base = worst === 'LOW' ? 1 : worst === 'MEDIUM' ? 0.8 : 0.5;

  // SAFE penalizes HIGH more strongly.
  const penalty = mode === 'SAFE' && worst === 'HIGH' ? 0.3 : base;

  const why: WhyRule[] = worst === 'LOW' ? ['risk_low'] : worst === 'MEDIUM' ? ['risk_medium'] : ['risk_high'];
  return { penalty, why };
}

function sellFactorFromSignals(mode: QuoteMode, signals: RiskSignals): { factor: number; disqualified: boolean; why: WhyRule[] } {
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

  const { factor: sellFactor, disqualified, why: whySell } = sellFactorFromSignals(input.mode, input.signals);
  why.push(...whySell);

  const { penalty: riskPenalty, why: whyRisk } = riskPenaltyFromSignals(input.mode, input.signals);
  why.push(...whyRisk);

  const reliability = clamp01(input.integrationConfidence);
  why.push('integration_confidence');

  const netOut = netOutFromBuyAmount(input.buyAmount, input.feeBps);

  // Score is a scaled float; keep deterministic ordering by using bigint netOut then multipliers.
  // Use Number(netOut) can overflow; instead scale down by taking first 15 digits.
  const netOutStr = netOut.toString();
  const head = netOutStr.length > 15 ? netOutStr.slice(0, 15) : netOutStr;
  const netOutScaled = Number(head);

  const beqScore = disqualified
    ? 0
    : Math.max(0, Math.round(netOutScaled * reliability * sellFactor * riskPenalty));

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
    preflight: { ok: true, reasons: [] },
  };
}
