export type HexString = `0x${string}`;

export type TxRequest = {
  from?: string;
  to: string;
  data?: HexString;
  value?: HexString;
  // Expected buy amount from the quote (for comparison with simulated output)
  expectedBuyAmount?: string;
  // Buy token address (for balance simulation)
  buyToken?: string;
};

export type RpcConfig = {
  urls: string[];
  quorum: number; // 1..N
  timeoutMs: number;
  enableTrace: boolean;
};

export type RpcSimulationMethod = 'eth_estimateGas' | 'eth_call' | 'eth_call_balance';

export type RpcSimulationResult = {
  rpcUrl: string;
  ok: boolean;
  methodsTried: RpcSimulationMethod[];
  reasons: string[];
  // Raw return data from eth_call (when available)
  callReturnData?: HexString | undefined;
  // Simulated output amount (decoded from return data or balance diff)
  simulatedOutput?: string | undefined;
};
