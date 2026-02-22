/**
 * Intent Solver (ADR-007 M2)
 * Converts natural-language swap intents into QuoteRequest via LLM + optional MCP.
 *
 * Invariant: the intent does NOT choose a route, build a tx, or execute anything.
 * It produces a valid QuoteRequest and nothing else.
 *
 * Gate: INTENT_ENABLED=false → 501 Not Implemented (handled in server.ts).
 */

import { QuoteRequestSchema, type QuoteRequest } from '@swappilot/shared';
import type { MCPClient } from './mcpClient';

export type IntentConfig = {
  llmProvider: 'claude' | 'openai';
  llmModel: string;
  anthropicApiKey: string | null;
  openaiApiKey: string | null;
  timeoutMs: number;
};

export type ParseIntentResult = {
  parsedRequest: QuoteRequest;
  confidence: number;
  explanation: string;
  clarifications?: string[];
};

// ──────────────────────────────────────────────────────────────────────────────
// LLM helpers
// ──────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a DeFi swap intent parser for BNB Chain (BSC, chainId 56).
Extract swap parameters from the user message and return ONLY a JSON object with these fields:
{
  "chainId": 56,
  "sellToken": "<ERC-20 address 0x...>",
  "buyToken":  "<ERC-20 address 0x...>",
  "sellAmount": "<integer string in token base units>",
  "slippageBps": <integer 0-5000>,
  "mode": "SAFE" | "NORMAL" | "DEGEN",
  "confidence": <number 0-1>,
  "explanation": "<one sentence>",
  "clarifications": ["<question if ambiguous>"]
}

Rules:
- sellToken / buyToken must be 0x-prefixed 40-char hex addresses. Use well-known BSC addresses:
  WBNB: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
  USDT: 0x55d398326f99059fF775485246999027B3197955
  USDC: 0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d
  BTCB: 0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c
  CAKE: 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82
  ETH:  0x2170Ed0880ac9A755fd29B2688956BD959F933F8
- sellAmount is in base units (e.g. 1 BNB = "1000000000000000000").
- If a token symbol is unknown, add a clarification asking for the contract address; set confidence < 0.5.
- If mode is not specified, use "NORMAL".
- "SAFE" maps to: "keep me safe", "no risk", "conservative".
- "DEGEN" maps to: "best price", "max output", "I don't care about risk".
- Never guess silently. If ambiguous, surface it in clarifications.
- Return ONLY the JSON. No markdown, no prose.`;

type LLMResponse = {
  sellToken?: string;
  buyToken?: string;
  sellAmount?: string;
  slippageBps?: number;
  mode?: string;
  confidence?: number;
  explanation?: string;
  clarifications?: string[];
};

async function callClaude(
  text: string,
  config: IntentConfig,
  signal: AbortSignal,
): Promise<LLMResponse | null> {
  if (!config.anthropicApiKey) {
    console.error('[Intent] ANTHROPIC_API_KEY is missing');
    return null;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.llmModel,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    }),
    signal,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[Intent] Claude API error: ${res.status} ${res.statusText}`, errorText);
    return null;
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const raw = data.content?.[0]?.text?.trim();
  if (!raw) {
    console.warn('[Intent] Claude API returned empty response');
    return null;
  }

  // Strip markdown code fences that Claude sometimes wraps around JSON
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    return JSON.parse(stripped) as LLMResponse;
  } catch (parseErr) {
    console.error('[Intent] Failed to parse Claude response:', stripped.substring(0, 200), parseErr);
    return null;
  }
}

async function callOpenAI(
  text: string,
  config: IntentConfig,
  signal: AbortSignal,
): Promise<LLMResponse | null> {
  if (!config.openaiApiKey) {
    console.error('[Intent] OPENAI_API_KEY is missing');
    return null;
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.openaiApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.llmModel,
      max_tokens: 512,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    }),
    signal,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[Intent] OpenAI API error: ${res.status} ${res.statusText}`, errorText);
    return null;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    console.warn('[Intent] OpenAI API returned empty response');
    return null;
  }

  try {
    return JSON.parse(raw) as LLMResponse;
  } catch (parseErr) {
    console.error('[Intent] Failed to parse OpenAI response:', raw.substring(0, 200), parseErr);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// MCP token resolution
// ──────────────────────────────────────────────────────────────────────────────

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

async function resolveToken(
  value: string,
  chainId: number,
  mcp: MCPClient | null,
): Promise<{ address: string; clarification?: string }> {
  if (ADDRESS_RE.test(value)) return { address: value };

  if (!mcp) {
    return {
      address: '',
      clarification: `Unknown token "${value}". Please provide the contract address.`,
    };
  }

  const info = await mcp.getTokenInfo(value, chainId);
  if (!info) {
    return {
      address: '',
      clarification: `Could not resolve token "${value}". Please provide the contract address.`,
    };
  }

  return { address: info.address };
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

export async function parseIntent(
  text: string,
  config: IntentConfig,
  mcp: MCPClient | null = null,
): Promise<ParseIntentResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    // 1. Call LLM
    const raw =
      config.llmProvider === 'claude'
        ? await callClaude(text, config, controller.signal)
        : await callOpenAI(text, config, controller.signal);

    if (!raw) {
      throw new Error('llm_unavailable');
    }

    // 2. Resolve tokens (MCP if available)
    const chainId = 56;
    const clarifications: string[] = [...(raw.clarifications ?? [])];

    const sellResolved = await resolveToken(raw.sellToken ?? '', chainId, mcp);
    const buyResolved = await resolveToken(raw.buyToken ?? '', chainId, mcp);

    if (sellResolved.clarification) clarifications.push(sellResolved.clarification);
    if (buyResolved.clarification) clarifications.push(buyResolved.clarification);

    // 3. Build candidate QuoteRequest
    const candidate = {
      chainId,
      sellToken: sellResolved.address,
      buyToken: buyResolved.address,
      sellAmount: raw.sellAmount ?? '0',
      slippageBps: raw.slippageBps ?? 100,
      mode: raw.mode ?? 'NORMAL',
    };

    // 4. Strict Zod validation — rejects if any required field is missing/invalid
    const parsed = QuoteRequestSchema.strict().parse(candidate);

    return {
      parsedRequest: parsed,
      confidence: raw.confidence ?? 0.8,
      explanation: raw.explanation ?? 'Intent parsed successfully.',
      ...(clarifications.length > 0 && { clarifications }),
    };
  } finally {
    clearTimeout(timer);
  }
}
