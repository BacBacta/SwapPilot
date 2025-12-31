import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Renouncing ownership with account:", deployer.address);

  const PILOT_TOKEN = "0xe3f77E20226fdc7BA85E495158615dEF83b48192";

  // Get PILOT token contract
  const pilot = await ethers.getContractAt("PILOTToken", PILOT_TOKEN);
  
  // Check current owner
  const currentOwner = await pilot.owner();
  console.log("Current owner:", currentOwner);
  
  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ You are not the owner of this contract");
    process.exit(1);
  }

  // Verify distribution is completed
  const distributionCompleted = await pilot.distributionCompleted();
  console.log("Distribution completed:", distributionCompleted);
  
  if (!distributionCompleted) {
    console.error("❌ Distribution not completed yet. Complete it first.");
    process.exit(1);
  }

  // Renounce ownership
  console.log("\n⚠️  WARNING: This action is IRREVERSIBLE!");
  console.log("After renouncing, no one can modify the contract.");
  console.log("\nRenouncing ownership...");
  
  const tx = await pilot.renounceOwnership();
  await tx.wait();
  
  // Verify new owner is zero address
  const newOwner = await pilot.owner();
  console.log("\n✅ Ownership renounced!");
  console.log("New owner:", newOwner);
  console.log("\nThe PILOT token is now fully decentralized.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
