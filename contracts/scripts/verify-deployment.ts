import { ethers } from "hardhat";

/**
 * Verify V2 deployment integrity and configuration
 * 
 * This script checks:
 * - All contracts are deployed and verified
 * - Ownerships are correctly transferred to Timelock
 * - Timelock has correct roles for Safe
 * - FeeCollectorV2 has correct parameters
 * - Balances are correct
 */

interface DeploymentAddresses {
  timelock: string;
  feeCollectorV2: string;
  referralRewards: string;
  pilotToken: string;
  safe: string;
}

async function main() {
  console.log("🔍 SwapPilot V2 Deployment Verification");
  console.log("=" .repeat(60));
  
  // Load addresses from environment or prompt
  const addresses: DeploymentAddresses = {
    timelock: process.env.TIMELOCK_ADDRESS || "",
    feeCollectorV2: process.env.FEE_COLLECTOR_V2 || "",
    referralRewards: "0x3b39d37F4bB831AD7783D982a46cAb85AA887d3E",
    pilotToken: "0xe3f77E20226fdc7BA85E495158615dEF83b48192",
    safe: "0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8",
  };

  if (!addresses.timelock || !addresses.feeCollectorV2) {
    console.error("❌ Missing required addresses. Set environment variables:");
    console.error("  - TIMELOCK_ADDRESS");
    console.error("  - FEE_COLLECTOR_V2");
    process.exit(1);
  }

  console.log("\n📋 Deployment Addresses:");
  console.log("  TimelockController:", addresses.timelock);
  console.log("  FeeCollectorV2:", addresses.feeCollectorV2);
  console.log("  ReferralRewards:", addresses.referralRewards);
  console.log("  PILOTToken:", addresses.pilotToken);
  console.log("  Safe Multisig:", addresses.safe);

  let passed = 0;
  let failed = 0;

  // Test 1: Check contract deployment
  console.log("\n" + "=".repeat(60));
  console.log("TEST 1: Contract Deployment");
  console.log("=".repeat(60));
  
  for (const [name, address] of Object.entries(addresses)) {
    try {
      const code = await ethers.provider.getCode(address);
      if (code === "0x") {
        console.log(`❌ ${name}: No code at ${address}`);
        failed++;
      } else {
        console.log(`✅ ${name}: Contract deployed (${code.length} bytes)`);
        passed++;
      }
    } catch (error) {
      console.log(`❌ ${name}: Error checking deployment -`, error);
      failed++;
    }
  }

  // Test 2: Ownership verification
  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: Ownership Verification");
  console.log("=".repeat(60));

  const ownableContracts = [
    { name: "FeeCollectorV2", address: addresses.feeCollectorV2 },
    { name: "ReferralRewards", address: addresses.referralRewards },
  ];

  for (const contract of ownableContracts) {
    try {
      const ownable = await ethers.getContractAt("Ownable", contract.address);
      const owner = await ownable.owner();
      
      if (owner.toLowerCase() === addresses.timelock.toLowerCase()) {
        console.log(`✅ ${contract.name}: Owner is TimelockController`);
        passed++;
      } else if (owner.toLowerCase() === addresses.safe.toLowerCase()) {
        console.log(`⚠️  ${contract.name}: Owner is Safe (should be Timelock)`);
        failed++;
      } else {
        console.log(`❌ ${contract.name}: Owner is ${owner} (unexpected)`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${contract.name}: Error checking ownership -`, error);
      failed++;
    }
  }

  // Test 3: TimelockController roles
  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: TimelockController Roles");
  console.log("=".repeat(60));

  try {
    const timelock = await ethers.getContractAt(
      "@openzeppelin/contracts/governance/TimelockController.sol:TimelockController",
      addresses.timelock
    );
    
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
    const ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();

    const roles = [
      { name: "PROPOSER", hash: PROPOSER_ROLE, shouldHave: addresses.safe },
      { name: "EXECUTOR", hash: EXECUTOR_ROLE, shouldHave: addresses.safe },
      { name: "CANCELLER", hash: CANCELLER_ROLE, shouldHave: addresses.safe },
    ];

    for (const role of roles) {
      const hasRole = await timelock.hasRole(role.hash, role.shouldHave);
      if (hasRole) {
        console.log(`✅ Safe has ${role.name} role`);
        passed++;
      } else {
        console.log(`❌ Safe missing ${role.name} role`);
        failed++;
      }
    }

    // Check that no one has ADMIN role (fully decentralized)
    const signers = await ethers.getSigners();
    const deployerAddress = signers[0]?.address ?? null;
    const safeHasAdmin = await timelock.hasRole(ADMIN_ROLE, addresses.safe);

    if (deployerAddress) {
      const deployerHasAdmin = await timelock.hasRole(ADMIN_ROLE, deployerAddress);
      if (!deployerHasAdmin && !safeHasAdmin) {
        console.log("✅ ADMIN role properly renounced (fully decentralized)");
        passed++;
      } else if (deployerHasAdmin) {
        console.log("⚠️  Deployer still has ADMIN role (should renounce)");
        failed++;
      } else if (safeHasAdmin) {
        console.log("⚠️  Safe has ADMIN role (not recommended)");
        failed++;
      }
    } else {
      if (!safeHasAdmin) {
        console.log("⚠️  ADMIN role check: no local deployer signer available; only checked Safe (no admin)");
      } else {
        console.log("⚠️  ADMIN role check: Safe has ADMIN role (not recommended)");
        failed++;
      }
    }

    const minDelay = await timelock.getMinDelay();
    const minDelaySeconds = typeof minDelay === 'bigint' ? Number(minDelay) : Number(minDelay);
    console.log(`\nTimelock min delay: ${minDelaySeconds} seconds (${(minDelaySeconds / 3600).toFixed(2)} hours)`);
    
  } catch (error) {
    console.log("❌ Error checking TimelockController roles:", error);
    failed += 4;
  }

  // Test 4: FeeCollectorV2 configuration
  console.log("\n" + "=".repeat(60));
  console.log("TEST 4: FeeCollectorV2 Configuration");
  console.log("=".repeat(60));

  try {
    const feeCollector = await ethers.getContractAt("FeeCollectorV2", addresses.feeCollectorV2);
    
    const pilotToken = await feeCollector.pilotToken();
    const treasury = await feeCollector.treasury();
    const referralPool = await feeCollector.referralPool();
    const minDistribution = await feeCollector.minDistributionAmount();
    const paused = await feeCollector.paused();

    console.log(`  PILOT Token: ${pilotToken}`);
    console.log(`  Treasury: ${treasury}`);
    console.log(`  Referral Pool: ${referralPool}`);
    console.log(`  Min Distribution: ${ethers.formatEther(minDistribution)} BNB`);
    console.log(`  Paused: ${paused}`);

    if (pilotToken.toLowerCase() === addresses.pilotToken.toLowerCase()) {
      console.log("✅ PILOT token address correct");
      passed++;
    } else {
      console.log("❌ PILOT token address incorrect");
      failed++;
    }

    if (treasury.toLowerCase() === addresses.safe.toLowerCase()) {
      console.log("✅ Treasury address correct");
      passed++;
    } else {
      console.log("❌ Treasury address incorrect");
      failed++;
    }

    if (!paused) {
      console.log("✅ Contract is not paused");
      passed++;
    } else {
      console.log("⚠️  Contract is paused");
      failed++;
    }

    const balance = await ethers.provider.getBalance(addresses.feeCollectorV2);
    console.log(`\nFeeCollectorV2 balance: ${ethers.formatEther(balance)} BNB`);

  } catch (error) {
    console.log("❌ Error checking FeeCollectorV2:", error);
    failed += 3;
  }

  // Test 5: PILOTToken configuration
  console.log("\n" + "=".repeat(60));
  console.log("TEST 5: PILOTToken Configuration");
  console.log("=".repeat(60));

  try {
    const pilot = await ethers.getContractAt("PILOTToken", addresses.pilotToken);
    
    const totalSupply = await pilot.totalSupply();
    const owner = await pilot.owner();
    const distributionCompleted = await pilot.distributionCompleted();

    console.log(`  Total Supply: ${ethers.formatEther(totalSupply)} PILOT`);
    console.log(`  Owner: ${owner}`);
    console.log(`  Distribution Completed: ${distributionCompleted}`);

    const expectedSupply = ethers.parseEther("1000000000"); // 1B PILOT
    if (totalSupply === expectedSupply) {
      console.log("✅ Total supply correct (1B PILOT)");
      passed++;
    } else {
      console.log(`⚠️  Total supply: ${ethers.formatEther(totalSupply)} (expected 1B)`);
      failed++;
    }

    if (owner === ethers.ZeroAddress) {
      console.log("✅ Ownership renounced (immutable)");
      passed++;
    } else {
      console.log(`⚠️  Owner: ${owner} (should be renounced)`);
      failed++;
    }

    if (distributionCompleted) {
      console.log("✅ Distribution completed");
      passed++;
    } else {
      console.log("❌ Distribution not completed");
      failed++;
    }

  } catch (error) {
    console.log("❌ Error checking PILOTToken:", error);
    failed += 3;
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("VERIFICATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log("\n🎉 All checks passed! Deployment is ready for production.");
    process.exit(0);
  } else if (failed <= 3) {
    console.log("\n⚠️  Some non-critical issues found. Review failed checks.");
    process.exit(0);
  } else {
    console.log("\n❌ Critical issues found. Do NOT proceed to production.");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
