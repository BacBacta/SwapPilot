import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ReferralRewards with account:", deployer.address);

  // Get PILOT token address from environment or use a placeholder
  const pilotTokenAddress = process.env.PILOT_TOKEN_ADDRESS;
  if (!pilotTokenAddress) {
    console.error("Error: PILOT_TOKEN_ADDRESS environment variable not set");
    console.log("Usage: PILOT_TOKEN_ADDRESS=0x... npx hardhat run scripts/deploy-referral-rewards.ts --network bsc");
    process.exit(1);
  }

  console.log("PILOT Token:", pilotTokenAddress);

  // Deploy ReferralRewards
  const ReferralRewards = await ethers.getContractFactory("ReferralRewards");
  const referralRewards = await ReferralRewards.deploy(pilotTokenAddress);
  await referralRewards.waitForDeployment();

  const address = await referralRewards.getAddress();
  console.log("ReferralRewards deployed to:", address);

  // Display allocation info
  const allocation = await referralRewards.REFERRAL_ALLOCATION();
  console.log("\n=== Referral Rewards Configuration ===");
  console.log("Total PILOT Allocation:", ethers.formatEther(allocation), "PILOT (5% of supply)");
  console.log("Reward Rate:", ethers.formatEther(await referralRewards.rewardRatePerDollar()), "PILOT per $1 swapped");
  console.log("Min Swap Volume:", ethers.formatEther(await referralRewards.minSwapVolumeUsd()), "USD");
  console.log("Max Reward Per Swap:", ethers.formatEther(await referralRewards.maxRewardPerSwap()), "PILOT");

  console.log("\n=== Next Steps ===");
  console.log("1. Transfer 50,000,000 PILOT to the ReferralRewards contract");
  console.log("2. Set authorized distributors (API backend address)");
  console.log("3. Verify contract on BscScan");
  console.log("\nExample commands:");
  console.log(`   npx hardhat verify --network bsc ${address} ${pilotTokenAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
