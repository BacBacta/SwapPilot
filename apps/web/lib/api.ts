import {
  DecisionReceiptSchema,
  QuoteRequestSchema,
  QuoteResponseSchema,
  type DecisionReceipt,
  type QuoteRequest,
  type QuoteResponse,
} from '@swappilot/shared';

function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
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

export async function postQuotes(params: {
  request: QuoteRequest;
  timeoutMs?: number;
}): Promise<QuoteResponse> {
  const timeoutMs = params.timeoutMs ?? 12_000;
  const baseUrl = getApiBaseUrl();

  const validated = QuoteRequestSchema.parse(params.request);

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
