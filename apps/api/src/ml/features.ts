import type { RiskSignals } from '@swappilot/shared';
import type { MLFeatures } from './types';

function extractLiquidityUsd(reasons: string[]): number {
  const match = reasons.find((r) => r.startsWith('dexscreener:liquidity_usd:max:'));
  if (!match) return 0;
  const raw = match.split(':').pop();
  if (!raw) return 0;
  const v = Number(raw);
  return Number.isFinite(v) ? v : 0;
}

function extractHashditRiskLevel(reasons: string[]): number {
  const match = reasons.find((r) => r.startsWith('hashdit:riskLevel:'));
  if (!match) return -1;
  const raw = match.split(':').pop();
  if (!raw) return -1;
  const v = Number(raw);
  return Number.isFinite(v) ? v : -1;
}

export type FeatureInput = {
  signals: RiskSignals;
  sourceType: 'dex' | 'aggregator';
  integrationConfidence: number;
  estimatedGas?: number | null;
};

export function buildFeatureVector(input: FeatureInput): MLFeatures {
  const { signals, sourceType, integrationConfidence, estimatedGas } = input;
  const preflight = signals.preflight;
  const sell = signals.sellability;
  const reasons = sell.reasons;

  return {
    pRevert: preflight?.pRevert ?? 0.2,
    preflightConfidence: preflight?.confidence ?? 0,
    outputMismatchRatio: preflight?.outputMismatchRatio ?? 1.0,
    sellabilityIsOk: sell.status === 'OK' ? 1 : 0,
    sellabilityIsFail: sell.status === 'FAIL' ? 1 : 0,
    sellabilityConfidence: sell.confidence,
    hashditRiskLevel: extractHashditRiskLevel(reasons),
    liquidityUsd: extractLiquidityUsd(reasons),
    integrationConfidence,
    estimatedGas: estimatedGas ?? 0,
    sourceTypeIsDex: sourceType === 'dex' ? 1 : 0,
  };
}
