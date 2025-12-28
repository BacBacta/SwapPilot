import type { QuoteRequest } from '@swappilot/shared';

import type { ProviderMeta } from './types';

export const PROVIDERS: ProviderMeta[] = [
  {
    providerId: 'binance-wallet',
    displayName: 'Binance Wallet',
    category: 'wallet',
    homepageUrl: 'https://www.binance.com/en/web3wallet',
    capabilities: { quote: true, buildTx: false, deepLink: true },
    integrationConfidence: 0.2,
    notes: 'Deep-link first. API integration not implemented yet (stub quote).',
  },
  {
    providerId: 'okx-dex',
    displayName: 'OKX DEX',
    category: 'aggregator',
    homepageUrl: 'https://www.okx.com/web3/dex',
    capabilities: { quote: true, buildTx: false, deepLink: true },
    integrationConfidence: 0.2,
    notes: 'Deep-link first. API integration not implemented yet (stub quote).',
  },
  {
    providerId: '1inch',
    displayName: '1inch',
    category: 'aggregator',
    homepageUrl: 'https://app.1inch.io',
    capabilities: { quote: true, buildTx: false, deepLink: true },
    integrationConfidence: 0.25,
    notes: 'Deep-link first. 1inch quote API integration not implemented yet (stub quote).',
  },
  {
    providerId: 'liquidmesh',
    displayName: 'LiquidMesh',
    category: 'aggregator',
    homepageUrl: 'https://liquidmesh.com',
    capabilities: { quote: true, buildTx: false, deepLink: true },
    integrationConfidence: 0.1,
    notes: 'Deep-link generic. Quote/buildTx APIs unknown/unsupported currently (stub quote).',
  },
  {
    providerId: 'kyberswap',
    displayName: 'KyberSwap',
    category: 'aggregator',
    homepageUrl: 'https://kyberswap.com',
    capabilities: { quote: true, buildTx: false, deepLink: true },
    integrationConfidence: 0.25,
    notes: 'Deep-link first. Quote API integration not implemented yet (stub quote).',
  },
  {
    providerId: 'metamask',
    displayName: 'MetaMask',
    category: 'wallet',
    homepageUrl: 'https://portfolio.metamask.io',
    capabilities: { quote: true, buildTx: false, deepLink: true },
    integrationConfidence: 0.15,
    notes: 'Deep-link first. Swap routing is handled by MetaMask; integration is stub-only.',
  },
  {
    providerId: 'pancakeswap',
    displayName: 'PancakeSwap',
    category: 'dex',
    homepageUrl: 'https://pancakeswap.finance/swap',
    capabilities: { quote: false, buildTx: false, deepLink: true },
    integrationConfidence: 0.6,
    notes: 'DEX deep-link implemented. On-chain quoting not implemented yet => quote=false.',
  },
];

export function listProviders(): ProviderMeta[] {
  return PROVIDERS;
}

export function getProviderById(providerId: string): ProviderMeta | undefined {
  return PROVIDERS.find((p) => p.providerId === providerId);
}

export function getEnabledProviders(request: Pick<QuoteRequest, 'providers'>): ProviderMeta[] {
  const filter = request.providers;
  if (!filter || filter.length === 0) return PROVIDERS;
  const set = new Set(filter);
  return PROVIDERS.filter((p) => set.has(p.providerId));
}
