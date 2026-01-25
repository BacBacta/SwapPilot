export type SwapLogStatus = 'success' | 'failed';

export type SwapLog = {
  chainId: number;
  txHash: string;
  wallet: string;
  providerId?: string;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  amountUsd?: string | null;
  timestamp: string;
  status: SwapLogStatus;
  source?: 'app' | 'api' | 'relayer';
};

export type SwapLogQuery = {
  from?: Date;
  to?: Date;
  chainId?: number;
  status?: SwapLogStatus;
};

export type SwapLogStore = {
  append(log: SwapLog): Promise<void>;
  list(query?: SwapLogQuery): Promise<SwapLog[]>;
};

export class MemorySwapLogStore implements SwapLogStore {
  private readonly logs: SwapLog[] = [];

  async append(log: SwapLog): Promise<void> {
    this.logs.push(log);
  }

  async list(query?: SwapLogQuery): Promise<SwapLog[]> {
    const fromMs = query?.from?.getTime();
    const toMs = query?.to?.getTime();
    return this.logs.filter((log) => {
      if (query?.chainId && log.chainId !== query.chainId) return false;
      if (query?.status && log.status !== query.status) return false;
      const ts = Date.parse(log.timestamp);
      if (Number.isNaN(ts)) return false;
      if (fromMs && ts < fromMs) return false;
      if (toMs && ts > toMs) return false;
      return true;
    });
  }
}
