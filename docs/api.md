# API (Option 1) — OpenAPI Contracts + Examples

## Overview
SwapPilot API provides comparable quotes with explainability.

Base path: `/v1`

## OpenAPI (concept)
This repo will maintain an OpenAPI 3.0 spec matching the runtime API. The spec must:
- include request/response schemas
- include error schemas
- include examples

## Endpoints

### `POST /v1/quotes`
Returns ranked quotes plus a `receiptId`.

#### Request schema (concept)
- `chainId` (number) — BNB Chain = 56
- `sellToken` (string)
- `buyToken` (string)
- `sellAmount` (string) — integer base units
- `slippageBps` (number) — 0..5000
- `account` (string, optional) — for deep-link convenience only
- `providers` (string[], optional) — provider ids to enable
- `mode` ("SAFE"|"NORMAL"|"DEGEN", optional) — affects BEQ scoring

#### Response schema (concept)
- `receiptId` (string)
- `bestExecutableQuoteProviderId` (string | null)
- `bestRawOutputProviderId` (string | null)
- `rankedQuotes` (array)
  - `providerId` (string)
  - `sourceType` ("aggregator" | "dex")
  - `capabilities` ({ quote: boolean, buildTx: boolean, deepLink: boolean })
  - `raw` (object)
  - `normalized` (object)
    - `buyAmount` (string)
    - `effectivePrice` (string)
    - `estimatedGasUsd` (string | null)
    - `feesUsd` (string | null)
  - `signals` (object)
    - `sellability` ({ status: "OK"|"UNCERTAIN"|"FAIL", confidence: number, reasons: string[] })
    - `revertRisk` ({ level: "LOW"|"MEDIUM"|"HIGH", reasons: string[] })
    - `mevExposure` ({ level: "LOW"|"MEDIUM"|"HIGH", reasons: string[] })
    - `churn` ({ level: "LOW"|"MEDIUM"|"HIGH", reasons: string[] })
  - `score` (object)
    - `beqScore` (number)
    - `rawOutputRank` (number)
  - `deepLink` (string | null)

#### Example request
```json
{
  "chainId": 56,
  "sellToken": "0x0000000000000000000000000000000000000000",
  "buyToken": "0x0000000000000000000000000000000000000000",
  "sellAmount": "1000000000000000000",
  "slippageBps": 100,
  "mode": "NORMAL"
}
```

#### Example response (shape only)
```json
{
  "receiptId": "rcpt_...",
  "bestExecutableQuoteProviderId": "pancakeswap",
  "bestRawOutputProviderId": "pancakeswap",
  "rankedQuotes": []
}
```

### `GET /v1/receipts/:id`
Returns the explainability payload for a `receiptId`.

#### Response schema (concept)
- `id` (string)
- `createdAt` (string)
- `request` (sanitized request)
- `adapterResults` (summary per provider)
- `normalization` (inputs, assumptions)
- `ranking` (why BEQ picked provider X)
- `warnings` (array)

## Validation
- Zod for request/response schemas.
- Reject invalid addresses, amounts, slippage.

## Rate limiting
- Apply IP-based limiter at API.
- Also cap adapter fan-out concurrency.
