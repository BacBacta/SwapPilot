import crypto from 'node:crypto';
import type { RiskSignals } from '@swappilot/shared';

type HashditConfig = {
  enabled: boolean;
  appId: string;
  appSecret: string;
  baseUrl: string;
  timeoutMs: number;
  cacheTtlMs: number;
};

type CacheEntry = { expiresAt: number; value: RiskSignals['sellability'] };

const cache = new Map<string, CacheEntry>();

function riskLevelToSellability(level: number): RiskSignals['sellability'] {
  if (level >= 5) {
    return { status: 'FAIL', confidence: 0.95, reasons: ['hashdit:honeypot'] };
  }
  if (level === 4) {
    return { status: 'FAIL', confidence: 0.85, reasons: ['hashdit:high_risk'] };
  }
  if (level === 3) {
    return { status: 'UNCERTAIN', confidence: 0.75, reasons: ['hashdit:medium_risk'] };
  }
  if (level === 2) {
    return { status: 'UNCERTAIN', confidence: 0.50, reasons: ['hashdit:low_medium_risk'] };
  }
  return { status: 'OK', confidence: 0.90, reasons: ['hashdit:ok'] };
}

function extractRiskLevel(json: unknown): number | null {
  if (typeof json !== 'object' || json === null) return null;
  const data = (json as Record<string, unknown>).data;
  if (typeof data !== 'object' || data === null) return null;
  const level = (data as Record<string, unknown>).risk_level;
  if (typeof level === 'number' && Number.isFinite(level)) return level;
  if (typeof level === 'string') {
    const n = Number(level);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function assessHashditSellability({
  chainId,
  token,
  config,
}: {
  chainId: number;
  token: string;
  config: HashditConfig;
}): Promise<RiskSignals['sellability'] | null> {
  if (!config.enabled || !config.appId || !config.appSecret) return null;

  const key = `hashdit:${chainId}:${token.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const body = JSON.stringify({ address: token, chain_id: String(chainId) });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(8).toString('hex');
  const signature = crypto
    .createHmac('sha256', config.appSecret)
    .update(config.appId + timestamp + nonce + body)
    .digest('hex');

  let json: unknown;
  try {
    const response = await fetch(`${config.baseUrl}/security-api/public/app/v1/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature-appid': config.appId,
        'X-Signature-timestamp': timestamp,
        'X-Signature-nonce': nonce,
        'X-Signature-signature': signature,
      },
      body,
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) return null;
    json = await response.json();
  } catch {
    return null;
  }

  const riskLevel = extractRiskLevel(json);
  if (riskLevel === null) return null;

  const result = riskLevelToSellability(riskLevel);
  cache.set(key, { expiresAt: Date.now() + config.cacheTtlMs, value: result });
  return result;
}
