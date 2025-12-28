# Normalization & Receipts

## Why normalization is mandatory
Raw quotes from providers are not directly comparable due to:
- gas model differences
- fee models
- route complexity & revert risk
- partial-fill assumptions
- token taxes / transfer-fee behavior

SwapPilot must not ship “price comparison” without:
- a Normalizer producing comparable numbers
- a Receipt explaining decisions and assumptions

## Normalized fields (minimum)
- normalized buy amount
- effective price
- estimated gas cost (nullable if unknown)
- fees (nullable if unknown)

## Receipt
A receipt is an explainability artifact that:
- captures request inputs (sanitized)
- lists adapter outcomes (success/failure/timeout)
- explains normalization assumptions
- details BEQ ranking (signals + weights)
- warns about uncertain/failed sellability

Receipts must be retrievable by `GET /v1/receipts/:id`.

## Output views
- **Best Raw Output**: max raw buy amount.
- **BEQ**: best executable quote after risk/confidence adjustments.

## Never guarantee sellability
Sellability must be presented as:
- OK / UNCERTAIN / FAIL
- with a confidence score and reasons.
