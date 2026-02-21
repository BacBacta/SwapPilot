/**
 * ONNX inference — gracefully absent until real models are trained (≥1 000 swaps FL).
 * Uses dynamic import so the package compiles even without onnxruntime-node installed.
 */
import type { MLEngineConfig, MLFeatures, MLPrediction, RiskLevel } from './types';

function levelFromLogits(logits: Float32Array): RiskLevel {
  // Assumes 3-class output: [LOW, MEDIUM, HIGH]
  let maxIdx = 0;
  for (let i = 1; i < logits.length; i++) {
    if ((logits[i] ?? 0) > (logits[maxIdx] ?? 0)) maxIdx = i;
  }
  if (maxIdx === 0) return 'LOW';
  if (maxIdx === 1) return 'MEDIUM';
  return 'HIGH';
}

function softmaxMax(logits: Float32Array): number {
  const max = Math.max(...Array.from(logits));
  const exps = Array.from(logits).map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return (exps[Array.from(logits).indexOf(Math.max(...Array.from(logits)))] ?? 0) / sum;
}

export async function tryOnnxInference(
  features: MLFeatures,
  config: MLEngineConfig,
  signal: AbortSignal,
): Promise<MLPrediction | null> {
  // Dynamic import — fails gracefully if onnxruntime-node not installed
  let ort: typeof import('onnxruntime-node') | null = null;
  try {
    ort = await import('onnxruntime-node');
  } catch {
    return null;
  }

  const modelPath = `${config.modelsPath}/risk_classifier_${config.modelVersion}.onnx`;

  let session: import('onnxruntime-node').InferenceSession;
  try {
    session = await ort.InferenceSession.create(modelPath);
  } catch {
    return null; // Model file not found — use fallback
  }

  if (signal.aborted) return null;

  const featureArray = new Float32Array([
    features.pRevert,
    features.preflightConfidence,
    features.outputMismatchRatio,
    features.sellabilityIsOk,
    features.sellabilityIsFail,
    features.sellabilityConfidence,
    features.hashditRiskLevel,
    features.liquidityUsd,
    features.integrationConfidence,
    features.estimatedGas,
    features.sourceTypeIsDex,
  ]);

  const tensor = new ort.Tensor('float32', featureArray, [1, featureArray.length]);
  const feeds: Record<string, import('onnxruntime-node').Tensor> = { input: tensor };
  const results = await session.run(feeds);

  const mevLogits = results['mev_logits']?.data as Float32Array | undefined;
  const churnLogits = results['churn_logits']?.data as Float32Array | undefined;
  const liquidityLogits = results['liquidity_logits']?.data as Float32Array | undefined;
  const slippageLogits = results['slippage_logits']?.data as Float32Array | undefined;
  const confidenceData = results['confidence']?.data as Float32Array | undefined;

  if (!mevLogits || !churnLogits || !liquidityLogits || !slippageLogits) return null;

  return {
    mevExposureLevel: levelFromLogits(mevLogits),
    churnLevel: levelFromLogits(churnLogits),
    liquidityLevel: levelFromLogits(liquidityLogits),
    slippageLevel: levelFromLogits(slippageLogits),
    mlConfidence: confidenceData?.[0] ?? softmaxMax(mevLogits),
    source: 'ml',
    modelVersion: config.modelVersion,
  };
}
