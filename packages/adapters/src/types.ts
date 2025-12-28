import type {
  ProviderCapabilities,
  ProviderQuoteRaw,
  ProviderQuoteNormalized,
  QuoteRequest,
  RiskSignals,
} from '@swappilot/shared';

export type ProviderCategory = 'aggregator' | 'wallet' | 'dex';

export type ProviderMeta = {
  providerId: string;
  displayName: string;
  category: ProviderCategory;
  homepageUrl: string;
  capabilities: ProviderCapabilities;
  integrationConfidence: number; // 0..1 (how complete/reliable the integration is)
  notes: string;
};

export type AdapterQuote = {
  providerId: string;
  sourceType: 'aggregator' | 'dex';
  capabilities: ProviderCapabilities;
  raw: ProviderQuoteRaw;
  normalized: ProviderQuoteNormalized;
  signals: RiskSignals;
  deepLink: string | null;
  warnings: string[];
  isStub: boolean;
};

export type BuiltTx = {
  to: string;
  data: string;
  value: string;
};

export interface Adapter {
  getProviderMeta(): ProviderMeta;
  getCapabilities(): ProviderCapabilities;

  getQuote(request: QuoteRequest): Promise<AdapterQuote>;

  buildTx?(request: QuoteRequest, quote: AdapterQuote): Promise<BuiltTx>;
}
