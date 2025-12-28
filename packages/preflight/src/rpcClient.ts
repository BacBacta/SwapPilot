import { setTimeout as delay } from 'node:timers/promises';

import type { HexString } from './types';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: unknown[];
};

type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

type JsonRpcResponse<T> =
  | { jsonrpc: '2.0'; id: number; result: T }
  | { jsonrpc: '2.0'; id: number; error: JsonRpcError };

export class RpcClient {
  private static nextId = 1;

  constructor(
    private readonly rpcUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async request<T>(method: string, params: unknown[]): Promise<T> {
    const id = RpcClient.nextId++;
    const body: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

    const controller = new AbortController();
    const timeout = delay(this.timeoutMs).then(() => controller.abort());

    try {
      const res = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const json = (await res.json()) as JsonRpcResponse<T>;
      if ('error' in json) {
        throw new Error(`${method}: ${json.error.message}`);
      }
      return json.result;
    } finally {
      // Best-effort cleanup; delay promise is only used to trigger abort.
      void timeout;
    }
  }

  async estimateGas(tx: unknown): Promise<HexString> {
    return this.request<HexString>('eth_estimateGas', [tx]);
  }

  async call(tx: unknown): Promise<HexString> {
    return this.request<HexString>('eth_call', [tx, 'latest']);
  }
}
