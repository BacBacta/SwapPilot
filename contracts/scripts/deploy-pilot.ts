import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying PILOT token with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  // Deploy PILOT token
  const PILOTToken = await ethers.getContractFactory("PILOTToken");
  const pilot = await PILOTToken.deploy();
  
  await pilot.waitForDeployment();
  const pilotAddress = await pilot.getAddress();
  
  console.log("✅ PILOT Token deployed to:", pilotAddress);
  
  // All 1 billion tokens go to Treasury
  const TREASURY = "0xa5ad3569b95f56a2777206934f2af8a4b4c5d8be";
  const TOTAL_SUPPLY = ethers.parseEther("1000000000"); // 1 billion
  
  const distributions = [
    { name: "Treasury", address: TREASURY, amount: TOTAL_SUPPLY },
  ];
  
  console.log("\n📦 Initial Distribution:");
  
  const recipients = distributions.map(d => d.address);
  const amounts = distributions.map(d => d.amount);
  
  const tx = await pilot.initialDistribution(recipients, amounts);
  await tx.wait();
  
  for (const dist of distributions) {
    console.log(`  - ${dist.name}: ${ethers.formatEther(dist.amount)} PILOT`);
  }
  
  // Complete distribution (locks minting)
  const completeTx = await pilot.completeDistribution();
  await completeTx.wait();
  console.log("\n🔒 Distribution completed - minting locked forever");
  
  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(50));
  console.log(`PILOT Token: ${pilotAddress}`);
  console.log(`Total Supply: ${ethers.formatEther(await pilot.totalSupply())} PILOT`);
  console.log(`Distribution Locked: ${await pilot.distributionCompleted()}`);
  console.log("=".repeat(50));
  
  console.log("\n📝 Next steps:");
  console.log("1. Verify contract on BscScan:");
  console.log(`   npx hardhat verify --network bsc ${pilotAddress}`);
  console.log("2. Update PILOT_TOKEN address in packages/fees/src/config.ts");
  console.log("3. Add liquidity on PancakeSwap");
  console.log("4. Deploy FeeCollector contract");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
