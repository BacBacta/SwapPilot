# SwapPilot — Implementation Instructions (MANDATORY)

This document is mandatory.

Do not write code until you have:
1) Created this file in the repo root as `instructions.md`
2) Created the required docs listed in `docs/README.md`
3) Read all docs in `docs/` and acknowledged constraints in your plan

## Documentation required “before any implementation”
The following documents must exist (and be read in the order defined in `docs/README.md`) before any implementation work begins:

- `docs/README.md` (index des docs, ordre de lecture)
- `docs/architecture.md` (Option 1 & Option 2 architecture, diagrams, modules)
- `docs/providers.md` (providers list, capabilities, integration method, rate limits, deep-links)
- `docs/pancakeswap.md` (DEX integration plan: deep-link + on-chain quote approach + limitations)
- `docs/scoring.md` (BEQ formula + mode rules SAFE/NORMAL/DEGEN)
- `docs/api.md` (OpenAPI endpoint contracts + example payloads)
- `docs/security.md` (threat model: SSRF, key leakage, malicious tokens, logs redaction)
- `docs/adr/0001-monorepo.md` (decisions)
- `docs/adr/0002-scoring.md` (decisions)

## 0) Project Goal
Build SwapPilot, a BNB Chain meta-aggregation hub:
- Option 1: Compare multiple aggregators + DEX direct quotes, normalize, score (BEQ), explain (receipt), and deep-link to the chosen provider/DEX. No swap execution inside SwapPilot.
- Option 2 (later): Add transaction building (non-custodial) and execution orchestration.

Primary success metric (Option 1): comparability + explainability, not “best raw price”.

## 1) Non-Negotiable Principles
- Always show “Best Executable Quote (BEQ)” AND “Best Raw Output” as separate views.
- Never claim guarantees for sellability; use OK / UNCERTAIN / FAIL with confidence.
- Normalization is core: do not ship “price comparison” without a Normalizer + Receipt.
- Keep providers behind adapters with strict interfaces and timeouts.
- UI must surface confidence, revert risk, MEV exposure, churn, and sellability.
- Option 1 must remain non-custodial and non-executing (deep-link only).

## 2) Repository Standards
- Monorepo: pnpm workspaces + Turborepo
- TypeScript strict everywhere
- Lint: ESLint; Format: Prettier; Commits: Conventional Commits
- Tests: Vitest for unit tests; minimal integration tests for API endpoints
- Validation: Zod for all external inputs/outputs
- Logging: structured logs (pino) with requestId/providerId; redact secrets
- Observability: OpenTelemetry scaffolding (at least traces in API), Prometheus metrics endpoints (later ok)

## 3) Security & Compliance Baselines
- No API keys or secrets in frontend.
- Rate limit API; protect adapters from SSRF (domain allowlist).
- No web scraping of provider UIs. Use official APIs or deep-link only.
- All RPC endpoints must be configurable via env; support RPC quorum where relevant.
- Never log private data, wallet addresses, or full tx calldata unless explicitly allowed and redacted.

## 4) Architecture Constraints
- All providers must implement `Adapter` interface with capabilities:
  - quote: boolean
  - buildTx: boolean
  - deepLink: boolean
- PancakeSwap must be implemented as a DEX direct quote source (Option 1):
  - Provide deep-link to PancakeSwap swap page
  - Provide quote via on-chain calls if feasible (v2 via router getAmountsOut; v3 via quoter if available), otherwise deep-link only with clear capability flags.
- Option 1 API should return:
  - rankedQuotes[] with normalized numbers, risk signals, confidence, and deepLink
  - receiptId retrievable via GET /v1/receipts/:id

## 5) Implementation Workflow
- Work in small commits, each passing lint/typecheck/tests.
- Each sprint prompt must end with:
  - Verification checklist (commands)
  - Commit list
- If provider APIs are uncertain:
  - Implement stubs with clear TODO + capability flags
  - Do not block the entire release on a single provider

## 6) Required Commands
- Install: `pnpm i`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Build: `pnpm build`
- Dev: `pnpm dev` (web + api)

## 7) Definition of Done (Option 1)
- /swap UI works end-to-end with real API calls (even if some providers are stubs)
- /v1/quotes returns comparable normalized results with receipts
- Deep-links work for all enabled providers/DEXes
- Receipts provide explainability (why BEQ chose provider X)
- CI green on main branch
