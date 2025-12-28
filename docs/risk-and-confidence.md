# Risk & Confidence

## Core requirement
UI and API must surface:
- confidence
- revert risk
- MEV exposure
- churn
- sellability

Never claim guarantees.

## Sellability status
- `OK`: likely executable/sellable under current assumptions
- `UNCERTAIN`: insufficient data, unstable market, or ambiguous token behavior
- `FAIL`: known blockers or high likelihood of failure

Each must include:
- `confidence` in [0,1]
- `reasons`: machine-readable strings

## Risk signals (suggested)
- Revert risk: token tax suspicion, low liquidity, fragile routes
- MEV exposure: public mempool routing vs protected routing (if known)
- Churn: quote volatility or provider instability

## BEQ ranking philosophy
BEQ favors executable, stable outcomes over raw output.
Normalization + signals drive the ranking.
