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
  const scored = input.quotes.map((q) => {
    const meta = input.providerMeta.get(q.providerId);
    const integrationConfidence = meta?.integrationConfidence ?? 0.1;

    const buyAmount = BigInt(q.raw.buyAmount);
    const score = computeBeqScore({
      providerId: q.providerId,
      buyAmount,
      feeBps: q.raw.feeBps,
      integrationConfidence,
      signals: q.signals,
      mode: input.mode,
      scoringOptions: input.scoringOptions,
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
