# ADR 0002 — BEQ Scoring & Modes

## Status
Accepted (initial)

## Context
SwapPilot’s primary success metric (Option 1) is comparability + explainability.
Raw output is insufficient because execution risk varies across providers/routes/tokens.

Non-negotiables:
- Always show BEQ and Best Raw Output separately.
- Never claim guarantees for sellability.
- UI must surface risk and confidence.

## Decision
Use a scoring function that:
- starts from normalized output
- applies explicit penalties for gas/fees when known
- applies risk penalties (revert risk, MEV exposure, churn)
- applies a sellability multiplier based on `OK`/`UNCERTAIN`/`FAIL` and confidence

Support 3 user modes:
- SAFE: prioritize executability
- NORMAL: balanced
- DEGEN: prioritize output (while still surfacing risk)

## Consequences
- API must return structured signals and a numeric `beqScore`.
- Receipt must explain the BEQ decision with the evaluated signals and mode.
- Best Raw Output remains visible as a separate selection.
