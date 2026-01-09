# Key Features

## Smart Quote Comparison

SwapPilot fetches quotes from all providers in parallel and ranks them by:

1. **Net Output (fees + gas)**: Output is evaluated on the expected net tokens received after explicit fees and gas costs.
2. **Execution confidence**: Integration reliability + sellability confidence signals.
3. **Risk signals**: Revert risk, MEV exposure, and churn.
4. **Preflight simulation**: When available, simulated execution is used to validate quotes and penalize output mismatch.

### Ranking Algorithm

SwapPilot uses **BEQ v2** (Best Executable Quote) rather than a naive “highest raw output wins” sort.

At a high level:

```typescript
// Pseudocode (see packages/scoring/src/beq-v2.ts)

netBuyAmount = buyAmount - fee(buyAmount, feeBps) - gasCostInTokens(estimatedGasUsd)
outputScore = 100 * netBuyAmount / maxNetBuyAmountAcrossQuotes

beqScore = outputScore * qualityMultiplier * riskMultiplier
```

This avoids picking a quote that looks better on raw output but is worse after fees/gas, and it makes the decision explainable in receipts.

### SAFE mode guardrails (important)
- In **SAFE** mode, quotes with missing preflight data are **disqualified** from BEQ ranking.
- In **SAFE** mode, failed preflight simulations are **disqualified**.
- In **SAFE** mode, sellability `FAIL` is **disqualified**.

This makes SAFE consistently prioritize executability over optimistic quotes.

---

## Slippage Protection

Users can configure slippage tolerance to protect against unfavorable price movements:

| Level | Tolerance | Use Case |
|-------|-----------|----------|
| Low | 0.5% | Stable pairs, may fail in volatile markets |
| Medium | 1-2% | Balanced protection for most trades |
| High | 3-4% | Volatile tokens or large trades |

### How Slippage Works

```
Expected Output: 100 USDT
Slippage: 1%
Minimum Received: 99 USDT

If actual output < 99 USDT → Transaction reverts
```

---

## Token Approval Management

SwapPilot intelligently manages ERC-20 token approvals:

### Approval Modes

| Mode | Description | Security | Convenience |
|------|-------------|----------|-------------|
| Infinite | One-time approval for unlimited swaps | ⚠️ Lower | ✅ High |
| Exact | Approve only required amount | ✅ Higher | ⚠️ Lower |

### Automatic Detection

- Checks existing allowance before swap
- Only requests approval if needed
- Waits for confirmation before proceeding

---

## Transaction Simulation

Before execution, transactions are simulated to:

- ✅ Verify sufficient balance
- ✅ Estimate accurate gas costs
- ✅ Detect potential failures
- ✅ Validate expected output

### Simulation Benefits

```
Without Simulation:
  User signs → Fails on-chain → Gas wasted

With Simulation:
  Simulate → Detect issue → User warned → No gas wasted
```

---

## Real-time Balance Updates

After successful swaps, balances are refreshed automatically using a multi-interval approach:

| Time | Action |
|------|--------|
| 0s | Immediate refresh |
| +1s | Second refresh |
| +2.5s | Third refresh |
| +5s | Final refresh |

This ensures accurate balance display even with RPC propagation delays.

---

## Error Handling & Recovery

SwapPilot provides clear, actionable error messages:

| Error Type | User Message | Recovery Action |
|------------|--------------|-----------------|
| Insufficient Balance | "Not enough {token} for this swap" | Add funds or reduce amount |
| Approval Failed | "Token approval failed" | Retry approval |
| Slippage Exceeded | "Price moved beyond tolerance" | Increase slippage or retry |
| Quote Expired | "Quote is stale, please refresh" | Fetch new quotes |
| Network Error | "Connection issue, retrying..." | Automatic retry |
