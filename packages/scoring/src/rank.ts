import type { BeqV2Details, NormalizationAssumptions, QuoteMode, RankedQuote, ScoringOptions } from '@swappilot/shared';

import type { ProviderMeta } from '@swappilot/adapters';

import { computeBeqScoreV2, type BeqV2Output } from './beq-v2';
import type { WhyRule } from './types';

export type RankResult = {
  beqRecommendedProviderId: string | null;
  rankedQuotes: RankedQuote[];
  bestRawQuotes: RankedQuote[];
  whyWinner: WhyRule[];
  /** BEQ v2: Detailed score breakdown for each provider */
  scoreDetails?: Map<string, BeqV2Output>;
};

export function rankQuotes(input: {
  mode: QuoteMode;
  providerMeta: Map<string, ProviderMeta>;
  quotes: RankedQuote[];
  assumptions: NormalizationAssumptions;
  scoringOptions?: ScoringOptions;
  /** Buy token price in USD for gas cost normalization */
  buyTokenPriceUsd?: number | null;
  /** Buy token decimals */
  buyTokenDecimals?: number;
}): RankResult {
  // Find the maximum buyAmount for relative scoring
  const maxBuyAmount = input.quotes.reduce((max, q) => {
    const amt = BigInt(q.raw.buyAmount);
    return amt > max ? amt : max;
  }, 0n);

  // Score all quotes using BEQ v2 (normalized 0-100 scale)
  const scoreDetails = new Map<string, BeqV2Output>();
  const scored = input.quotes.map((q) => {
    const meta = input.providerMeta.get(q.providerId);
    // Default to 0.9 for unknown providers (reasonable assumption, not punitive)
    const integrationConfidence = meta?.integrationConfidence ?? 0.9;

    const buyAmount = BigInt(q.raw.buyAmount);
    const score = computeBeqScoreV2({
      providerId: q.providerId,
      buyAmount,
      maxBuyAmount,
      feeBps: q.raw.feeBps,
      integrationConfidence,
      signals: q.signals,
      mode: input.mode,
      scoringOptions: input.scoringOptions,
      estimatedGasUsd: q.normalized.estimatedGasUsd,
      buyTokenPriceUsd: input.buyTokenPriceUsd,
      buyTokenDecimals: input.buyTokenDecimals ?? 18,
    });

    scoreDetails.set(q.providerId, score);
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

  // Helper to build v2Details without undefined properties (for exactOptionalPropertyTypes)
  const buildV2Details = (score: BeqV2Output): BeqV2Details => {
    const details: BeqV2Details = {
      beqScore: score.beqScore,
      disqualified: score.disqualified,
      components: score.components,
      explanation: score.explanation,
      rawData: score.rawData,
    };
    if (score.disqualifiedReason !== undefined) {
      details.disqualifiedReason = score.disqualifiedReason;
    }
    return details;
  };

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
      // Attach BEQ v2 details for transparency
      s.quote.score.v2Details = buildV2Details(s.score);
      return s.quote;
    });

  // Also attach v2Details to bestRawQuotes
  for (const q of bestRawQuotes) {
    const details = scoreDetails.get(q.providerId);
    if (details) {
      q.score.v2Details = buildV2Details(details);
    }
  }

  const winner = rankedQuotes[0] ?? null;
  const winnerScore = winner ? scoreDetails.get(winner.providerId) : null;

  // Build whyWinner from BEQ v2 explanation
  const whyWinner: WhyRule[] = ['ranked_by_beq'];
  if (winnerScore) {
    // Add BEQ v2 explanation as WhyRule entries
    for (const exp of winnerScore.explanation) {
      whyWinner.push(exp as WhyRule);
    }
  }

  return {
    beqRecommendedProviderId: winner?.providerId ?? null,
    rankedQuotes,
    bestRawQuotes,
    whyWinner,
    scoreDetails,
  };
}
