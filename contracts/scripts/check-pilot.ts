import { ethers } from "hardhat";

async function main() {
  const PILOT_TOKEN = "0xe3f77E20226fdc7BA85E495158615dEF83b48192";
  const pilot = await ethers.getContractAt("PILOTToken", PILOT_TOKEN);
  
  console.log("PILOT Token Status:");
  console.log("=".repeat(40));
  console.log("Owner:", await pilot.owner());
  console.log("Distribution completed:", await pilot.distributionCompleted());
  console.log("Total supply:", ethers.formatEther(await pilot.totalSupply()), "PILOT");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
