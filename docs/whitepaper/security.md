# Security Considerations

## Smart Contract Interactions

SwapPilot does **not** deploy custom smart contracts. All swaps are executed through audited DEX protocol contracts:

| Protocol | Contract | Audit Status |
|----------|----------|--------------|
| 1inch | AggregationRouterV6 | ✅ Audited |
| KyberSwap | MetaAggregationRouterV2 | ✅ Audited |
| ParaSwap | Augustus Swapper | ✅ Audited |
| OKX DEX | DEX Router | ✅ Audited |

---

## Non-Custodial Architecture

SwapPilot **never** takes custody of user funds:

```
┌─────────────────────────────────────────────────┐
│                User's Wallet                     │
│  • Private keys remain with user                 │
│  • Transactions signed locally                   │
│  • Funds never leave user control                │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│              SwapPilot (Read Only)               │
│  • Fetches quotes                                │
│  • Builds transaction data                       │
│  • NO access to funds                            │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│           DEX Protocol Contracts                 │
│  • Approvals granted to DEX, not SwapPilot      │
│  • Audited smart contracts                       │
│  • On-chain execution                            │
└─────────────────────────────────────────────────┘
```

---

## API Security

| Measure | Implementation |
|---------|----------------|
| Rate Limiting | Prevents abuse and DDoS |
| Request Validation | Zod schemas for type safety |
| Data Privacy | No storage of sensitive user data |
| Transport | HTTPS-only communication |
| CORS | Restricted to known origins |

---

## Frontend Security

| Measure | Description |
|---------|-------------|
| No Private Keys | Keys never exposed to application |
| Secure Connections | WalletConnect protocol |
| Transaction Preview | Clear display before signing |
| Parameter Verification | All values visible to user |

---

## Recommended User Practices

### Before Trading

1. ✅ Verify you're on the correct website (https://app-swappilot.xyz)
2. ✅ Check the token contract address independently
3. ✅ Start with a small test transaction

### During Trading

4. ✅ Always review transaction details before signing
5. ✅ Verify the receiving address and amount
6. ✅ Keep slippage tolerance reasonable

### For Large Amounts

7. ✅ Use a hardware wallet (Ledger, Trezor)
8. ✅ Split large trades into smaller chunks
9. ✅ Monitor transaction on block explorer

---

## Security Audits

SwapPilot's codebase is open source and available for review:

- **GitHub**: [github.com/BacBacta/SwapPilot](https://github.com/BacBacta/SwapPilot)
- **License**: MIT

While SwapPilot itself has not undergone a formal audit, all integrated DEX protocols have been audited by reputable security firms.

---

## Bug Bounty

We encourage responsible disclosure of security vulnerabilities. Please report any issues to:

- **Email**: security@swappilot.xyz
- **Response Time**: Within 48 hours
