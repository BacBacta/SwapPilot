/**
 * ML Engine (ADR-007 M1)
 * Gate: ML_ENABLED=false → heuristic fallback, bit-for-bit identical to pre-M1.
 */
import type { RiskSignals } from '@swappilot/shared';

import { heuristicFallback } from './fallback';
import { buildFeatureVector, type FeatureInput } from './features';
import { tryOnnxInference } from './inference';
import { MLCache } from './cache';
import type { MLEngineConfig, MLEngine, MLPrediction } from './types';

export type { MLEngineConfig, MLEngine, MLPrediction } from './types';

export type MLEnrichInput = FeatureInput;

function applyPrediction(signals: RiskSignals, pred: MLPrediction): RiskSignals {
  return {
    ...signals,
    mevExposure: {
      level: pred.mevExposureLevel,
      reasons: [`ml:source:${pred.source}`, `ml:confidence:${pred.mlConfidence.toFixed(2)}`],
    },
    churn: {
      level: pred.churnLevel,
      reasons: [`ml:source:${pred.source}`],
    },
    liquidity: {
      level: pred.liquidityLevel,
      reasons: [
        ...(signals.liquidity?.reasons ?? []),
        `ml:source:${pred.source}`,
      ],
    },
    slippage: {
      level: pred.slippageLevel,
      reasons: [
        ...(signals.slippage?.reasons ?? []),
        `ml:source:${pred.source}`,
      ],
    },
    ml: {
      enabled: true,
      modelVersion: pred.modelVersion,
      confidence: pred.mlConfidence,
      source: pred.source,
    },
  };
}

export function createMLEngine(config: MLEngineConfig): MLEngine & {
  enrich(input: MLEnrichInput & { signals: RiskSignals }): Promise<RiskSignals>;
} {
  const cache = new MLCache<MLPrediction>(1000, 30_000);

  const engine: MLEngine & {
    enrich(input: MLEnrichInput & { signals: RiskSignals }): Promise<RiskSignals>;
  } = {
    async predict(features) {
      if (!config.enabled) {
        return heuristicFallback(features);
      }

      const cacheKey = JSON.stringify(features);
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.inferenceTimeoutMs);

      try {
        const result = await tryOnnxInference(features, config, controller.signal);
        const pred = result ?? heuristicFallback(features);
        cache.set(cacheKey, pred);
        return pred;
      } catch {
        return heuristicFallback(features);
      } finally {
        clearTimeout(timer);
      }
    },

    async enrich(input) {
      if (!config.enabled) {
        // Pass-through: no ml metadata added, behaviour unchanged
        return {
          ...input.signals,
          ml: { enabled: false },
        };
      }

      const features = buildFeatureVector(input);
      const pred = await engine.predict(features);
      return applyPrediction(input.signals, pred);
    },
  };

  return engine;
}
