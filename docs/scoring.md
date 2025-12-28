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

## Normalization assumptions (current)
For Option 1 (stub quotes), normalization is intentionally simple and deterministic:
- `priceModel = ratio_sell_buy` (placeholder)
- `effectivePrice = buyAmount / sellAmount` formatted with a fixed scale
- `gasUsdPerTx = null` (no pricing yet)
- `feeModel = feeBps_on_buyAmount`

Assumptions used for a decision are stored in the receipt.

## Modes
SwapPilot supports a user-selected mode that changes weights:

### SAFE
- Strongly penalize `UNCERTAIN`/`FAIL` sellability.
- Strongly penalize HIGH revert risk.
- Prefer known-stable providers.

Implementation rule (current): `FAIL` sellability is excluded from BEQ ranking in SAFE.

### NORMAL
- Balanced tradeoff between output and risk.

### DEGEN
- Favor output more aggressively.
- Still do not hide risk; show warnings prominently.

## BEQ formula (implemented)
For every provider quote, we compute:

$$
BEQScore = NetOut \cdot Reliability \cdot SellFactor \cdot RiskPenalty
$$

Where:
- $NetOut$ is derived from raw output and fees.
- $Reliability \in [0,1]$ comes from provider integration confidence.
- $SellFactor \in [0,1]$ comes from sellability (`OK` / `UNCERTAIN` / `FAIL`) and mode.
- $RiskPenalty \in [0,1]$ comes from the worst of revertRisk / mevExposure / churn and mode.

Receipts must include an explainable `whyWinner` list that describes which rules were applied.

## Output requirements
- API must expose both selections:
  - `bestExecutableQuoteProviderId`
  - `bestRawOutputProviderId`
- Receipt must explain why BEQ selected provider X.

In addition, the API exposes:
- `beqRecommendedProviderId`
- `bestRawQuotes` (separate ordering from `rankedQuotes`)
