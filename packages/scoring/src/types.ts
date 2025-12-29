import type { QuoteMode, RiskSignals, ScoringOptions } from '@swappilot/shared';

export type ScoringComponents = {
  netOut: bigint;
  reliability: number; // 0..1
  sellFactor: number; // 0..1
  riskPenalty: number; // 0..1
};

export type WhyRule =
  | 'beq_formula'
  | 'mode_safe_excludes_fail_sellability'
  | 'mode_safe_excludes_preflight_fail'
  | 'sellability_ok'
  | 'sellability_uncertain'
  | 'sellability_fail'
  | 'sellability_check_disabled'
  | 'preflight_ok'
  | 'preflight_failed'
  | 'risk_low'
  | 'risk_medium'
  | 'risk_high'
  | 'mev_scoring_disabled'
  | 'integration_confidence'
  | 'deep_link_only'
  | 'ranked_by_beq'
  | 'ranked_by_raw_output';

export type ScoreInput = {
  providerId: string;
  buyAmount: bigint;
  feeBps: number | null;
  integrationConfidence: number; // 0..1
  signals: RiskSignals;
  mode: QuoteMode;
  scoringOptions?: ScoringOptions | undefined;
};

export type ScoreOutput = {
  providerId: string;
  beqScore: number;
  components: ScoringComponents;
  disqualified: boolean;
  why: WhyRule[];
};
