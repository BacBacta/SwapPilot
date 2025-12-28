import type { QuoteMode, RiskSignals } from '@swappilot/shared';

export type ScoringComponents = {
  netOut: bigint;
  reliability: number; // 0..1
  sellFactor: number; // 0..1
  riskPenalty: number; // 0..1
};

export type WhyRule =
  | 'beq_formula'
  | 'mode_safe_excludes_fail_sellability'
  | 'sellability_ok'
  | 'sellability_uncertain'
  | 'sellability_fail'
  | 'risk_low'
  | 'risk_medium'
  | 'risk_high'
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
};

export type ScoreOutput = {
  providerId: string;
  beqScore: number;
  components: ScoringComponents;
  disqualified: boolean;
  why: WhyRule[];
};
