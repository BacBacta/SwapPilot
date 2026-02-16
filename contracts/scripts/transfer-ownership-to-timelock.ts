import { ethers } from 'hardhat';

const DEFAULTS = {
  TIMELOCK: '0xF98a25C78Ba1B8d7bC2D816993faD7E7f825B75b',
  REFERRAL_POOL: '0xC02CE39b6807B146397e12Eeb76DaeEDa840e055',
  REFERRAL_REWARDS: '0xFC2B872F6eD62fD28eE789E35862E69adeB82698',
} as const;

function envOr(name: string, fallback: string): string {
  return (process.env[name] || fallback).trim();
}

async function main() {
  const timelock = envOr('TIMELOCK_ADDRESS', DEFAULTS.TIMELOCK);
  const referralPoolAddr = envOr('REFERRAL_POOL_ADDRESS', DEFAULTS.REFERRAL_POOL);
  const referralRewardsAddr = envOr('REFERRAL_REWARDS_ADDRESS', DEFAULTS.REFERRAL_REWARDS);

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('No deployer signer available');

  console.log('Deployer:', deployer.address);
  console.log('Timelock:', timelock);
  console.log('ReferralPool:', referralPoolAddr);
  console.log('ReferralRewards:', referralRewardsAddr);

  const referralPool = await ethers.getContractAt('ReferralPool', referralPoolAddr);
  const referralRewards = await ethers.getContractAt('ReferralRewards', referralRewardsAddr);

  const poolOwnerBefore = await referralPool.owner();
  const rewardsOwnerBefore = await referralRewards.owner();

  console.log('ReferralPool.owner (before):', poolOwnerBefore);
  console.log('ReferralRewards.owner (before):', rewardsOwnerBefore);

  if (poolOwnerBefore.toLowerCase() !== timelock.toLowerCase()) {
    console.log('Transferring ReferralPool ownership to Timelock...');
    const tx = await referralPool.transferOwnership(timelock);
    console.log('tx:', tx.hash);
    await tx.wait(1);
  } else {
    console.log('ReferralPool already owned by Timelock.');
  }

  if (rewardsOwnerBefore.toLowerCase() !== timelock.toLowerCase()) {
    console.log('Transferring ReferralRewards ownership to Timelock...');
    const tx = await referralRewards.transferOwnership(timelock);
    console.log('tx:', tx.hash);
    await tx.wait(1);
  } else {
    console.log('ReferralRewards already owned by Timelock.');
  }

  console.log('ReferralPool.owner (after):', await referralPool.owner());
  console.log('ReferralRewards.owner (after):', await referralRewards.owner());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
