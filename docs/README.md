# SwapPilot — Documentation

These documents are **required** by `instructions.md` and must exist **before any implementation work**.

## Reading order (mandatory)
1. `docs/architecture.md`
2. `docs/providers.md`
3. `docs/pancakeswap.md`
4. `docs/scoring.md`
5. `docs/api.md`
6. `docs/security.md`
7. `docs/adr/0001-monorepo.md`
8. `docs/adr/0002-scoring.md`

## Acknowledgment checklist (must be completed before implementation)
- [ ] Option 1 is non-custodial and non-executing (deep-link only)
- [ ] BEQ and Best Raw Output are always separate views
- [ ] Sellability is never guaranteed; only OK/UNCERTAIN/FAIL with confidence
- [ ] All providers are behind strict adapters with timeouts + domain allowlist
- [ ] Zod validates all external inputs/outputs
- [ ] Logs are structured and redact sensitive data

## Required docs (must exist)
- `docs/README.md`
- `docs/architecture.md`
- `docs/providers.md`
- `docs/pancakeswap.md`
- `docs/scoring.md`
- `docs/api.md`
- `docs/security.md`
- `docs/adr/0001-monorepo.md`
- `docs/adr/0002-scoring.md`

## Additional docs (recommended)
These are useful supplements and may evolve over time:
- `docs/adapters.md`
- `docs/normalization-and-receipts.md`
- `docs/risk-and-confidence.md`
- `docs/observability.md`
- `docs/repo-standards.md`
- `docs/runbook.md`

## Scope
- Option 1 only: SwapPilot is **non-custodial** and **non-executing** (deep-link only).
- Option 2 is future work.

## Conventions
- “BEQ” = Best Executable Quote (normalized + risk-aware + confidence-aware).
- “Best Raw Output” = max output among sources (not necessarily executable/sellable).
- Never claim guarantees for sellability.
