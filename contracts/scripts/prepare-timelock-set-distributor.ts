import { ethers } from 'hardhat';

const DEFAULTS = {
  SAFE: '0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8',
  TIMELOCK: '0xF98a25C78Ba1B8d7bC2D816993faD7E7f825B75b',
  REFERRAL_REWARDS: '0xFC2B872F6eD62fD28eE789E35862E69adeB82698',
} as const;

function envOr(name: string, fallback: string): string {
  return (process.env[name] || fallback).trim();
}

function envOrUndef(name: string): string | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : undefined;
}

function normalizeSalt(value: string): string {
  const v = value.trim();
  if (!v.startsWith('0x')) {
    throw new Error('SALT must be a 0x-prefixed 32-byte hex string');
  }
  if (v.length !== 66) {
    throw new Error(`SALT must be 32 bytes (length 66 incl 0x), got length ${v.length}`);
  }
  return v;
}

type Tx = { label: string; to: string; value: string; data: string };

async function main() {
  const safe = envOr('SAFE', DEFAULTS.SAFE);
  const timelock = envOr('TIMELOCK_ADDRESS', DEFAULTS.TIMELOCK);
  const referralRewardsAddr = envOr('REFERRAL_REWARDS_ADDRESS', DEFAULTS.REFERRAL_REWARDS);
  const distributor = envOr('BACKEND_DISTRIBUTOR', envOr('DISTRIBUTOR', ''));

  if (!ethers.isAddress(distributor)) {
    throw new Error('Missing/invalid BACKEND_DISTRIBUTOR (or DISTRIBUTOR) address');
  }

  const timelockIface = new ethers.Interface([
    'function schedule(address target,uint256 value,bytes data,bytes32 predecessor,bytes32 salt,uint256 delay)',
    'function execute(address target,uint256 value,bytes data,bytes32 predecessor,bytes32 salt) payable',
    'function hashOperation(address target,uint256 value,bytes data,bytes32 predecessor,bytes32 salt) view returns (bytes32)',
    'function getMinDelay() view returns (uint256)',
    'function isOperation(bytes32 id) view returns (bool)',
    'function isOperationPending(bytes32 id) view returns (bool)',
    'function isOperationReady(bytes32 id) view returns (bool)',
    'function isOperationDone(bytes32 id) view returns (bool)',
    'function getTimestamp(bytes32 id) view returns (uint256)',
  ]);

  const rewardsIface = new ethers.Interface([
    'function setDistributor(address distributor,bool allowed)',
    'function owner() view returns (address)',
    'function distributors(address distributor) view returns (bool)',
  ]);

  const timelockContract = new ethers.Contract(timelock, timelockIface, ethers.provider);
  const minDelay = await timelockContract.getMinDelay();

  const rewards = new ethers.Contract(referralRewardsAddr, rewardsIface, ethers.provider);
  const [rewardsOwner, isAlreadyDistributor] = await Promise.all([
    rewards.owner(),
    rewards.distributors(distributor),
  ]);

  const data = rewardsIface.encodeFunctionData('setDistributor', [distributor, true]);
  const predecessor = ethers.ZeroHash;

  const saltEnv = envOrUndef('SALT');
  const saltNonce = envOrUndef('SALT_NONCE');
  const salt = saltEnv
    ? normalizeSalt(saltEnv)
    : ethers.keccak256(
        ethers.toUtf8Bytes(
          `setDistributor:${referralRewardsAddr}:${distributor}:true${saltNonce ? `:${saltNonce}` : ''}`,
        ),
      );

  const operationId = await timelockContract.hashOperation(referralRewardsAddr, 0, data, predecessor, salt);

  const [isOperation, isPending, isReady, isDone, ts] = await Promise.all([
    timelockContract.isOperation(operationId),
    timelockContract.isOperationPending(operationId),
    timelockContract.isOperationReady(operationId),
    timelockContract.isOperationDone(operationId),
    timelockContract.getTimestamp(operationId),
  ]);

  const txs: Tx[] = [
    {
      label: `Timelock.schedule(ReferralRewards.setDistributor(${distributor}, true))`,
      to: timelock,
      value: '0',
      data: timelockIface.encodeFunctionData('schedule', [
        referralRewardsAddr,
        0,
        data,
        predecessor,
        salt,
        minDelay,
      ]),
    },
    {
      label: `Timelock.execute(ReferralRewards.setDistributor(${distributor}, true))  (after delay)`,
      to: timelock,
      value: '0',
      data: timelockIface.encodeFunctionData('execute', [referralRewardsAddr, 0, data, predecessor, salt]),
    },
  ];

  console.log('\nContext:');
  console.log('  Safe:', safe);
  console.log('  Timelock:', timelock);
  console.log('  Timelock minDelay (s):', String(minDelay));
  console.log('  ReferralRewards:', referralRewardsAddr);
  console.log('  ReferralRewards.owner:', rewardsOwner);
  console.log('  Backend distributor:', distributor);
  console.log('  isDistributor(before):', Boolean(isAlreadyDistributor));
  console.log('  Timelock salt:', salt);
  console.log('  Timelock operationId:', operationId);
  console.log('  Timelock op status:', {
    isOperation: Boolean(isOperation),
    isPending: Boolean(isPending),
    isReady: Boolean(isReady),
    isDone: Boolean(isDone),
    timestamp: String(ts),
  });

  if (String(rewardsOwner).toLowerCase() !== timelock.toLowerCase()) {
    console.log(
      `\nWARNING: ReferralRewards.owner is not the Timelock. This operation will revert unless the Timelock is the owner.\n`,
    );
  }

  if (isOperation) {
    console.log(
      '\nNOTE: This operationId already exists on-chain. If Safe simulation reverts on schedule, generate a fresh salt by setting e.g. SALT_NONCE=1 (or any unique string) and rerun this script.\n',
    );
  }

  console.log('\nTransactions (Safe UI → Contract interaction):\n');
  for (const tx of txs) {
    console.log('-'.repeat(80));
    console.log(tx.label);
    console.log('to:   ', tx.to);
    console.log('value:', tx.value);
    console.log('data: ', tx.data);
  }

  console.log('\nSafe Transaction Builder JSON (IMPORTANT: execute after delay):\n');
  console.log(
    JSON.stringify(
      {
        version: '1.0',
        chainId: String((await ethers.provider.getNetwork()).chainId),
        createdAt: Date.now(),
        meta: {
          name: 'SwapPilot Timelock op: setDistributor(backend,true)',
          description: '1) schedule, 2) wait minDelay, 3) execute',
        },
        transactions: txs.map((t) => ({ to: t.to, value: t.value, data: t.data })),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
