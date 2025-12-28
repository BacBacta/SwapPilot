# Scoring — BEQ (Best Executable Quote)

## Non-negotiable
- Always show **BEQ** and **Best Raw Output** as separate views.
- Never claim guarantees; sellability must be `OK` / `UNCERTAIN` / `FAIL` with confidence.

## Definitions
- **Best Raw Output**: maximizes raw `buyAmount` among successful quotes.
- **BEQ**: maximizes a risk-aware, confidence-aware score over normalized quotes.

## Inputs to scoring (minimum)
- normalized buy amount / effective price
- estimated gas cost (nullable)
- explicit fees (nullable)
- sellability status + confidence
- revert risk level
- MEV exposure level
- churn level

## Modes
SwapPilot supports a user-selected mode that changes weights:

### SAFE
- Strongly penalize `UNCERTAIN`/`FAIL` sellability.
- Strongly penalize HIGH revert risk.
- Prefer known-stable providers.

### NORMAL
- Balanced tradeoff between output and risk.

### DEGEN
- Favor output more aggressively.
- Still do not hide risk; show warnings prominently.

## BEQ formula (concept)
Let:
- `O` = normalized output score (higher is better)
- `G` = normalized gas+fees penalty
- `R` = risk penalty derived from revertRisk/mevExposure/churn
- `S` = sellability multiplier derived from status and confidence

Then:

$$
BEQ = S \cdot (O - G) - R
$$

### Sellability multiplier (example rule)
- `OK`: $S = 0.9 + 0.1 \cdot confidence$
- `UNCERTAIN`: $S = 0.4 + 0.4 \cdot confidence$
- `FAIL`: $S = 0$

Exact weights are subject to ADR `0002-scoring`.

## Output requirements
- API must expose both selections:
  - `bestExecutableQuoteProviderId`
  - `bestRawOutputProviderId`
- Receipt must explain why BEQ selected provider X.
