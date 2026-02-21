export type SwapLogStatus = 'success' | 'failed';

export type SwapLog = {
  chainId: number;
  txHash: string;
  wallet: string;
  providerId?: string | undefined;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  expectedBuyAmount?: string | undefined;
  beqRecommendedProviderId?: string | undefined;
  amountUsd?: string | null | undefined;
  timestamp: string;
  status: SwapLogStatus;
  source?: 'app' | 'api' | 'relayer' | undefined;
  // FL fields — populated after on-chain confirmation
  actualSlippage?: number | undefined;
  gasUsdActual?: string | undefined;
  beqScore?: number | undefined;
};

export type SwapLogQuery = {
  from?: Date | undefined;
  to?: Date | undefined;
  chainId?: number | undefined;
  status?: SwapLogStatus | undefined;
  wallet?: string | undefined;
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
      if (query?.wallet && log.wallet.toLowerCase() !== query.wallet.toLowerCase()) return false;
      const ts = Date.parse(log.timestamp);
      if (Number.isNaN(ts)) return false;
      if (fromMs && ts < fromMs) return false;
      if (toMs && ts > toMs) return false;
      return true;
    });
  }
}
