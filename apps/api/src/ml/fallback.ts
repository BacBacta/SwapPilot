/**
 * Heuristic fallback — replicates the existing engine.ts placeholder logic.
 * Behaviour is bit-for-bit identical to the pre-M1 state when ML_ENABLED=false.
 */
import type { MLFeatures, MLPrediction, RiskLevel } from './types';

export function heuristicFallback(features: MLFeatures): MLPrediction {
  // Replicate engine.ts: dex → HIGH MEV, aggregator → MEDIUM
  const mevExposureLevel: RiskLevel = features.sourceTypeIsDex === 1 ? 'HIGH' : 'MEDIUM';

  // Replicate engine.ts: churn always MEDIUM
  const churnLevel: RiskLevel = 'MEDIUM';

  // Liquidity: infer from sellability (mirrors deriveLiquidityRisk heuristic)
  let liquidityLevel: RiskLevel = 'MEDIUM';
  if (features.sellabilityIsFail === 1) {
    liquidityLevel = 'HIGH';
  } else if (features.sellabilityIsOk === 1 && features.pRevert < 0.2) {
    liquidityLevel = 'LOW';
  }

  // Slippage: mirrors deriveSlippageRisk heuristic
  const slippageLevel: RiskLevel = liquidityLevel;

  return {
    mevExposureLevel,
    churnLevel,
    liquidityLevel,
    slippageLevel,
    mlConfidence: 1.0,
    source: 'heuristic',
  };
}
