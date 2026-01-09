# Scoring — BEQ (Best Executable Quote)

## Non-negotiable
- Always show **BEQ** and **Best Raw Output** as separate views.
- Never claim guarantees; sellability must be `OK` / `UNCERTAIN` / `FAIL` with confidence.

## Definitions
- **Best Raw Output**: maximizes raw `buyAmount` among successful quotes.
- **BEQ**: maximizes a risk-aware, confidence-aware score over normalized quotes.

## Inputs to scoring (minimum)
- raw `buyAmount`
- explicit fees (`feeBps`, nullable)
- estimated gas cost in USD (`estimatedGasUsd`, nullable)
- buy token USD price + decimals (for converting gas USD → tokens, nullable)
- sellability status + confidence
- revert risk level
- MEV exposure level
- churn level
- preflight simulation output (optional, but required for SAFE mode)

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

Implementation rules (current):
- `FAIL` sellability is disqualified from BEQ ranking in SAFE.
- Missing preflight data is disqualified from BEQ ranking in SAFE.
- Failed preflight (`preflight.ok=false`) is disqualified from BEQ ranking in SAFE.

### NORMAL
- Balanced tradeoff between output and risk.

### DEGEN
- Favor output more aggressively.
- Still do not hide risk; show warnings prominently.

## BEQ formula (implemented)
For every provider quote, we compute BEQ v2:

$$
BEQScore = OutputScore \times QualityMultiplier \times RiskMultiplier
$$

Where:
- $OutputScore \in [0,100]$ is the net-output ratio relative to the best net quote.
- $QualityMultiplier \in [0,1]$ captures integration reliability and sellability confidence.
- $RiskMultiplier \in [0,1]$ captures revert/MEV/churn risk and preflight results.

### Net output
We score output on *net received amount* (not raw `buyAmount`):

$$
NetBuyAmount = \max\left(0,\; BuyAmount\cdot(1-\tfrac{feeBps}{10{,}000}) - GasCostInTokens\right)
$$

If `estimatedGasUsd` and buy token USD price are available, gas is converted into buy-token units:

$$
GasCostInTokens \approx \frac{GasUsd}{TokenPriceUsd} \times 10^{decimals}
$$

### Net-vs-net normalization (important change)
OutputScore is normalized against the best **net** quote across the set:

$$
OutputScore = \text{clamp}\left(100\times\frac{NetBuyAmount}{\max(NetBuyAmount)}\right)
$$

If the best-net denominator is not available, we fall back to `maxBuyAmount`.

Receipts must include an explainable `whyWinner` list that describes which rules were applied.

## Output requirements
- API must expose both selections:
  - `bestExecutableQuoteProviderId`
  - `bestRawOutputProviderId`
- Receipt must explain why BEQ selected provider X.

In addition, the API exposes:
- `beqRecommendedProviderId`
- `bestRawQuotes` (separate ordering from `rankedQuotes`)
