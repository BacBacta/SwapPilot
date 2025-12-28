import type { PreflightResult } from '@swappilot/shared';

import { RpcClient } from './rpcClient';
import type { RpcConfig, RpcSimulationResult, TxRequest } from './types';
import { mergeQuorumResults } from './quorum';

function toRpcTx(tx: TxRequest): Record<string, string> {
  return {
    ...(tx.from ? { from: tx.from } : {}),
    to: tx.to,
    ...(tx.data ? { data: tx.data } : {}),
    ...(tx.value ? { value: tx.value } : {}),
  };
}

async function simulateOnce(params: { rpcUrl: string; timeoutMs: number; tx: TxRequest }): Promise<RpcSimulationResult> {
  const client = new RpcClient(params.rpcUrl, params.timeoutMs);
  const methodsTried: RpcSimulationResult['methodsTried'] = [];
  const reasons: string[] = [];

  const rpcTx = toRpcTx(params.tx);

  // eth_estimateGas is a cheap revert signal (not perfect, but useful).
  try {
    methodsTried.push('eth_estimateGas');
    await client.estimateGas(rpcTx);
  } catch (e) {
    reasons.push(`estimateGas_error:${(e as Error).message}`);
  }

  // eth_call (safe) can also surface reverts.
  try {
    methodsTried.push('eth_call');
    await client.call(rpcTx);
  } catch (e) {
    reasons.push(`call_error:${(e as Error).message}`);
  }

  const ok = reasons.length === 0;
  return { rpcUrl: params.rpcUrl, ok, methodsTried, reasons };
}

export type PreflightClient = {
  verify(tx: TxRequest): Promise<PreflightResult>;
};

export function createPreflightClient(config: RpcConfig): PreflightClient {
  return {
    async verify(tx: TxRequest): Promise<PreflightResult> {
      if (!config.urls || config.urls.length === 0) {
        return { ok: true, pRevert: 0.5, confidence: 0, reasons: ['rpc_not_configured'] };
      }

      const urls = config.urls.slice(0, Math.max(1, Math.min(config.quorum, config.urls.length)));
      const results: RpcSimulationResult[] = [];

      for (const rpcUrl of urls) {
        results.push(await simulateOnce({ rpcUrl, timeoutMs: config.timeoutMs, tx }));
      }

      return mergeQuorumResults(results);
    },
  };
}
