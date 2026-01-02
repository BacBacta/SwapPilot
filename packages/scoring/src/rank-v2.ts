/**
 * BEQ v2 Ranking System
 * 
 * A transparent and traceable ranking system that:
 * 1. Uses normalized 0-100 scores for human readability
 * 2. Exposes all scoring components for auditability
 * 3. Provides clear explanations for each quote's ranking
 */

import type { NormalizationAssumptions, QuoteMode, RankedQuote, ScoringOptions } from '@swappilot/shared';
import type { ProviderMeta } from '@swappilot/adapters';

import { computeBeqScoreV2, type BeqV2Output } from './beq-v2';

export type RankV2Result = {
  /** The provider ID of the BEQ winner (highest score, not disqualified) */
  beqRecommendedProviderId: string | null;
  /** Quotes sorted by BEQ score (descending) */
  rankedQuotes: RankedQuote[];
  /** Quotes sorted by raw output (descending) */
  bestRawQuotes: RankedQuote[];
  /** Detailed scoring breakdown for each quote */
  scoreDetails: Map<string, BeqV2Output>;
  /** Human-readable explanation of why the winner was selected */
  winnerExplanation: string[];
  /** Summary statistics */
  summary: {
    totalQuotes: number;
    disqualifiedCount: number;
    maxBuyAmount: string;
    scoreRange: { min: number; max: number };
  };
};

export function rankQuotesV2(input: {
  mode: QuoteMode;
  providerMeta: Map<string, ProviderMeta>;
  quotes: RankedQuote[];
  assumptions: NormalizationAssumptions;
  scoringOptions?: ScoringOptions;
  /** Buy token price in USD for gas cost normalization */
  buyTokenPriceUsd?: number | null;
  /** Buy token decimals */
  buyTokenDecimals?: number;
}): RankV2Result {
  // 1. Find the maximum buyAmount for normalization
  const maxBuyAmount = input.quotes.reduce((max, q) => {
    const amt = BigInt(q.raw.buyAmount);
    return amt > max ? amt : max;
  }, 0n);

  // 2. Score all quotes using BEQ v2
  const scoreDetails = new Map<string, BeqV2Output>();
  const scored: { quote: RankedQuote; score: BeqV2Output }[] = [];

  for (const q of input.quotes) {
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
    scored.push({ quote: q, score });
  }

  // 3. Sort by raw output (for bestRawQuotes)
  const bestRawQuotes = [...input.quotes].sort((a, b) => {
    const aAmt = BigInt(a.raw.buyAmount);
    const bAmt = BigInt(b.raw.buyAmount);
    if (aAmt === bAmt) return a.providerId.localeCompare(b.providerId);
    return aAmt > bAmt ? -1 : 1;
  });

  // Assign raw output rank
  for (const [index, quote] of bestRawQuotes.entries()) {
    quote.score.rawOutputRank = index;
  }

  // 4. Sort by BEQ score (descending), tie-break by raw output
  const rankedQuotes = scored
    .filter((s) => !s.score.disqualified)
    .sort((a, b) => {
      // Primary: BEQ score (higher is better)
      if (a.score.beqScore !== b.score.beqScore) {
        return b.score.beqScore - a.score.beqScore;
      }
      // Tie-break: raw output (higher is better)
      const aAmt = BigInt(a.quote.raw.buyAmount);
      const bAmt = BigInt(b.quote.raw.buyAmount);
      if (aAmt !== bAmt) return aAmt > bAmt ? -1 : 1;
      // Final tie-break: provider ID (alphabetical)
      return a.quote.providerId.localeCompare(b.quote.providerId);
    })
    .map((s) => {
      // Update the quote's beqScore with the new normalized score
      s.quote.score.beqScore = s.score.beqScore;
      return s.quote;
    });

  // 5. Determine winner and explanation
  const winner = rankedQuotes[0] ?? null;
  const winnerScore = winner ? scoreDetails.get(winner.providerId) : null;
  
  const winnerExplanation: string[] = [];
  if (winner && winnerScore) {
    winnerExplanation.push(`Winner: ${winner.providerId} with BEQ score ${winnerScore.beqScore.toFixed(1)}/100`);
    winnerExplanation.push(...winnerScore.explanation);
    
    // Compare to runner-up if exists
    if (rankedQuotes.length > 1) {
      const runnerUp = rankedQuotes[1];
      const runnerUpScore = scoreDetails.get(runnerUp.providerId);
      if (runnerUpScore) {
        const diff = winnerScore.beqScore - runnerUpScore.beqScore;
        winnerExplanation.push(`Beats ${runnerUp.providerId} by ${diff.toFixed(1)} points`);
      }
    }
  } else {
    winnerExplanation.push('No eligible quotes found');
  }

  // 6. Calculate summary statistics
  const allScores = scored.filter(s => !s.score.disqualified).map(s => s.score.beqScore);
  const disqualifiedCount = scored.filter(s => s.score.disqualified).length;

  return {
    beqRecommendedProviderId: winner?.providerId ?? null,
    rankedQuotes,
    bestRawQuotes,
    scoreDetails,
    winnerExplanation,
    summary: {
      totalQuotes: input.quotes.length,
      disqualifiedCount,
      maxBuyAmount: maxBuyAmount.toString(),
      scoreRange: {
        min: allScores.length > 0 ? Math.min(...allScores) : 0,
        max: allScores.length > 0 ? Math.max(...allScores) : 0,
      },
    },
  };
}

/**
 * Convert RankV2Result to the legacy format for backward compatibility
 */
export function toLegacyRankResult(result: RankV2Result): {
  beqRecommendedProviderId: string | null;
  rankedQuotes: RankedQuote[];
  bestRawQuotes: RankedQuote[];
  whyWinner: string[];
} {
  return {
    beqRecommendedProviderId: result.beqRecommendedProviderId,
    rankedQuotes: result.rankedQuotes,
    bestRawQuotes: result.bestRawQuotes,
    whyWinner: result.winnerExplanation,
  };
}
