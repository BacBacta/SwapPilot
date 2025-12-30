import type { QuoteRequest } from '@swappilot/shared';

import type { DeepLinkResult } from './types';

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

function baseSwapQuery(request: QuoteRequest): string {
  const params = new URLSearchParams();
  params.set('chainId', String(request.chainId));
  params.set('sellToken', request.sellToken);
  params.set('buyToken', request.buyToken);
  params.set('sellAmount', request.sellAmount);
  if (request.account) params.set('account', request.account);
  if (request.slippageBps !== undefined) params.set('slippageBps', String(request.slippageBps));
  if (request.mode) params.set('mode', request.mode);
  return params.toString();
}

export function deepLinkBuilder(providerId: string, request: QuoteRequest): DeepLinkResult {
  const query = baseSwapQuery(request);

  switch (providerId) {
    case 'pancakeswap': {
      // Minimal, stable deep-link to swap page with token params.
      const url = `https://pancakeswap.finance/swap?inputCurrency=${encode(request.sellToken)}&outputCurrency=${encode(request.buyToken)}`;
      return { url, fallbackUrl: 'https://pancakeswap.finance/swap', confidence: 0.9 };
    }

    case '1inch': {
      // Generic deep-link (exact path may vary by app version).
      const url = `https://app.1inch.io/#/${encode(String(request.chainId))}/simple/swap/${encode(request.sellToken)}/${encode(request.buyToken)}?amount=${encode(request.sellAmount)}`;
      return { url, fallbackUrl: 'https://app.1inch.io', confidence: 0.6 };
    }

    case 'kyberswap': {
      const url = `https://kyberswap.com/swap?${query}`;
      return { url, fallbackUrl: 'https://kyberswap.com/swap', confidence: 0.5 };
    }

    case 'okx-dex': {
      const url = `https://www.okx.com/web3/dex?${query}`;
      return { url, fallbackUrl: 'https://www.okx.com/web3/dex', confidence: 0.5 };
    }

    case 'binance-wallet': {
      const url = `https://www.binance.com/en/web3wallet?${query}`;
      return { url, fallbackUrl: 'https://www.binance.com/en/web3wallet', confidence: 0.4 };
    }

    case 'metamask': {
      const url = `https://portfolio.metamask.io/swap?${query}`;
      return { url, fallbackUrl: 'https://portfolio.metamask.io/swap', confidence: 0.4 };
    }

    case 'liquidmesh': {
      const url = `https://liquidmesh.com/?${query}`;
      return { url, fallbackUrl: 'https://liquidmesh.com', confidence: 0.2 };
    }

    case 'odos': {
      const url = `https://app.odos.xyz/?chain=${encode(String(request.chainId))}&inputToken=${encode(request.sellToken)}&outputToken=${encode(request.buyToken)}&inputAmount=${encode(request.sellAmount)}`;
      return { url, fallbackUrl: 'https://app.odos.xyz', confidence: 0.8 };
    }

    case 'openocean': {
      const chainNames: Record<number, string> = { 1: 'eth', 56: 'bsc', 137: 'polygon', 42161: 'arbitrum' };
      const chain = chainNames[request.chainId] ?? 'bsc';
      const url = `https://openocean.finance/swap/${chain}/${encode(request.sellToken)}/${encode(request.buyToken)}`;
      return { url, fallbackUrl: 'https://openocean.finance', confidence: 0.7 };
    }

    case '0x': {
      const url = `https://matcha.xyz/trade?${query}`;
      return { url, fallbackUrl: 'https://matcha.xyz', confidence: 0.8 };
    }

    case 'uniswap-v3': {
      const url = `https://app.uniswap.org/swap?chain=bnb&inputCurrency=${encode(request.sellToken)}&outputCurrency=${encode(request.buyToken)}&exactAmount=${encode(request.sellAmount)}&exactField=input`;
      return { url, fallbackUrl: 'https://app.uniswap.org', confidence: 0.85 };
    }

    case 'paraswap': {
      const url = `https://app.paraswap.io/?network=bsc#/${encode(request.sellToken)}-${encode(request.buyToken)}/${encode(request.sellAmount)}`;
      return { url, fallbackUrl: 'https://app.paraswap.io', confidence: 0.7 };
    }

    default: {
      // Safe default: include request params as opaque query.
      return {
        url: `https://example.com/swap?providerId=${encode(providerId)}&${query}`,
        fallbackUrl: 'https://example.com',
        confidence: clamp01(0.1),
      };
    }
  }
}
