import type { PreflightResult } from '@swappilot/shared';

import type { RpcSimulationResult } from './types';

export function mergeQuorumResults(results: RpcSimulationResult[]): PreflightResult {
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

  return {
    ok,
    pRevert,
    confidence: agreement,
    reasons,
  };
}
