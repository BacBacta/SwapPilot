export type CachedProviderQuote = {
  providerId: string;
  cachedAt: string;
  raw: {
    sellAmount: string;
    buyAmount: string;
    estimatedGas: number | null;
    feeBps: number | null;
    route?: string[] | undefined;
  };
  normalized: {
    buyAmount: string;
    effectivePrice: string;
    estimatedGasUsd: string | null;
    feesUsd: string | null;
  };
  capabilities: {
    quote: boolean;
    buildTx: boolean;
    deepLink: boolean;
  };
  isStub: boolean;
  warnings: string[];
};

export type QuoteCache = {
  get(key: string): Promise<CachedProviderQuote | null>;
  set(key: string, value: CachedProviderQuote, ttlSeconds: number): Promise<void>;
};

export class NoopQuoteCache implements QuoteCache {
  async get(): Promise<CachedProviderQuote | null> {
    return null;
  }

  async set(): Promise<void> {
    return;
  }
}
