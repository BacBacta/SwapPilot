# SwapPilot Airdrop — Wallet Collection Form Template

## Google Form Setup

### Title
**SwapPilot TGE Airdrop — Top 50 Pilots**

### Description
```
Congratulations, Pilot! 🎉
You made it to the Top 50 XP leaderboard.
Please submit your BSC wallet address below to claim your $PILOT airdrop.

⚠️ Rules:
- One wallet per person. Duplicates = disqualification.
- You MUST sign a verification message with your wallet (instructions below).
- Fake or borrowed wallets = permanent ban.
- Deadline: 48 hours after this form goes live.
```

### Fields

| Field | Type | Required | Validation |
|---|---|---|---|
| Telegram @handle | Short text | Yes | Starts with @ |
| Telegram User ID | Short text | Yes | Numeric only |
| BSC Wallet Address | Short text | Yes | Starts with 0x, 42 characters |
| Signature Hash | Long text | Yes | See signing instructions |
| I accept the rules | Checkbox | Yes | Must be checked |

### Settings
- Limit to 1 response (Google account required)
- Collect email addresses (for dispute resolution)
- Enable CAPTCHA / reCAPTCHA

---

## Signing Instructions (include in form description)

```
To prove wallet ownership, sign this exact message using your BSC wallet:

Message to sign: "SwapPilot Airdrop Claim: @YourTelegramHandle"

How to sign:
1. Go to https://etherscan.io/verifiedSignatures (or BscScan equivalent)
2. Or use MetaMask > Settings > Sign Message
3. Or use the script we provide: python verify_wallet.py --sign

Paste the resulting signature hash in the form.
```

---

## Anti-Fraud Checklist (for admins)

- [ ] Check for duplicate wallet addresses
- [ ] Check for duplicate Telegram IDs
- [ ] Verify all signatures match wallet + handle
- [ ] Check wallet age on BscScan (> 7 days preferred)
- [ ] Cross-reference wallets for common funding source
- [ ] Verify Telegram account age (> 30 days)
- [ ] Review XP history for suspicious patterns
- [ ] Publish winner list for 24h community review
