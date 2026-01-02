import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying ReferralPool with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  // Deploy ReferralPool
  const ReferralPool = await ethers.getContractFactory("ReferralPool");
  const referralPool = await ReferralPool.deploy();
  
  await referralPool.waitForDeployment();
  const referralPoolAddress = await referralPool.getAddress();
  
  console.log("\n✅ ReferralPool deployed to:", referralPoolAddress);
  
  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(50));
  console.log(`ReferralPool: ${referralPoolAddress}`);
  console.log(`Owner: ${deployer.address}`);
  console.log(`Min Claim Amount: 0.001 BNB`);
  console.log("=".repeat(50));
  
  console.log("\n📝 Next steps:");
  console.log("1. Verify contract on BscScan:");
  console.log(`   npx hardhat verify --network bsc ${referralPoolAddress}`);
  console.log("2. Update REFERRAL_POOL_ADDRESS in:");
  console.log("   - apps/web/lib/abi/referral-pool.ts");
  console.log("   - contracts/scripts/deploy-fee-collector.ts");
  console.log("3. If FeeCollector is already deployed, call setReferralPool():");
  console.log(`   FeeCollector.setReferralPool("${referralPoolAddress}")`);
  console.log("4. Fund the pool with some BNB for initial rewards");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
