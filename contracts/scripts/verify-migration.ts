import { ethers } from "hardhat";

/**
 * Verify V1 → V2 migration readiness and integrity
 * 
 * This script checks:
 * - V1 FeeCollector state before migration
 * - V2 FeeCollector is ready to take over
 * - Balance migration completed successfully
 * - All systems updated to use V2
 */

interface MigrationAddresses {
  feeCollectorV1: string;
  feeCollectorV2: string;
  timelock: string | null;
  referralRewards: string;
  pilotToken: string;
  safe: string;
}

async function main() {
  console.log("🔄 SwapPilot V1 → V2 Migration Verification");
  console.log("=" .repeat(60));
  
  const addresses: MigrationAddresses = {
    feeCollectorV1: "0xEe84a7Ab26bcCBc0E45cC1e1A915FbBFfa185034",
    feeCollectorV2: process.env.FEE_COLLECTOR_V2 || "",
    timelock: process.env.TIMELOCK_ADDRESS || null,
    referralRewards: "0x3b39d37F4bB831AD7783D982a46cAb85AA887d3E",
    pilotToken: "0xe3f77E20226fdc7BA85E495158615dEF83b48192",
    safe: "0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8",
  };

  if (!addresses.feeCollectorV2) {
    console.error("❌ Missing FEE_COLLECTOR_V2 address");
    process.exit(1);
  }

  console.log("\n📋 Migration Addresses:");
  console.log("  FeeCollectorV1:", addresses.feeCollectorV1);
  console.log("  FeeCollectorV2:", addresses.feeCollectorV2);
  if (addresses.timelock) {
    console.log("  TimelockController:", addresses.timelock);
  }
  console.log("  ReferralRewards:", addresses.referralRewards);
  console.log("  PILOTToken:", addresses.pilotToken);
  console.log("  Safe Multisig:", addresses.safe);

  let warnings = 0;
  let passed = 0;

  // Phase 1: Pre-migration checks
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 1: Pre-Migration Verification");
  console.log("=".repeat(60));

  // Check V1 state
  console.log("\n📍 FeeCollectorV1 State:");
  try {
    const v1 = await ethers.getContractAt("FeeCollector", addresses.feeCollectorV1);
    
    const v1Balance = await ethers.provider.getBalance(addresses.feeCollectorV1);
    const v1Owner = await v1.owner();
    const v1Treasury = await v1.treasury();
    const v1ReferralPool = await v1.referralPool();
    
    console.log(`  Balance: ${ethers.formatEther(v1Balance)} BNB`);
    console.log(`  Owner: ${v1Owner}`);
    console.log(`  Treasury: ${v1Treasury}`);
    console.log(`  Referral Pool: ${v1ReferralPool}`);

    if (v1Balance > 0n) {
      console.log(`⚠️  V1 still has ${ethers.formatEther(v1Balance)} BNB (should be migrated)`);
      warnings++;
    } else {
      console.log("✅ V1 balance migrated");
      passed++;
    }

    if (v1Owner.toLowerCase() === addresses.safe.toLowerCase()) {
      console.log("✅ V1 owner is Safe (can execute migration)");
      passed++;
    } else {
      console.log("❌ V1 owner is not Safe (cannot migrate)");
      warnings++;
    }

  } catch (error) {
    console.log("❌ Error checking V1:", error);
    warnings++;
  }

  // Check V2 readiness
  console.log("\n📍 FeeCollectorV2 Readiness:");
  try {
    const v2 = await ethers.getContractAt("FeeCollectorV2", addresses.feeCollectorV2);
    
    const v2Balance = await ethers.provider.getBalance(addresses.feeCollectorV2);
    const v2Owner = await v2.owner();
    const v2Treasury = await v2.treasury();
    const v2ReferralPool = await v2.referralPool();
    const v2Paused = await v2.paused();
    const v2PilotToken = await v2.pilotToken();
    
    console.log(`  Balance: ${ethers.formatEther(v2Balance)} BNB`);
    console.log(`  Owner: ${v2Owner}`);
    console.log(`  Treasury: ${v2Treasury}`);
    console.log(`  Referral Pool: ${v2ReferralPool}`);
    console.log(`  PILOT Token: ${v2PilotToken}`);
    console.log(`  Paused: ${v2Paused}`);

    const v2OwnerLower = v2Owner.toLowerCase();
    const safeLower = addresses.safe.toLowerCase();
    const timelockLower = addresses.timelock?.toLowerCase() ?? null;

    if (v2OwnerLower === safeLower) {
      console.log("✅ V2 owner is Safe");
      passed++;
    } else if (timelockLower && v2OwnerLower === timelockLower) {
      console.log("✅ V2 owner is TimelockController");
      passed++;
    } else if (v2OwnerLower === ethers.ZeroAddress) {
      console.log("❌ V2 owner is zero address (unexpected)");
      warnings++;
    } else {
      console.log(`⚠️  V2 owner is ${v2Owner} (neither Safe nor Timelock)`);
      warnings++;
    }

    if (v2Treasury.toLowerCase() !== addresses.safe.toLowerCase()) {
      console.log("❌ V2 treasury not set to Safe");
      warnings++;
    } else {
      console.log("✅ V2 treasury correctly set");
      passed++;
    }

    if (v2ReferralPool.toLowerCase() !== addresses.referralRewards.toLowerCase()) {
      console.log("❌ V2 referral pool not set correctly");
      warnings++;
    } else {
      console.log("✅ V2 referral pool correctly set");
      passed++;
    }

    if (v2PilotToken.toLowerCase() !== addresses.pilotToken.toLowerCase()) {
      console.log("❌ V2 PILOT token address incorrect");
      warnings++;
    } else {
      console.log("✅ V2 PILOT token correctly set");
      passed++;
    }

    if (v2Paused) {
      console.log("⚠️  V2 is paused (should be unpaused for operation)");
      warnings++;
    } else {
      console.log("✅ V2 is operational");
      passed++;
    }

  } catch (error) {
    console.log("❌ Error checking V2:", error);
    warnings++;
  }

  // Phase 2: Migration execution check
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 2: Migration Execution Status");
  console.log("=".repeat(60));

  try {
    const v1Balance = await ethers.provider.getBalance(addresses.feeCollectorV1);
    const v2Balance = await ethers.provider.getBalance(addresses.feeCollectorV2);

    console.log("\n💰 Balance Comparison:");
    console.log(`  V1: ${ethers.formatEther(v1Balance)} BNB`);
    console.log(`  V2: ${ethers.formatEther(v2Balance)} BNB`);
    console.log(`  Total: ${ethers.formatEther(v1Balance + v2Balance)} BNB`);

    if (v1Balance === 0n && v2Balance > 0n) {
      console.log("\n✅ Migration COMPLETE - All funds moved to V2");
      passed++;
    } else if (v1Balance > 0n && v2Balance === 0n) {
      console.log("\n⏳ Migration NOT STARTED - Funds still in V1");
      console.log("\nTo migrate, run:");
      console.log(`  1. Execute on Safe: FeeCollectorV1.emergencyWithdraw()`);
      console.log(`  2. Send withdrawn BNB to FeeCollectorV2`);
      warnings++;
    } else if (v1Balance > 0n && v2Balance > 0n) {
      console.log("\n⚠️  Migration IN PROGRESS - Funds split between V1 and V2");
      warnings++;
    } else {
      console.log("\n❌ Both V1 and V2 have zero balance");
      warnings++;
    }

  } catch (error) {
    console.log("❌ Error checking balances:", error);
    warnings++;
  }

  // Phase 3: ReferralRewards ownership/config sanity
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 3: ReferralRewards Sanity Check");
  console.log("=".repeat(60));

  try {
    const referralRewards = await ethers.getContractAt("ReferralRewards", addresses.referralRewards);

    const owner = await referralRewards.owner();
    const pilotToken = await referralRewards.pilotToken();

    console.log(`  Owner: ${owner}`);
    console.log(`  PILOT token: ${pilotToken}`);

    if (pilotToken.toLowerCase() === addresses.pilotToken.toLowerCase()) {
      console.log("✅ ReferralRewards PILOT token address correct");
      passed++;
    } else {
      console.log("❌ ReferralRewards PILOT token address incorrect");
      warnings++;
    }

    const ownerLower = owner.toLowerCase();
    const safeLower = addresses.safe.toLowerCase();
    const timelockLower = addresses.timelock?.toLowerCase() ?? null;

    if (timelockLower && ownerLower === timelockLower) {
      console.log("✅ ReferralRewards owner is TimelockController");
      passed++;
    } else if (ownerLower === safeLower) {
      console.log("⚠️  ReferralRewards owner is Safe (transfer to Timelock recommended)");
      warnings++;
    } else {
      console.log(`⚠️  ReferralRewards owner is ${owner} (unexpected)`);
      warnings++;
    }

  } catch (error) {
    console.log("❌ Error checking ReferralRewards:", error);
    warnings++;
  }

  // Phase 4: API/Web configuration check
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 4: Configuration Files");
  console.log("=".repeat(60));

  console.log("\n⚠️  Manual verification required:");
  console.log("  1. Check packages/fees/src/config.ts:");
  console.log(`     - FEE_COLLECTOR should be "${addresses.feeCollectorV2}"`);
  console.log("  2. Check .env files:");
  console.log(`     - FEE_COLLECTOR_ADDRESS="${addresses.feeCollectorV2}"`);
  console.log("  3. Redeploy API and Web after config changes");

  // Migration checklist
  console.log("\n" + "=".repeat(60));
  console.log("MIGRATION CHECKLIST");
  console.log("=".repeat(60));

  const checklist = [
    { task: "Deploy FeeCollectorV2", done: passed >= 5 },
    { task: "Transfer ownership to Timelock", done: false }, // Can't check without Timelock address
    { task: "Withdraw funds from V1", done: (await ethers.provider.getBalance(addresses.feeCollectorV1)) === 0n },
    { task: "Transfer funds to V2", done: (await ethers.provider.getBalance(addresses.feeCollectorV2)) > 0n },
    { task: "Transfer ReferralRewards ownership to Timelock", done: false },
    { task: "Update config files", done: false },
    { task: "Redeploy API", done: false },
    { task: "Redeploy Web", done: false },
    { task: "Verify V2 operation", done: false },
  ];

  checklist.forEach((item, i) => {
    const status = item.done ? "✅" : "⏳";
    console.log(`  ${status} ${i + 1}. ${item.task}`);
  });

  const completedTasks = checklist.filter(item => item.done).length;
  console.log(`\n📊 Progress: ${completedTasks}/${checklist.length} tasks completed`);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("VERIFICATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Checks Passed: ${passed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  
  if (warnings === 0) {
    console.log("\n🎉 Migration complete and verified!");
    process.exit(0);
  } else if (warnings <= 3) {
    console.log("\n⚠️  Migration in progress or minor issues found.");
    process.exit(0);
  } else {
    console.log("\n❌ Critical migration issues found. Review before proceeding.");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
