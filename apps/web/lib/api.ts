import {
  DecisionReceiptSchema,
  QuoteRequestSchema,
  QuoteResponseSchema,
  type DecisionReceipt,
  type QuoteRequest,
  type QuoteResponse,
  type RankedQuote,
} from '@swappilot/shared';
import { bestExecutable } from './mock';

// Production API URL
const PRODUCTION_API_URL = 'https://swappilot-api.fly.dev';

// Check if we should use mock data (explicitly enabled only)
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

function getApiBaseUrl(): string {
  // Use environment variable if set, otherwise use production URL in prod, localhost in dev
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 
    (process.env.NODE_ENV === 'production' ? PRODUCTION_API_URL : 'http://localhost:3001');
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export type ApiError = {
  kind: 'timeout' | 'http' | 'network' | 'invalid_response';
  message: string;
  status?: number;
};

async function fetchJsonWithTimeout(input: string, init: RequestInit & { timeoutMs: number }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs);

  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    const text = await res.text();
    const json = text.length ? (JSON.parse(text) as unknown) : null;

    return { res, json };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw { kind: 'timeout', message: 'Request timed out' } satisfies ApiError;
    }
    throw { kind: 'network', message: err instanceof Error ? err.message : 'Network error' } satisfies ApiError;
  } finally {
    clearTimeout(timeout);
  }
}

// Generate mock quote response for demo mode
function generateMockQuoteResponse(request: QuoteRequest): QuoteResponse {
  const sellAmount = BigInt(request.sellAmount);
  const mockRankedQuotes: RankedQuote[] = bestExecutable.map((row, index) => {
    // Calculate buy amount based on mock data ratios
    const ratio = row.outUsd / 13975; // Normalize against first quote
    const buyAmount = (sellAmount * BigInt(Math.floor(ratio * 1000))) / 1000n;
    
    return {
      providerId: row.provider,
      sourceType: 'aggregator' as const,
      capabilities: {
        quote: true,
        buildTx: true,
        deepLink: true,
      },
      raw: {
        sellAmount: request.sellAmount,
        buyAmount: buyAmount.toString(),
        estimatedGas: 250000,
        feeBps: 30,
        route: [request.sellToken, request.buyToken],
      },
      normalized: {
        buyAmount: buyAmount.toString(),
        effectivePrice: (Number(buyAmount) / Number(sellAmount)).toFixed(18),
        estimatedGasUsd: "0.36",
        feesUsd: "0.05",
      },
      signals: {
        sellability: {
          status: row.flags.includes('SELL_OK') ? 'OK' as const : 'UNCERTAIN' as const,
          confidence: row.confidence / 100,
          reasons: [],
        },
        revertRisk: {
          level: 'LOW' as const,
          reasons: [],
        },
        mevExposure: {
          level: row.flags.includes('MEV') ? 'HIGH' as const : 'LOW' as const,
          reasons: row.flags.includes('MEV') ? ['Potential sandwich attack'] : [],
        },
        churn: {
          level: 'LOW' as const,
          reasons: [],
        },
      },
      score: {
        beqScore: row.confidence,
        rawOutputRank: index + 1,
      },
      deepLink: null,
    };
  });

  return {
    receiptId: `mock-${Date.now()}`,
    bestExecutableQuoteProviderId: mockRankedQuotes[0]?.providerId ?? null,
    bestRawOutputProviderId: mockRankedQuotes[0]?.providerId ?? null,
    beqRecommendedProviderId: mockRankedQuotes[0]?.providerId ?? null,
    rankedQuotes: mockRankedQuotes,
    bestRawQuotes: mockRankedQuotes.slice(0, 3),
  };
}

export async function postQuotes(params: {
  request: QuoteRequest;
  timeoutMs?: number;
}): Promise<QuoteResponse> {
  const validated = QuoteRequestSchema.parse(params.request);

  // Use mock data if no API is configured
  if (USE_MOCK) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
    console.log('[API] Using mock data (no NEXT_PUBLIC_API_URL configured)');
    return generateMockQuoteResponse(validated);
  }

  const timeoutMs = params.timeoutMs ?? 12_000;
  const baseUrl = getApiBaseUrl();

  const { res, json } = await fetchJsonWithTimeout(`${baseUrl}/v1/quotes`, {
    method: 'POST',
    body: JSON.stringify(validated),
    timeoutMs,
  });

  if (!res.ok) {
    const message =
      typeof json === 'object' && json && 'message' in json && typeof (json as any).message === 'string'
        ? (json as any).message
        : `HTTP ${res.status}`;

    throw { kind: 'http', message, status: res.status } satisfies ApiError;
  }

  try {
    return QuoteResponseSchema.parse(json);
  } catch {
    throw { kind: 'invalid_response', message: 'Invalid response from API' } satisfies ApiError;
  }
}

export async function getReceipt(params: { id: string; timeoutMs?: number }): Promise<DecisionReceipt> {
  const timeoutMs = params.timeoutMs ?? 12_000;
  const baseUrl = getApiBaseUrl();

  const { res, json } = await fetchJsonWithTimeout(`${baseUrl}/v1/receipts/${encodeURIComponent(params.id)}`, {
    method: 'GET',
    timeoutMs,
    headers: {},
  });

  if (!res.ok) {
    const message =
      typeof json === 'object' && json && 'message' in json && typeof (json as any).message === 'string'
        ? (json as any).message
        : `HTTP ${res.status}`;

    throw { kind: 'http', message, status: res.status } satisfies ApiError;
  }

  try {
    return DecisionReceiptSchema.parse(json);
  } catch {
    throw { kind: 'invalid_response', message: 'Invalid receipt response from API' } satisfies ApiError;
  }
}
