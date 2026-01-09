# Architecture (Option 1 & Option 2)

## High-level
SwapPilot is a **meta-aggregation hub** for BNB Chain.

- Inputs: user intent (chainId, sellToken, buyToken, amount, slippage), optional wallet address for deep-link only.
- Sources:
  - Aggregators (official quote APIs) behind strict adapters.
  - DEX direct sources (PancakeSwap) behind an adapter.
- Core: **Normalization** + **Receipt** + **BEQ scoring**.
- Output: ranked quotes + deep-link. **No transaction execution** in SwapPilot (Option 1).

Option 2 (later): build transactions and orchestrate execution in a non-custodial way.

## Monorepo layout (target)
- `apps/web`: UI (Swap page)
- `apps/api`: API server exposing `/v1/quotes` and `/v1/receipts/:id`
- `packages/core`: domain logic (adapters interface, normalizer, scoring, receipts)
- `packages/config`: shared lint/tsconfig

## Modules
- `Adapter` layer: provider-specific IO, timeouts, domain allowlist, Zod schemas
- `Normalization`: convert provider outputs to comparable values
- `Signals`: sellability, revert risk, MEV exposure, churn (+ confidence)
- `Scoring`: BEQ + Best Raw Output selection (mode SAFE/NORMAL/DEGEN)
- `Receipt store`: generate and persist explainability artifacts
- `API`: orchestration, rate limiting, requestId, observability
- `Web`: swap UX (BEQ vs Raw, risk surfaced)

## Diagrams (text)

### Option 1 sequence
User -> Web (/swap) -> API (/v1/quotes)
API -> Adapters (fan-out, timeout, validate)
Adapters -> API (raw quotes)
API -> Normalizer -> Signals -> Scoring
API -> Receipt store (create receiptId)
API -> Web (rankedQuotes + selections + receiptId)
Web -> API (/v1/receipts/:id) (explainability)
Web -> Provider/DEX (deep-link)

### Option 2 (later) extension
API -> Adapter.buildTx (when supported)
API -> Execution Orchestrator (simulation, protection, retries)
User signs via wallet; SwapPilot never holds keys.

## Data flow
1. UI calls API `/v1/quotes`.
2. API fan-outs to enabled adapters with timeouts and concurrency limits.
3. Adapter results are validated (Zod) and converted into a common `RawQuote`.
4. Normalizer computes comparable values and risk/confidence signals.
5. Ranker produces:
   - `bestExecutableQuote` (BEQ)
   - `bestRawOutput`
6. API creates a receipt (explainability artifact) and returns `receiptId`.

## Non-negotiable UX
- UI must show BEQ and Best Raw Output as distinct.
- UI must surface: confidence, revert risk, MEV exposure, churn, sellability.
- SAFE mode note: quotes missing preflight simulation data are disqualified from BEQ ranking.

## Web UI flows (Option 1)

### Swap page (`/swap`)
The `/swap` UI is a thin client over the API (no keys, no on-chain calls).

- Inputs:
  - From/To token addresses (manual input + simple presets)
  - Amount (base units string)
  - Mode selector: SAFE / NORMAL / DEGEN
  - Settings drawer: slippage bps + optional account address (used for deep-link only)
- Provider enable/disable panel:
  - User toggles provider ids to include in a quote request
  - Mapped to `POST /v1/quotes` request body `providers` field
- Results:
  - Two views:
    - BEQ ranking: `rankedQuotes`
    - Best Raw Output: `bestRawQuotes`
  - Provider cards show:
    - out + minOut (computed from slippage)
    - gas estimate (when available)
    - confidence/uncertainty (from signals)
    - sellability, MEV, churn, revert risk
    - capability badges (quote/buildTx/deepLink)
  - “Open in Provider” opens the `deepLink` in a new tab
- Receipt:
  - After quotes, UI can fetch and render `GET /v1/receipts/:id`
  - Receipt drawer includes JSON export for debugging and explainability

### Resilience & error states
- Timeouts and network errors are displayed as a top-level error banner.
- Partial availability is handled per-provider:
  - Deep-link-only providers are clearly labeled (`capabilities.quote=false`).
  - Providers with `buyAmount="0"` are shown as “quote unavailable” but still allow deep-link.
- UI never claims guarantees: it surfaces confidence and uncertainty.

## Timeouts & resilience
- Each adapter must have strict per-request timeouts.
- All external calls must be validated and sanitized.
- Degrade gracefully: stubs are allowed with capability flags.
