import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying FeeCollector with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  // Contract addresses
  const PILOT_TOKEN = "0xe3f77E20226fdc7BA85E495158615dEF83b48192";
  const TREASURY = "0xa5ad3569b95f56a2777206934f2af8a4b4c5d8be";
  const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // PancakeSwap V2 Router
  const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"; // WBNB on BSC

  console.log("\n📋 Constructor parameters:");
  console.log("  - PILOT Token:", PILOT_TOKEN);
  console.log("  - Treasury (85%):", TREASURY);
  console.log("  - PancakeSwap Router:", PANCAKE_ROUTER);
  console.log("  - WBNB:", WBNB);

  // Deploy FeeCollector
  const FeeCollector = await ethers.getContractFactory("FeeCollector");
  const feeCollector = await FeeCollector.deploy(
    PILOT_TOKEN,
    TREASURY,
    PANCAKE_ROUTER,
    WBNB
  );
  
  await feeCollector.waitForDeployment();
  const feeCollectorAddress = await feeCollector.getAddress();
  
  console.log("\n✅ FeeCollector deployed to:", feeCollectorAddress);
  
  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(50));
  console.log(`FeeCollector: ${feeCollectorAddress}`);
  console.log(`PILOT Token: ${PILOT_TOKEN}`);
  console.log(`Treasury (85%): ${TREASURY}`);
  console.log(`Burn (15%): Via PancakeSwap buyback`);
  console.log("=".repeat(50));
  console.log("\nNote: Referral rewards are now paid in PILOT tokens");
  console.log("      from the ReferralRewards contract (5% of supply)");
  
  console.log("\n📝 Next steps:");
  console.log("1. Verify contract on BscScan:");
  console.log(`   npx hardhat verify --network bsc ${feeCollectorAddress} ${PILOT_TOKEN} ${TREASURY} ${PANCAKE_ROUTER} ${WBNB}`);
  console.log("2. Update FEE_COLLECTOR address in packages/fees/src/config.ts");
  console.log("3. Configure API to send fees to this contract");
  console.log("4. Deploy ReferralRewards contract for PILOT-based referrals");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
