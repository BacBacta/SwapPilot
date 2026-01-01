import type { NormalizationAssumptions, QuoteMode, RankedQuote, ScoringOptions } from '@swappilot/shared';

import type { ProviderMeta } from '@swappilot/adapters';

import { computeBeqScore } from './beq';
import type { WhyRule } from './types';

export type RankResult = {
  beqRecommendedProviderId: string | null;
  rankedQuotes: RankedQuote[];
  bestRawQuotes: RankedQuote[];
  whyWinner: WhyRule[];
};

export function rankQuotes(input: {
  mode: QuoteMode;
  providerMeta: Map<string, ProviderMeta>;
  quotes: RankedQuote[];
  assumptions: NormalizationAssumptions;
  scoringOptions?: ScoringOptions;
}): RankResult {
  // Find the maximum buyAmount to use as a normalization reference
  // This ensures all quotes are scaled by the same factor for fair comparison
  const maxBuyAmount = input.quotes.reduce((max, q) => {
    const amt = BigInt(q.raw.buyAmount);
    return amt > max ? amt : max;
  }, 0n);
  
  // Calculate a common scale factor based on the largest buyAmount
  // This ensures all quotes are compared on the same scale
  const maxDigits = maxBuyAmount > 0n ? maxBuyAmount.toString().length : 1;
  const commonScaleFactor = Math.max(0, maxDigits - 12);

  const scored = input.quotes.map((q) => {
    const meta = input.providerMeta.get(q.providerId);
    // If provider meta is missing, don't catastrophically penalize the quote.
    // Missing meta should be treated as "unknown" rather than "bad", otherwise
    // BEQ can incorrectly prefer a lower-output provider purely due to defaulting.
    const integrationConfidence = meta?.integrationConfidence ?? 1;

    const buyAmount = BigInt(q.raw.buyAmount);
    const score = computeBeqScore({
      providerId: q.providerId,
      buyAmount,
      feeBps: q.raw.feeBps,
      integrationConfidence,
      signals: q.signals,
      mode: input.mode,
      scoringOptions: input.scoringOptions,
      scaleFactor: commonScaleFactor, // Pass common scale factor
    });

    return { quote: q, score };
  });

  // Best raw output list (descending buyAmount).
  const bestRawQuotes = [...input.quotes].sort((a, b) => {
    const aAmt = BigInt(a.raw.buyAmount);
    const bAmt = BigInt(b.raw.buyAmount);
    if (aAmt === bAmt) return a.providerId.localeCompare(b.providerId);
    return aAmt > bAmt ? -1 : 1;
  });

  for (const [index, quote] of bestRawQuotes.entries()) {
    quote.score.rawOutputRank = index;
  }

  // BEQ ranking: sort by beqScore, tie-break by raw output.
  const rankedQuotes = scored
    .filter((s) => !s.score.disqualified)
    .sort((a, b) => {
      if (a.score.beqScore !== b.score.beqScore) return b.score.beqScore - a.score.beqScore;
      const aAmt = BigInt(a.quote.raw.buyAmount);
      const bAmt = BigInt(b.quote.raw.buyAmount);
      if (aAmt === bAmt) return a.quote.providerId.localeCompare(b.quote.providerId);
      return aAmt > bAmt ? -1 : 1;
    })
    .map((s) => {
      s.quote.score.beqScore = s.score.beqScore;
      return s.quote;
    });

  const winner = rankedQuotes[0] ?? null;

  const whyWinner: WhyRule[] = winner
    ? ['ranked_by_beq', ...scored.find((s) => s.quote.providerId === winner.providerId)!.score.why]
    : ['ranked_by_beq'];

  return {
    beqRecommendedProviderId: winner?.providerId ?? null,
    rankedQuotes,
    bestRawQuotes,
    whyWinner,
  };
}
