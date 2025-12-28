# API (Option 1) — OpenAPI Contracts + Examples

## Overview
SwapPilot API provides comparable quotes with explainability.

Base path: `/v1`

## Interactive API Docs
Access Swagger UI at **`GET /docs`** (redirects to `/docs/static/index.html`).
OpenAPI 3.0 JSON spec is available at **`GET /docs/json`**.

## Endpoints

### `POST /v1/quotes`
Returns ranked quotes plus a `receiptId`.

#### Request schema
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `chainId` | number | ✔ | 56 = BNB Chain |
| `sellToken` | string | ✔ | checksummed 0x address |
| `buyToken` | string | ✔ | checksummed 0x address |
| `sellAmount` | string | ✔ | integer base units |
| `slippageBps` | number | ✔ | 0–5000 |
| `mode` | enum | ✔ | `"SAFE"` / `"NORMAL"` / `"DEGEN"` |
| `account` | string | ✗ | sender address (optional) |
| `providers` | string[] | ✗ | filter provider ids |

#### Response schema
| Field | Type | Notes |
|-------|------|-------|
| `receiptId` | string | unique explainability id |
| `bestExecutableQuoteProviderId` | string \| null | BEQ winner (has `buildTx`) |
| `bestRawOutputProviderId` | string \| null | highest raw output |
| `rankedQuotes` | array | see RankedQuote schema |

See [schemas.ts](../packages/shared/src/schemas.ts) for full Zod definitions.

#### Example request
```bash
curl -X POST http://localhost:4000/v1/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 56,
    "sellToken": "0x0000000000000000000000000000000000000001",
    "buyToken": "0x0000000000000000000000000000000000000002",
    "sellAmount": "1000000000000000000",
    "slippageBps": 100,
    "mode": "NORMAL"
  }'
```

#### Example response
```json
{
  "receiptId": "rcpt_a1b2c3...",
  "bestExecutableQuoteProviderId": "pancakeswap",
  "bestRawOutputProviderId": "pancakeswap",
  "rankedQuotes": [
    {
      "providerId": "pancakeswap",
      "sourceType": "dex",
      "capabilities": { "quote": true, "buildTx": false, "deepLink": true },
      "raw": { "buyAmount": "999000000000000000" },
      "normalized": {
        "buyAmount": "999000000000000000",
        "effectivePrice": "0.999",
        "estimatedGasUsd": "0.05",
        "feesUsd": null
      },
      "signals": {
        "sellability": { "status": "OK", "confidence": 1, "reasons": [] },
        "revertRisk": { "level": "LOW", "reasons": [] },
        "mevExposure": { "level": "LOW", "reasons": [] },
        "churn": { "level": "LOW", "reasons": [] }
      },
      "score": { "beqScore": 98, "rawOutputRank": 1 },
      "deepLink": "https://pancakeswap.finance/swap?..."
    }
  ]
}
```

### `GET /v1/receipts/:id`
Returns the decision receipt for a given `receiptId`.

#### Response schema
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | same as `receiptId` |
| `createdAt` | string | ISO-8601 |
| `request` | object | sanitized quote request |
| `rankedQuotes` | array | same ranked results |
| `bestExecutableQuoteProviderId` | string \| null | |
| `bestRawOutputProviderId` | string \| null | |

#### Example
```bash
curl http://localhost:4000/v1/receipts/rcpt_a1b2c3...
```

### Error responses
All endpoints return JSON errors with `{ message: string }`.
HTTP status codes:
- **400** — validation failed
- **404** — receipt not found
- **500** — internal error

## Validation
- Zod for request/response schemas.
- Reject invalid addresses, amounts, slippage.

## Rate limiting
- Apply IP-based limiter at API.
- Also cap adapter fan-out concurrency.
