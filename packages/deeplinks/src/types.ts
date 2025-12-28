import type { QuoteRequest } from '@swappilot/shared';

export type DeepLinkResult = {
  url: string;
  fallbackUrl: string;
  confidence: number; // 0..1
};

export type DeepLinkBuilder = (providerId: string, request: QuoteRequest) => DeepLinkResult;
