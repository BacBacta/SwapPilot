import { ethers } from "hardhat";

/**
 * Deploy OpenZeppelin TimelockController for governance
 * 
 * This adds a time delay (24-48 hours) to all admin operations,
 * protecting against instant rug-pulls via emergencyWithdraw.
 * 
 * Roles:
 * - PROPOSER: Can schedule operations (Safe multisig)
 * - EXECUTOR: Can execute operations after delay (Safe multisig)
 * - CANCELLER: Can cancel scheduled operations (Safe multisig)
 * - ADMIN: Can grant/revoke roles (renounced after setup)
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
        "- Re-run: npx hardhat run scripts/deploy-timelock.ts --network bsc",
      ].join("\n")
    );
  }

  const [deployer] = signers;

  console.log("Deploying TimelockController with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "BNB"
  );

  // Configuration
  const SAFE = "0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8"; // Safe multisig
  const MIN_DELAY = 24 * 60 * 60; // 24 hours (86400 seconds)
  
  // Alternative: 48 hours for extra security
  // const MIN_DELAY = 48 * 60 * 60; // 48 hours

  const proposers = [SAFE]; // Only Safe can propose operations
  const executors = [SAFE]; // Only Safe can execute after delay
  const admin = deployer.address; // Deployer is initial admin (will renounce)

  console.log("\n📋 TimelockController parameters:");
  console.log("  - Minimum delay:", MIN_DELAY, "seconds (", MIN_DELAY / 3600, "hours)");
  console.log("  - Proposers:", proposers);
  console.log("  - Executors:", executors);
  console.log("  - Admin (temporary):", admin);

  // Deploy TimelockController
  console.log("\n🚀 Deploying TimelockController...");
  const TimelockController = await ethers.getContractFactory("TimelockController");
  const timelock = await TimelockController.deploy(
    MIN_DELAY,
    proposers,
    executors,
    admin
  );
  
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  
  console.log("✅ TimelockController deployed to:", timelockAddress);

  // Verify roles
  console.log("\n🔍 Verifying roles...");
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
  const ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();

  const safeIsProposer = await timelock.hasRole(PROPOSER_ROLE, SAFE);
  const safeIsExecutor = await timelock.hasRole(EXECUTOR_ROLE, SAFE);
  const safeIsCanceller = await timelock.hasRole(CANCELLER_ROLE, SAFE);
  const deployerIsAdmin = await timelock.hasRole(ADMIN_ROLE, deployer.address);

  console.log("  Safe is PROPOSER:", safeIsProposer);
  console.log("  Safe is EXECUTOR:", safeIsExecutor);
  console.log("  Safe is CANCELLER:", safeIsCanceller);
  console.log("  Deployer is ADMIN:", deployerIsAdmin);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("TIMELOCK DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`TimelockController: ${timelockAddress}`);
  console.log(`Minimum delay: ${MIN_DELAY}s (${MIN_DELAY / 3600}h)`);
  console.log(`Safe multisig: ${SAFE}`);
  console.log(`Current admin: ${admin} (MUST renounce after setup)`);
  console.log("=".repeat(60));

  console.log("\n📝 Next steps:");
  console.log("\n1. Verify TimelockController on BscScan:");
  console.log(`   npx hardhat verify --network bsc ${timelockAddress} ${MIN_DELAY} "[${JSON.stringify(proposers)}]" "[${JSON.stringify(executors)}]" ${admin}`);
  
  console.log("\n2. Transfer ownership of contracts to Timelock:");
  console.log("   - FeeCollectorV2");
  console.log("   - ReferralRewards");
  console.log("   - ReferralPool");
  console.log("   Use: contract.transferOwnership(timelockAddress)");

  console.log("\n3. Renounce ADMIN role on TimelockController:");
  console.log("   ⚠️  CRITICAL: After verifying all roles are set correctly!");
  console.log("   await timelock.renounceRole(ADMIN_ROLE, deployer.address)");
  console.log("   This makes the Timelock fully decentralized (only Safe can manage it)");

  console.log("\n4. Update documentation:");
  console.log("   - Add TimelockController address to README.md");
  console.log("   - Add to packages/fees/src/config.ts");
  console.log("   - Document Safe operation workflow");

  console.log("\n⏱️  How to use TimelockController:");
  console.log("All admin operations now require 2 steps:");
  console.log("  1. Schedule operation (via Safe proposal)");
  console.log("  2. Wait", MIN_DELAY / 3600, "hours");
  console.log("  3. Execute operation (via Safe execution)");
  console.log("\nExample: emergencyWithdraw now requires 24h public notice");

  console.log("\n⚠️  SAVE THIS ADDRESS:");
  console.log(`   TimelockController: ${timelockAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
