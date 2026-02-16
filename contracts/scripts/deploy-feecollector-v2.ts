import { ethers } from "hardhat";

/**
 * Deploy FeeCollectorV2 (DappBay Compliant) with TimelockController as owner
 * 
 * Changes from V1:
 * - Added Pausable circuit breaker
 * - Added events for all admin setters
 * - Added slippage protection (minPilotOut parameter)
 * - Restricted distributeFees() to owner only
 * - Fixed burn to use actual burn() instead of dead address
 * - Added minimum distribution threshold
 */

async function main() {
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error(
      [
        "No deployer signer available.",
        "\n\nFix:",
        "- Create /workspaces/SwapPilot/contracts/.env with DEPLOYER_PRIVATE_KEY=...",
        "  (or export DEPLOYER_PRIVATE_KEY in your shell)",
        "- Fund the deployer address with BNB for gas",
        "- Re-run: npx hardhat run scripts/deploy-feecollector-v2.ts --network bsc",
      ].join("\n")
    );
  }

  const [deployer] = signers;

  console.log("Deploying FeeCollectorV2 with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "BNB"
  );

  // Contract addresses
  const PILOT_TOKEN = "0xe3f77E20226fdc7BA85E495158615dEF83b48192";
  const SAFE = "0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8";
  
  // ⚠️ IMPORTANT: Update this with actual TimelockController address after deployment
  const TIMELOCK = process.env.TIMELOCK_ADDRESS || SAFE; // Fallback to Safe if Timelock not deployed yet
  
  const TREASURY = SAFE;
  const REFERRAL_POOL = SAFE;
  const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // PancakeSwap V2 Router
  const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"; // WBNB on BSC

  console.log("\n📋 Constructor parameters:");
  console.log("  - PILOT Token:", PILOT_TOKEN);
  console.log("  - Treasury (80%):", TREASURY);
  console.log("  - Referral Pool (5%):", REFERRAL_POOL);
  console.log("  - PancakeSwap Router:", PANCAKE_ROUTER);
  console.log("  - WBNB:", WBNB);
  console.log("  - Initial Owner:", deployer.address, "(will transfer to Timelock)");

  // Deploy FeeCollectorV2
  console.log("\n🚀 Deploying FeeCollectorV2...");
  const FeeCollectorV2 = await ethers.getContractFactory("FeeCollectorV2");
  const feeCollectorV2 = await FeeCollectorV2.deploy(
    PILOT_TOKEN,
    TREASURY,
    REFERRAL_POOL,
    PANCAKE_ROUTER,
    WBNB
  );
  
  await feeCollectorV2.waitForDeployment();
  const feeCollectorV2Address = await feeCollectorV2.getAddress();
  
  console.log("✅ FeeCollectorV2 deployed to:", feeCollectorV2Address);

  // Verify initial state
  console.log("\n🔍 Verifying initial state...");
  const owner = await feeCollectorV2.owner();
  const treasury = await feeCollectorV2.treasury();
  const referralPool = await feeCollectorV2.referralPool();
  const minDistribution = await feeCollectorV2.minDistributionAmount();
  const paused = await feeCollectorV2.paused();

  console.log("  Owner:", owner);
  console.log("  Treasury:", treasury);
  console.log("  Referral Pool:", referralPool);
  console.log("  Min Distribution:", ethers.formatEther(minDistribution), "BNB");
  console.log("  Paused:", paused);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("FEECOLLECTOR V2 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`FeeCollectorV2: ${feeCollectorV2Address}`);
  console.log(`PILOT Token: ${PILOT_TOKEN}`);
  console.log(`Treasury (80%): ${TREASURY}`);
  console.log(`Referral Pool (5%): ${REFERRAL_POOL}`);
  console.log(`Burn (15%): Via PancakeSwap buyback + actual burn()`);
  console.log(`Owner: ${owner} → will transfer to ${TIMELOCK}`);
  console.log("=".repeat(60));

  console.log("\n✨ Improvements over V1:");
  console.log("  ✅ Pausable circuit breaker");
  console.log("  ✅ Events on all admin setters");
  console.log("  ✅ Slippage protection (minPilotOut parameter)");
  console.log("  ✅ Owner-only distributeFees() (prevents MEV timing exploit)");
  console.log("  ✅ Actual burn() reduces totalSupply (not dead address)");
  console.log("  ✅ Minimum distribution threshold (0.1 BNB)");

  console.log("\n📝 Next steps:");
  
  console.log("\n1. Verify contract on BscScan:");
  console.log(`   npx hardhat verify --network bsc ${feeCollectorV2Address} ${PILOT_TOKEN} ${TREASURY} ${REFERRAL_POOL} ${PANCAKE_ROUTER} ${WBNB}`);
  
  console.log("\n2. Transfer ownership to TimelockController:");
  if (TIMELOCK === SAFE) {
    console.log("   ⚠️  Set TIMELOCK_ADDRESS env var first:");
    console.log("   export TIMELOCK_ADDRESS=<timelock-address>");
    console.log("   Then run:");
  }
  console.log(`   await feeCollectorV2.transferOwnership("${TIMELOCK}")`);

  console.log("\n3. Migrate BNB from old FeeCollector:");
  console.log("   a. Call emergencyWithdraw on old FeeCollector (0xEe841...5034)");
  console.log("   b. Send BNB to new FeeCollectorV2");
  console.log("   c. Verify balance transferred");

  console.log("\n4. Update config addresses:");
  console.log("   - packages/fees/src/config.ts: FEE_COLLECTOR");
  console.log("   - docs/DAPPBAY_COMPLIANCE.md: Update contract table");
  console.log("   - README.md: Update contract addresses");

  console.log("\n5. Test distributeFees() with slippage protection:");
  console.log("   Send 0.1+ BNB to contract, then:");
  console.log("   await feeCollectorV2.distributeFees(minPilotOut)");
  console.log("   (Calculate minPilotOut from current PILOT/BNB price)");

  console.log("\n6. Configure API to send fees to new address:");
  console.log("   Update FEE_COLLECTOR env var in Fly.io / Vercel");

  console.log("\n⚠️  CRITICAL: DO NOT renounce ownership!");
  console.log("   FeeCollectorV2 MUST have TimelockController as owner");
  console.log("   This enables emergency operations with 24h delay");

  console.log("\n⚠️  SAVE THIS ADDRESS:");
  console.log(`   FeeCollectorV2: ${feeCollectorV2Address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
