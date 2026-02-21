export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type MLPrediction = {
  mevExposureLevel: RiskLevel;
  churnLevel: RiskLevel;
  liquidityLevel: RiskLevel;
  slippageLevel: RiskLevel;
  /** Calibrated confidence (0–1). 1.0 for heuristic fallback. */
  mlConfidence: number;
  source: 'ml' | 'heuristic';
  modelVersion?: string;
};

export type MLFeatures = {
  pRevert: number;
  preflightConfidence: number;
  outputMismatchRatio: number;
  sellabilityIsOk: number;   // 1 | 0
  sellabilityIsFail: number; // 1 | 0
  sellabilityConfidence: number;
  hashditRiskLevel: number;  // -1..5, -1 when absent
  liquidityUsd: number;      // 0 when unknown
  integrationConfidence: number;
  estimatedGas: number;      // 0 when null
  sourceTypeIsDex: number;   // 1 | 0
};

export type MLEngineConfig = {
  enabled: boolean;
  modelsPath: string;
  inferenceTimeoutMs: number;
  modelVersion: string;
};

export type MLEngine = {
  predict(features: MLFeatures): Promise<MLPrediction>;
};
