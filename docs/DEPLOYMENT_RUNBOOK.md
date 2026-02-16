# SwapPilot DappBay Deployment & Migration Runbook

**Version**: 1.0  
**Date**: February 16, 2026  
**Status**: Ready for execution  
**Prerequisites**: Safe multisig access, BSC mainnet funded deployer wallet

---

## Overview

This runbook guides the deployment of DappBay-compliant contracts and migration from V1 to V2 infrastructure.

**Timeline**: ~2 hours (excluding Timelock confirmation delays)  
**Risk Level**: Medium (requires careful execution with mainnet funds)  
**Rollback**: Possible before ownership transfer

**Note**: Vesting is managed externally (CEX, launchpads). This runbook focuses on TimelockController and FeeCollectorV2 deployment.

---

## Pre-Deployment Checklist

- [ ] Safe multisig (`0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8`) is accessible
- [ ] Deployer wallet funded with at least 1 BNB for gas
- [ ] All signers on Safe are available for 3 transactions
- [ ] `.env` configured with `DEPLOYER_PRIVATE_KEY` and `BSCSCAN_API_KEY`
- [ ] Testnet deployment tested and verified
- [ ] Current FeeCollector balance checked (for migration)
- [ ] All beneficiary wallet addresses confirmed

---

## Phase 1: Deploy TimelockController (15 min)

### Step 1.1: Deploy TimelockController

```bash
cd /workspaces/SwapPilot/contracts
npx hardhat run scripts/deploy-timelock.ts --network bsc
```

**Expected output:**
```
✅ TimelockController deployed to: 0x...
```

**Save this address:** `TIMELOCK=0x...`

### Step 1.2: Verify on BscScan

```bash
export TIMELOCK=0x... # Address from step 1.1
export MIN_DELAY=86400 # 24 hours
export SAFE=0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8

npx hardhat verify --network bsc $TIMELOCK $MIN_DELAY "[$SAFE]" "[$SAFE]" <DEPLOYER_ADDRESS>
```

Wait for BscScan verification (2-5 minutes).

### Step 1.3: Verify Roles

Visit BscScan → Read Contract → Check:
- `hasRole(PROPOSER_ROLE, SAFE)` → true
- `hasRole(EXECUTOR_ROLE, SAFE)` → true  
- `hasRole(DEFAULT_ADMIN_ROLE, deployer)` → true

✅ **Checkpoint 1:** TimelockController deployed and verified

---

## Phase 2: Deploy FeeCollectorV2 (20 min)

### Step 2.1: Set Timelock Address

```bash
export TIMELOCK_ADDRESS=$TIMELOCK
```

### Step 2.2: Deploy FeeCollectorV2

```bash
npx hardhat run scripts/deploy-feecollector-v2.ts --network bsc
```

**Expected output:**
```
✅ FeeCollectorV2 deployed to: 0x...
```

**Save this address:** `FEECOLLECTOR_V2=0x...`

### Step 2.3: Verify on BscScan

```bash
export PILOT=0xe3f77E20226fdc7BA85E495158615dEF83b48192
export PANCAKE_ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E
export WBNB=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c

npx hardhat verify --network bsc $FEECOLLECTOR_V2 $PILOT $SAFE $SAFE $PANCAKE_ROUTER $WBNB
```

### Step 2.4: Transfer Ownership to Timelock

Create Safe transaction:
1. Go to Safe UI → New Transaction → Contract Interaction
2. Contract Address: `$FEECOLLECTOR_V2`
3. ABI: Find `transferOwnership(address)`
4. Parameters: `newOwner = $TIMELOCK`
5. Submit → Collect signatures → Execute

Verify:
```bash
cast call $FEECOLLECTOR_V2 "owner()(address)" --rpc-url https://bsc-dataseed.binance.org/
# Should return: $TIMELOCK
```

✅ **Checkpoint 2:** FeeCollectorV2 deployed, verified, owned by Timelock

---

## Phase 3: Migrate FeeCollector (45 min)

### Step 3.1: Check Old FeeCollector Balance

```bash
export OLD_FEECOLLECTOR=0xEe841Def61326C116F92e71FceF8cb11FBC05034

cast balance $OLD_FEECOLLECTOR --rpc-url https://bsc-dataseed.binance.org/
# Note the BNB balance
```

### Step 3.2: Pause Old FeeCollector (if implemented)

If old contract has `pause()`:
```bash
# Via Safe transaction
# Contract: $OLD_FEECOLLECTOR
# Function: pause()
# Execute
```

Otherwise, document that old contract remains active until config update.

### Step 3.3: Emergency Withdraw from Old FeeCollector

Via Safe transaction (requires 24h if old has Timelock, instant if not):
1. Contract: `$OLD_FEECOLLECTOR`
2. Function: `emergencyWithdraw(address,uint256)`
3. Parameters:
   - `token`: `0x0000000000000000000000000000000000000000` (BNB)
   - `amount`: [full balance from Step 4.1]
