import type { PreflightResult } from '@swappilot/shared';

import type { RpcSimulationResult } from './types';

export function mergeQuorumResults(
  results: RpcSimulationResult[], 
  expectedBuyAmount?: string
): PreflightResult {
  if (results.length === 0) {
    return {
      ok: true,
      pRevert: 0.5,
      confidence: 0,
      reasons: ['no_rpcs_configured'],
    };
  }

  const failCount = results.filter((r) => !r.ok).length;
  const n = results.length;

  const pRevert = failCount / n;
  const agreement = Math.max(failCount, n - failCount) / n;

  const ok = pRevert < 0.5;

  const reasons: string[] = [];
  if (failCount === 0) reasons.push('quorum_all_ok');
  else if (failCount === n) reasons.push('quorum_all_failed');
  else reasons.push('quorum_mixed');

  for (const r of results) {
    for (const reason of r.reasons) {
      reasons.push(`${r.rpcUrl}:${reason}`);
    }
  }

  // Aggregate simulated outputs from all results
  const simulatedOutputs = results
    .map(r => r.simulatedOutput)
    .filter((s): s is string => s !== undefined);

  // Use the most common simulated output (or first one if all different)
  let simulatedOutput: string | undefined;
  let outputMismatchRatio: number | undefined;

  if (simulatedOutputs.length > 0) {
    // Take the median value for robustness
    const outputValues = simulatedOutputs.map(s => BigInt(s)).sort((a, b) => 
      a < b ? -1 : a > b ? 1 : 0
    );
    const medianIdx = Math.floor(outputValues.length / 2);
    simulatedOutput = outputValues[medianIdx]!.toString();
    
    // Calculate mismatch ratio if we have expected amount
    if (expectedBuyAmount && simulatedOutput) {
      const expected = BigInt(expectedBuyAmount);
      const simulated = BigInt(simulatedOutput);
      
      if (expected > 0n) {
        // Ratio of simulated/expected (1.0 = perfect match, <1 = less than promised)
        outputMismatchRatio = Number((simulated * 10000n) / expected) / 10000;
        
        // Add reason about the mismatch
        if (outputMismatchRatio < 0.95) {
          reasons.push(`output_mismatch:simulated=${simulatedOutput}:expected=${expectedBuyAmount}:ratio=${outputMismatchRatio.toFixed(4)}`);
        } else if (outputMismatchRatio >= 0.95 && outputMismatchRatio <= 1.05) {
          reasons.push('output_match:within_5%');
        } else if (outputMismatchRatio > 1.05) {
          reasons.push(`output_higher:simulated=${simulatedOutput}:expected=${expectedBuyAmount}:ratio=${outputMismatchRatio.toFixed(4)}`);
        }
      }
    }
  }

  const result: PreflightResult = {
    ok,
    pRevert,
    confidence: agreement,
    reasons,
  };

  if (simulatedOutput !== undefined) {
    result.simulatedOutput = simulatedOutput;
  }
  
  if (outputMismatchRatio !== undefined) {
    result.outputMismatchRatio = outputMismatchRatio;
  }

  return result;
}
