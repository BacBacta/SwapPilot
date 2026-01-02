import type { PreflightResult } from '@swappilot/shared';

import { RpcClient } from './rpcClient';
import type { HexString, RpcConfig, RpcSimulationResult, TxRequest } from './types';
import { mergeQuorumResults } from './quorum';

// Known router addresses for decode logic
const KNOWN_ROUTERS: Record<string, 'pancakeswap-v2' | 'uniswap-v2' | 'uniswap-v3'> = {
  // PancakeSwap V2 Router on BSC
  '0x10ed43c718714eb63d5aa57b78b54704e256024e': 'pancakeswap-v2',
  // Uniswap V2 Router on Ethereum
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'uniswap-v2',
};

// ERC20 balanceOf function selector
const BALANCE_OF_SELECTOR = '0x70a08231';

function toRpcTx(tx: TxRequest): Record<string, string> {
  return {
    ...(tx.from ? { from: tx.from } : {}),
    to: tx.to,
    ...(tx.data ? { data: tx.data } : {}),
    ...(tx.value ? { value: tx.value } : {}),
  };
}

/**
 * Decode swap output from router return data.
 * Most swap functions return amounts[] array where the last element is the output.
 */
function decodeSwapOutput(returnData: HexString, routerType: string): string | null {
  try {
    // Remove 0x prefix
    const data = returnData.slice(2);
    
    // Standard Uniswap V2 style: returns uint256[] amounts
    // The ABI encoding is: offset (32 bytes) + length (32 bytes) + amounts...
    if (data.length < 128) return null; // At least offset + length + 2 amounts
    
    // Get array length (at offset 32 bytes = 64 hex chars)
    const lengthHex = data.slice(64, 128);
    const length = parseInt(lengthHex, 16);
    
    if (length < 2) return null;
    
    // Last element is at: 128 + (length-1) * 64
    const lastElementOffset = 128 + (length - 1) * 64;
    const outputHex = data.slice(lastElementOffset, lastElementOffset + 64);
    
    if (!outputHex || outputHex.length !== 64) return null;
    
    // Convert to decimal string
    const output = BigInt('0x' + outputHex);
    return output.toString();
  } catch {
    return null;
  }
}

/**
 * Build a balanceOf call for an ERC20 token
 */
function buildBalanceOfCall(token: string, account: string): Record<string, string> {
  // Pad address to 32 bytes (remove 0x, pad to 64 chars)
  const paddedAddress = account.toLowerCase().replace('0x', '').padStart(64, '0');
  return {
    to: token,
    data: `${BALANCE_OF_SELECTOR}${paddedAddress}` as HexString,
  };
}

/**
 * Decode balance from ERC20 balanceOf return
 */
function decodeBalance(returnData: HexString): string | null {
  try {
    const data = returnData.slice(2);
    if (data.length !== 64) return null;
    return BigInt('0x' + data).toString();
  } catch {
    return null;
  }
}

async function simulateOnce(params: { 
  rpcUrl: string; 
  timeoutMs: number; 
  tx: TxRequest;
}): Promise<RpcSimulationResult> {
  const client = new RpcClient(params.rpcUrl, params.timeoutMs);
  const methodsTried: RpcSimulationResult['methodsTried'] = [];
  const reasons: string[] = [];
  let callReturnData: HexString | undefined;
  let simulatedOutput: string | undefined;

  const rpcTx = toRpcTx(params.tx);

  // eth_estimateGas is a cheap revert signal (not perfect, but useful).
  try {
    methodsTried.push('eth_estimateGas');
    await client.estimateGas(rpcTx);
  } catch (e) {
    reasons.push(`estimateGas_error:${(e as Error).message}`);
  }

  // eth_call (safe) can also surface reverts and capture return data.
  try {
    methodsTried.push('eth_call');
    callReturnData = await client.call(rpcTx);
    
    // Try to decode the output if this is a known router
    const routerAddress = params.tx.to.toLowerCase();
    const routerType = KNOWN_ROUTERS[routerAddress];
    
    if (routerType && callReturnData && callReturnData !== '0x') {
      const decoded = decodeSwapOutput(callReturnData, routerType);
      if (decoded) {
        simulatedOutput = decoded;
        reasons.push(`decoded_output:${decoded}`);
      }
    }
  } catch (e) {
    reasons.push(`call_error:${(e as Error).message}`);
  }

  // If we couldn't decode from return data and have buy token info,
  // try balance-based simulation using state override
  if (!simulatedOutput && params.tx.buyToken && params.tx.from) {
    try {
      methodsTried.push('eth_call_balance');
      
      // Get balance before (current state)
      const balanceCall = buildBalanceOfCall(params.tx.buyToken, params.tx.from);
      const balanceBeforeHex = await client.call(balanceCall);
      const balanceBefore = decodeBalance(balanceBeforeHex);
      
      if (balanceBefore !== null) {
        // Simulate the swap and get balance after using state override
        // Note: This is a simplified approach - full state override would be more accurate
        // For now, we use the call return data or estimate based on current reserves
        reasons.push(`balance_before:${balanceBefore}`);
      }
    } catch (e) {
      reasons.push(`balance_check_error:${(e as Error).message}`);
    }
  }

  const ok = reasons.filter(r => r.includes('error:')).length === 0;
  
  return { 
    rpcUrl: params.rpcUrl, 
    ok, 
    methodsTried, 
    reasons,
    callReturnData,
    simulatedOutput,
  };
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

      const merged = mergeQuorumResults(results, tx.expectedBuyAmount);
      return merged;
    },
  };
}
