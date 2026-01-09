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
- starts from normalized output and evaluates **net output** (fees + gas)
- applies explicit penalties for fees and gas when known (gas converted into buy-token terms when pricing data exists)
- applies risk penalties (revert risk, MEV exposure, churn)
- applies a sellability multiplier based on `OK`/`UNCERTAIN`/`FAIL` and confidence
- uses preflight simulation results (when available) as a multiplier / disqualification signal

Support 3 user modes:
- SAFE: prioritize executability (strict guardrails)
- NORMAL: balanced
- DEGEN: prioritize output (while still surfacing risk)

SAFE guardrails (current implementation):
- `sellability=FAIL` is disqualified from BEQ ranking
- missing `preflight` data is disqualified from BEQ ranking
- failed preflight (`preflight.ok=false`) is disqualified from BEQ ranking

Output normalization (current implementation):
- OutputScore is normalized **net-vs-net** using the maximum net buy amount across quotes when available (`maxNetBuyAmount`).
- This prevents high-fee quotes from looking best due to raw output.

## Consequences
- API must return structured signals and a numeric `beqScore`.
- Receipt must explain the BEQ decision with the evaluated signals and mode.
- Best Raw Output remains visible as a separate selection.
