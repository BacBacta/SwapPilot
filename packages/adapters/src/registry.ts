import type { QuoteRequest } from '@swappilot/shared';

import type { ProviderMeta } from './types';

export const PROVIDERS: ProviderMeta[] = [
  {
    providerId: 'binance-wallet',
    displayName: 'Binance Wallet',
    category: 'wallet',
    homepageUrl: 'https://www.binance.com/en/web3wallet',
    capabilities: { quote: false, buildTx: false, deepLink: true },
    integrationConfidence: 0.2,
    notes: 'Deep-link only. Opens Binance Wallet app for swap execution.',
  },
  {
    providerId: 'okx-dex',
    displayName: 'OKX DEX',
    category: 'aggregator',
    homepageUrl: 'https://www.okx.com/web3/dex',
    capabilities: { quote: true, buildTx: true, deepLink: true },
    integrationConfidence: 0.85,
    notes: 'OKX DEX Aggregator API integration. Requires API credentials.',
  },
  {
    providerId: '1inch',
    displayName: '1inch',
    category: 'aggregator',
    homepageUrl: 'https://app.1inch.io',
    capabilities: { quote: true, buildTx: true, deepLink: true },
    integrationConfidence: 0.85,
    notes: '1inch Swap API v6.0 integration. Requires API key.',
  },
  {
    providerId: 'odos',
    displayName: 'Odos',
    category: 'aggregator',
    homepageUrl: 'https://app.odos.xyz',
    capabilities: { quote: true, buildTx: true, deepLink: true },
    integrationConfidence: 0.9,
    notes: 'Odos Smart Order Router - optimized multi-path routing. Free API.',
  },
  {
    providerId: 'openocean',
    displayName: 'OpenOcean',
    category: 'aggregator',
    homepageUrl: 'https://openocean.finance',
    capabilities: { quote: true, buildTx: true, deepLink: true },
    integrationConfidence: 0.85,
    notes: 'OpenOcean DEX Aggregator - cross-chain routing. Free API.',
  },
  {
    providerId: '0x',
    displayName: '0x',
    category: 'aggregator',
    homepageUrl: 'https://0x.org',
    capabilities: { quote: true, buildTx: true, deepLink: true },
    integrationConfidence: 0.95,
    notes: '0x Swap API - professional grade liquidity aggregation. Requires API key.',
  },
  {
    providerId: 'liquidmesh',
    displayName: 'LiquidMesh',
    category: 'aggregator',
    homepageUrl: 'https://liquidmesh.com',
    capabilities: { quote: false, buildTx: false, deepLink: true },
    integrationConfidence: 0.1,
    notes: 'Deep-link only. No public quote API available.',
  },
  {
    providerId: 'kyberswap',
    displayName: 'KyberSwap',
    category: 'aggregator',
    homepageUrl: 'https://kyberswap.com',
    capabilities: { quote: true, buildTx: true, deepLink: true },
    integrationConfidence: 0.85,
    notes: 'KyberSwap Aggregator API. No API key required.',
  },
  {
    providerId: 'paraswap',
    displayName: 'ParaSwap',
    category: 'aggregator',
    homepageUrl: 'https://www.paraswap.io',
    capabilities: { quote: true, buildTx: true, deepLink: true },
    integrationConfidence: 0.85,
    notes: 'ParaSwap API v5 integration. No API key required.',
  },
  {
    providerId: 'metamask',
    displayName: 'MetaMask',
    category: 'wallet',
    homepageUrl: 'https://portfolio.metamask.io',
    capabilities: { quote: false, buildTx: false, deepLink: true },
    integrationConfidence: 0.15,
    notes: 'Deep-link only. Opens MetaMask Portfolio for swap execution.',
  },
  {
    providerId: 'pancakeswap',
    displayName: 'PancakeSwap',
    category: 'dex',
    homepageUrl: 'https://pancakeswap.finance/swap',
    capabilities: { quote: true, buildTx: false, deepLink: true },
    integrationConfidence: 0.9,
    notes: 'PancakeSwap V2 on-chain quote via Router.getAmountsOut.',
  },
  {
    providerId: 'uniswap-v3',
    displayName: 'Uniswap V3',
    category: 'dex',
    homepageUrl: 'https://app.uniswap.org',
    capabilities: { quote: true, buildTx: false, deepLink: true },
    integrationConfidence: 0.75,
    notes: 'Uniswap V3 on-chain quote via Quoter. Tries multiple fee tiers.',
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
