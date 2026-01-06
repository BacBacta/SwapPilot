# Key Features

## Smart Quote Comparison

SwapPilot fetches quotes from all providers in parallel and ranks them by:

1. **Effective Output**: Actual tokens received after all fees
2. **Gas Cost**: Estimated transaction cost in native currency
3. **Price Impact**: Deviation from market price
4. **Execution Probability**: Historical success rate

### Ranking Algorithm

```typescript
const rankedQuotes = quotes
  .filter(q => q.status === 'success')
  .sort((a, b) => {
    const aEffective = BigInt(a.buyAmount) - estimateGasCost(a);
    const bEffective = BigInt(b.buyAmount) - estimateGasCost(b);
    return bEffective > aEffective ? 1 : -1;
  });
```

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