4. Execute

BNB is now in Safe multisig.

### Step 3.4: Fund New FeeCollectorV2

Send BNB from Safe to new FeeCollectorV2:
1. New Transaction → Send Funds
2. Recipient: `$FEECOLLECTOR_V2`
3. Amount: [amount from Step 4.3]
4. Execute

Verify:
```bash
cast balance $FEECOLLECTOR_V2 --rpc-url https://bsc-dataseed.binance.org/
```

### Step 3.5: Test distributeFees() with Slippage Protection

Calculate `minPilotOut`:
1. Get current PILOT/BNB price from PancakeSwap
2. Calculate expected PILOT for 15% of balance
3. Apply 2% slippage: `minPilotOut = expected * 0.98`

Via Safe transaction:
1. Contract: `$FEECOLLECTOR_V2`
2. Function: `distributeFees(uint256)`
3. Parameter: `minPilotOut` (calculated above)
4. Execute

⚠️ **Note**: This requires 24h delay due to Timelock!

**Workaround for testing**: Deploy a temporary FeeCollectorV2 with Safe as owner, test, then use Timelock for production.

✅ **Checkpoint 3:** Old FeeCollector drained, new one funded and tested

---

## Phase 4: Update Configuration (30 min)

### Step 4.1: Update packages/fees/src/config.ts

```typescript
export const FEE_COLLECTOR_V2 = '0x...' as Address; // New FeeCollectorV2
export const TIMELOCK_CONTROLLER = '0x...' as Address; // TimelockController
```

Commit and push:
```bash
git add packages/fees/src/config.ts
git commit -m "chore: update contract addresses for V2 deployment"
git push origin main
```

### Step 4.2: Update API Environment Variables

**Fly.io** (apps/api):
```bash
fly secrets set FEE_COLLECTOR=0x... -a swappilot-api
```

**Vercel** (apps/web):
```bash
vercel env add NEXT_PUBLIC_FEE_COLLECTOR
# Paste: 0x...
# Select: Production
```

### Step 4.3: Update Documentation

Edit these files:
- `README.md`: Contract addresses table
- `docs/DAPPBAY_COMPLIANCE.md`: Update deployment status
- `docs/INTERNAL.md`: Add migration notes

Commit:
```bash
git add README.md docs/
git commit -m "docs: update contract addresses post-V2 migration"
git push origin main
```

### Step 4.4: Deploy Updated Code

```bash
# API
cd apps/api
fly deploy

# Web
cd apps/web
vercel --prod
```

✅ **Checkpoint 4:** All configs updated, code deployed

---

## Phase 5: Transfer Remaining Ownerships (20 min)

### Step 5.1: Transfer ReferralRewards Ownership

Current owner: Safe → New owner: Timelock

```bash
export REFERRAL_REWARDS=0x3b39d37F4bB831AD7783D982a46cAb85AA887d3E
```

Via Safe transaction:
1. Contract: `$REFERRAL_REWARDS`
2. Function: `transferOwnership(address)`
3. Parameter: `$TIMELOCK`
4. Execute

### Step 5.2: Transfer ReferralPool Ownership (if deployed)

```bash
export REFERRAL_POOL=0x... # If deployed separately
```

Same process as Step 6.1.

### Step 5.3: Verify All Ownerships

```bash
echo "FeeCollectorV2:"
cast call $FEECOLLECTOR_V2 "owner()(address)" --rpc-url https://bsc-dataseed.binance.org/

echo "ReferralRewards:"
cast call $REFERRAL_REWARDS "owner()(address)" --rpc-url https://bsc-dataseed.binance.org/

# All should return: $TIMELOCK
```

✅ **Checkpoint 5:** All contracts owned by Timelock

---

## Phase 6: Renounce Timelock Admin (FINAL STEP)

⚠️ **CRITICAL: This is irreversible! Verify everything before executing.**

### Step 6.1: Final Verification Checklist

- [ ] All contracts deployed and verified on BscScan
- [ ] All ownerships transferred to Timelock
- [ ] FeeCollectorV2 tested with real BNB
- [ ] Safe can propose/execute on Timelock
- [ ] Config updated and deployed
- [ ] Old FeeCollector drained
- [ ] No pending transactions on Safe

### Step 6.2: Renounce Admin Role

```bash
# From deployer wallet (NOT via Safe)
npx hardhat console --network bsc

# In console:
const timelock = await ethers.getContractAt("TimelockController", "$TIMELOCK");
const ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();
const deployer = (await ethers.getSigners())[0];
const tx = await timelock.renounceRole(ADMIN_ROLE, deployer.address);
await tx.wait();
console.log("Admin role renounced");

# Verify
const hasAdmin = await timelock.hasRole(ADMIN_ROLE, deployer.address);
console.log("Deployer still has admin:", hasAdmin); // Should be false
```

### Step 6.3: Verify Full Decentralization

