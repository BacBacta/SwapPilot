import type { PreflightResult, RiskSignals } from '@swappilot/shared';

import type { RiskConfig, RiskEngine, RiskInput, TokenClassification } from './types';

import { getProtocolRiskLevels } from './protocolRisk';

function normalizeAddress(addr: string): string {
  return addr.toLowerCase();
}

function inSet(addr: string, list: string[]): boolean {
  const a = normalizeAddress(addr);
  return list.some((x) => normalizeAddress(x) === a);
}

function riskLevelFromPreflight(preflight: PreflightResult): { level: 'LOW' | 'MEDIUM' | 'HIGH'; reasons: string[] } {
  const reasons = [`preflight:pRevert:${preflight.pRevert.toFixed(2)}`, `preflight:confidence:${preflight.confidence.toFixed(2)}`];
  if (!preflight.ok || preflight.pRevert >= 0.6) return { level: 'HIGH', reasons };
  if (preflight.pRevert >= 0.2) return { level: 'MEDIUM', reasons };
  return { level: 'LOW', reasons };
}

function sellabilityFrom(params: {
  classification: TokenClassification;
  preflight: PreflightResult;
  isDeepLinkOnly: boolean;
}): RiskSignals['sellability'] {
  if (params.isDeepLinkOnly) {
    return { status: 'UNCERTAIN', confidence: 0.9, reasons: ['deep_link_only_quote_not_available'] };
  }

  const cls = params.classification;

  // Memecoin toxicity: treat UNKNOWN/MEME as risky and rely on preflight.
  if (cls === 'MEME' || cls === 'UNKNOWN') {
    if (!params.preflight.ok || params.preflight.pRevert >= 0.5) {
      return {
        status: 'FAIL',
        confidence: Math.max(0.6, params.preflight.confidence),
        reasons: [
          cls === 'MEME' ? 'token_class:meme' : 'token_class:unknown',
          'sell_like_simulation_revert_or_high_pRevert',
        ],
      };
    }

    return {
      status: 'UNCERTAIN',
      confidence: 0.3 + 0.4 * params.preflight.confidence,
      reasons: [cls === 'MEME' ? 'token_class:meme' : 'token_class:unknown', 'insufficient_evidence_for_ok'],
    };
  }

  // KNOWN token
  if (params.preflight.ok && params.preflight.confidence >= 0.6 && params.preflight.pRevert < 0.2) {
    return { status: 'OK', confidence: 0.8, reasons: ['token_class:known', 'preflight_good'] };
  }

  return { status: 'UNCERTAIN', confidence: 0.5, reasons: ['token_class:known', 'preflight_uncertain'] };
}

function maxLevel(a: 'LOW' | 'MEDIUM' | 'HIGH', b: 'LOW' | 'MEDIUM' | 'HIGH'): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (a === 'HIGH' || b === 'HIGH') return 'HIGH';
  if (a === 'MEDIUM' || b === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
}

function protocolRiskFrom(params: { providerId: string; isDeepLinkOnly: boolean }): RiskSignals['protocolRisk'] {
  const base = getProtocolRiskLevels(params.providerId);

  const operations = params.isDeepLinkOnly ? maxLevel(base.operations, 'MEDIUM') : base.operations;
  const technology = params.isDeepLinkOnly ? maxLevel(base.technology, 'MEDIUM') : base.technology;

  return {
    security: { level: base.security, reasons: [`protocol_registry:${params.providerId}`] },
    compliance: { level: base.compliance, reasons: [`protocol_registry:${params.providerId}`] },
    financial: { level: base.financial, reasons: [`protocol_registry:${params.providerId}`] },
    technology: {
      level: technology,
      reasons: [`protocol_registry:${params.providerId}`, ...(params.isDeepLinkOnly ? ['protocol:deeplink_only'] : [])],
    },
    operations: {
      level: operations,
      reasons: [`protocol_registry:${params.providerId}`, ...(params.isDeepLinkOnly ? ['protocol:deeplink_only'] : [])],
    },
    governance: { level: base.governance, reasons: [`protocol_registry:${params.providerId}`] },
  };
}

export function createRiskEngine(config: RiskConfig): RiskEngine {
  return {
    classifyToken({ token }): TokenClassification {
      if (inSet(token, config.knownTokens)) return 'KNOWN';
      if (inSet(token, config.memeTokens)) return 'MEME';
      return 'UNKNOWN';
    },

    assess(input: RiskInput): RiskSignals {
      const classification = this.classifyToken({ chainId: input.request.chainId, token: input.request.buyToken });
      const isDeepLinkOnly = input.quote.capabilities.quote === false;

      const sellability = sellabilityFrom({ classification, preflight: input.preflight, isDeepLinkOnly });
      const revertRisk = riskLevelFromPreflight(input.preflight);

      // Placeholders: documented heuristics.
      const mevExposure: RiskSignals['mevExposure'] = {
        level: input.quote.sourceType === 'dex' ? 'HIGH' : 'MEDIUM',
        reasons: ['heuristic_placeholder'],
      };

      const churn: RiskSignals['churn'] = {
        level: 'MEDIUM',
        reasons: ['heuristic_placeholder'],
      };

      const liquidity: RiskSignals['liquidity'] = {
        level: 'MEDIUM',
        reasons: ['heuristic_placeholder'],
      };

      const slippage: RiskSignals['slippage'] = {
        level: 'MEDIUM',
        reasons: ['heuristic_placeholder'],
      };
      const protocolRisk = protocolRiskFrom({ providerId: input.quote.providerId, isDeepLinkOnly });

      return {
        sellability,
        revertRisk,
        mevExposure,
        churn,
        liquidity,
        slippage,
        protocolRisk,
        preflight: input.preflight,
      };
    },
  };
}
