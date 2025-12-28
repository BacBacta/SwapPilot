import type { PreflightResult, QuoteRequest, RankedQuote, RiskSignals } from '@swappilot/shared';

export type TokenClassification = 'KNOWN' | 'MEME' | 'UNKNOWN';

export type RiskConfig = {
  knownTokens: string[];
  memeTokens: string[];
};

export type RiskInput = {
  request: QuoteRequest;
  quote: RankedQuote;
  preflight: PreflightResult;
};

export type RiskEngine = {
  assess(input: RiskInput): RiskSignals;
  classifyToken(params: { chainId: number; token: string }): TokenClassification;
};