```bash
# Check that NO address has DEFAULT_ADMIN_ROLE
cast call $TIMELOCK "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  <DEPLOYER_ADDRESS> \
  --rpc-url https://bsc-dataseed.binance.org/
# Should return: false

# Check Safe has all necessary roles
cast call $TIMELOCK "hasRole(bytes32,address)(bool)" \
  <PROPOSER_ROLE_HASH> \
  $SAFE \
  --rpc-url https://bsc-dataseed.binance.org/
# Should return: true
```

✅ **FINAL CHECKPOINT:** System fully decentralized

---

## Phase 7: Post-Deployment Validation (30 min)

### Step 7.1: Run GoPlus Security Scan

```bash
# FeeCollectorV2
curl "https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses=$FEECOLLECTOR_V2"

# Should show:
# - is_open_source: 1
# - owner_address: $TIMELOCK
# - can_take_back_ownership: 0
```

### Step 7.2: Test Full Fee Flow

1. Send 0.15 BNB to FeeCollectorV2
2. Via Safe, propose `distributeFees(minPilotOut)` transaction
3. Wait 24 hours
4. Execute transaction
5. Verify:
   - Treasury received ~0.12 BNB (80%)
   - Referral pool received ~0.0075 BNB (5%)
   - PILOT bought and burned (~0.0225 BNB worth)
   - PILOTToken.totalSupply() decreased

### Step 7.3: Document Final Addresses

Create `CONTRACT_ADDRESSES.md`:

```markdown
# SwapPilot Contract Addresses (BSC Mainnet)

| Contract | Address | Owner | Status |
|---|---|---|---|
| PILOTToken | 0xe3f77E20226fdc7BA85E495158615dEF83b48192 | Renounced | Immutable |
| FeeCollectorV2 | 0x... | TimelockController | Active |
| ReferralRewards | 0x3b39d37F4bB831AD7783D982a46cAb85AA887d3E | TimelockController | Active |
| TimelockController | 0x... | Decentralized | 24h delay |
| Safe Multisig | 0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8 | Signers | Proposer/Executor |

**Deprecated:**
- FeeCollector V1: 0xEe841Def61326C116F92e71FceF8cb11FBC05034 (drained, inactive)
```

✅ **Deployment Complete**

---

## Rollback Procedures

### If issues found BEFORE ownership transfer:

1. **Redeploy affected contract**
2. Update addresses in scripts
3. Restart from relevant phase

### If issues found AFTER ownership transfer but BEFORE admin renounce:

1. **Via deployer wallet** (still has admin role):
   ```bash
   # Revoke Timelock proposer role from Safe
   await timelock.revokeRole(PROPOSER_ROLE, SAFE);
   
   # Grant admin to Safe for emergency
   await timelock.grantRole(ADMIN_ROLE, SAFE);
   ```
2. Via Safe, fix issue
3. Re-transfer ownerships if needed

### If issues found AFTER admin renounce:

**No rollback possible. All changes require 24h Timelock delay.**

Mitigation:
1. Via Safe, propose pause transactions on affected contracts
2. Wait 24h, execute pause
3. Deploy fixed contracts
4. Via Safe, propose ownership transfers
5. Wait 24h, execute

**This is why Phase 7 is LAST and requires full verification.**

---

## Timeline Summary

| Phase | Duration | Can be done in parallel? |
|---|---|---|
| 1. TimelockController | 15 min | No |
| 2. FeeCollectorV2 | 20 min | After Phase 1 |
| 3. Migration | 45 min | After Phase 2 |
| 4. Config Update | 30 min | After Phase 3 |
| 5. Transfer Ownerships | 20 min | After Phase 2 |
| 6. Renounce Admin | 5 min | After Phase 5 ✅ |
| 7. Validation | 30 min | After Phase 6 |
| **Total** | **~2.5 hours** | (excluding 24h Timelock waits) |

---

## Emergency Contacts

- Safe signers: [List names/Telegram handles]
- Deployer: [Name/contact]
- Technical lead: [Name/contact]
- DappBay support: [Email/Telegram]

---

## Appendix: Useful Commands

### Check contract ownership
```bash
cast call <CONTRACT> "owner()(address)" --rpc-url https://bsc-dataseed.binance.org/
```

### Check contract balance
```bash
cast balance <CONTRACT> --rpc-url https://bsc-dataseed.binance.org/
```

### Check PILOT balance
```bash
cast call $PILOT "balanceOf(address)(uint256)" <ADDRESS> --rpc-url https://bsc-dataseed.binance.org/
```

### Verify on BscScan
```bash
npx hardhat verify --network bsc <ADDRESS> <CONSTRUCTOR_ARGS>
```

### Get role hashes
```bash
# PROPOSER_ROLE
cast keccak "PROPOSER_ROLE"

# EXECUTOR_ROLE  
cast keccak "EXECUTOR_ROLE"

# CANCELLER_ROLE
cast keccak "CANCELLER_ROLE"
```

---

**END OF RUNBOOK**

*Reviewed by: [Name]*  
*Approved for execution: [Date]*
