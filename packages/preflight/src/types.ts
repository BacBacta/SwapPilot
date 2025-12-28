export type HexString = `0x${string}`;

export type TxRequest = {
  from?: string;
  to: string;
  data?: HexString;
  value?: HexString;
};

export type RpcConfig = {
  urls: string[];
  quorum: number; // 1..N
  timeoutMs: number;
  enableTrace: boolean;
};

export type RpcSimulationMethod = 'eth_estimateGas' | 'eth_call';

export type RpcSimulationResult = {
  rpcUrl: string;
  ok: boolean;
  methodsTried: RpcSimulationMethod[];
  reasons: string[];
};
