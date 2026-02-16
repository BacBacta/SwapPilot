import { ethers } from 'hardhat';

const DEFAULTS = {
  SAFE: '0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8',
  TIMELOCK: '0xF98a25C78Ba1B8d7bC2D816993faD7E7f825B75b',
  FEE_COLLECTOR_V2: '0x2083B8b745Ff78c6a00395b1800469c0Dddc966c',
  // Updated deployments (2026-02-16)
  REFERRAL_REWARDS: '0xFC2B872F6eD62fD28eE789E35862E69adeB82698',
  REFERRAL_POOL: '0xC02CE39b6807B146397e12Eeb76DaeEDa840e055',
} as const;

function envAddr(key: string, fallback: string): string {
  const raw = process.env[key];
  if (!raw) return fallback;
  return raw.trim();
}

async function getCodeSize(address: string): Promise<number> {
  const code = await ethers.provider.getCode(address);
  // "0x" => 0 bytes
  return Math.max(0, (code.length - 2) / 2);
}

async function tryReadOwner(address: string): Promise<string | null> {
  try {
    const c = new ethers.Contract(address, ['function owner() view returns (address)'], ethers.provider);
    return (await c.owner()) as string;
  } catch {
    return null;
  }
}

async function tryReadPaused(address: string): Promise<boolean | null> {
  try {
    const c = new ethers.Contract(address, ['function paused() view returns (bool)'], ethers.provider);
    return (await c.paused()) as boolean;
  } catch {
    return null;
  }
}

async function main() {
  const SAFE = envAddr('SAFE_ADDRESS', DEFAULTS.SAFE);
  const TIMELOCK = envAddr('TIMELOCK_ADDRESS', DEFAULTS.TIMELOCK);
  const FEE_COLLECTOR_V2 = envAddr('FEE_COLLECTOR_V2_ADDRESS', DEFAULTS.FEE_COLLECTOR_V2);
  const REFERRAL_REWARDS = envAddr('REFERRAL_REWARDS_ADDRESS', DEFAULTS.REFERRAL_REWARDS);
  const REFERRAL_POOL = envAddr('REFERRAL_POOL_ADDRESS', DEFAULTS.REFERRAL_POOL);

  const timelock = await ethers.getContractAt(
    '@openzeppelin/contracts/governance/TimelockController.sol:TimelockController',
    TIMELOCK,
  );

  const feeCollectorV2 = await ethers.getContractAt('FeeCollectorV2', FEE_COLLECTOR_V2);

  const [
    minDelay,
    proposerRole,
    executorRole,
    cancellerRole,
    adminRole,
    feeCollectorOwner,
    safeCodeSize,
    timelockCodeSize,
    feeCollectorV2CodeSize,
    referralRewardsCodeSize,
    referralPoolCodeSize,
    referralRewardsOwner,
    referralPoolOwner,
    referralRewardsPaused,
    referralPoolPaused,
  ] = await Promise.all([
    timelock.getMinDelay(),
    timelock.PROPOSER_ROLE(),
    timelock.EXECUTOR_ROLE(),
    timelock.CANCELLER_ROLE(),
    timelock.DEFAULT_ADMIN_ROLE(),
    feeCollectorV2.owner(),
    getCodeSize(SAFE),
    getCodeSize(TIMELOCK),
    getCodeSize(FEE_COLLECTOR_V2),
    getCodeSize(REFERRAL_REWARDS),
    getCodeSize(REFERRAL_POOL),
    tryReadOwner(REFERRAL_REWARDS),
    tryReadOwner(REFERRAL_POOL),
    tryReadPaused(REFERRAL_REWARDS),
    tryReadPaused(REFERRAL_POOL),
  ]);

  const [
    safeIsProposer,
    safeIsExecutor,
    safeIsCanceller,
    safeIsAdmin,
    timelockIsProposer,
    timelockIsExecutor,
    timelockIsCanceller,
    timelockIsAdmin,
  ] = await Promise.all([
    timelock.hasRole(proposerRole, SAFE),
    timelock.hasRole(executorRole, SAFE),
    timelock.hasRole(cancellerRole, SAFE),
    timelock.hasRole(adminRole, SAFE),
    timelock.hasRole(proposerRole, TIMELOCK),
    timelock.hasRole(executorRole, TIMELOCK),
    timelock.hasRole(cancellerRole, TIMELOCK),
    timelock.hasRole(adminRole, TIMELOCK),
  ]);

  const output = {
    network: 'bsc',
    addresses: {
      safe: SAFE,
      timelock: TIMELOCK,
      feeCollectorV2: FEE_COLLECTOR_V2,
      referralRewards: REFERRAL_REWARDS,
      referralPool: REFERRAL_POOL,
    },
    codeSizeBytes: {
      safe: safeCodeSize,
      timelock: timelockCodeSize,
      feeCollectorV2: feeCollectorV2CodeSize,
      referralRewards: referralRewardsCodeSize,
      referralPool: referralPoolCodeSize,
    },
    warnings: [
      ...(referralRewardsOwner === null ? ['ReferralRewards.owner() not readable (address may be wrong ABI/address)'] : []),
      ...(referralRewardsPaused === null ? ['ReferralRewards.paused() not readable (address may be wrong ABI/address)'] : []),
      ...(referralPoolOwner === null ? ['ReferralPool.owner() not readable (address may be a Safe/EOA, not ReferralPool)'] : []),
      ...(referralPoolPaused === null ? ['ReferralPool.paused() not readable (address may be a Safe/EOA, not ReferralPool)'] : []),
    ],
    timelock: {
      minDelaySeconds: Number(minDelay),
      roles: {
        PROPOSER_ROLE: proposerRole,
        EXECUTOR_ROLE: executorRole,
        CANCELLER_ROLE: cancellerRole,
        DEFAULT_ADMIN_ROLE: adminRole,
      },
      roleChecks: {
        safe: {
          proposer: safeIsProposer,
          executor: safeIsExecutor,
          canceller: safeIsCanceller,
          admin: safeIsAdmin,
        },
        timelockSelf: {
          proposer: timelockIsProposer,
          executor: timelockIsExecutor,
          canceller: timelockIsCanceller,
          admin: timelockIsAdmin,
        },
      },
    },
    feeCollectorV2: {
      owner: feeCollectorOwner,
      expectedOwner: TIMELOCK,
      ownerIsTimelock: feeCollectorOwner.toLowerCase() === TIMELOCK.toLowerCase(),
    },
    referralRewards: {
      owner: referralRewardsOwner,
      expectedOwner: TIMELOCK,
      ownerIsTimelock:
        typeof referralRewardsOwner === 'string' && referralRewardsOwner.toLowerCase() === TIMELOCK.toLowerCase(),
      paused: referralRewardsPaused,
    },
    referralPool: {
      owner: referralPoolOwner,
      expectedOwner: TIMELOCK,
      ownerIsTimelock:
        typeof referralPoolOwner === 'string' && referralPoolOwner.toLowerCase() === TIMELOCK.toLowerCase(),
      paused: referralPoolPaused,
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
