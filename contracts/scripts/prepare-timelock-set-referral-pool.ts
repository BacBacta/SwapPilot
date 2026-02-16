import { ethers } from 'hardhat';

const DEFAULTS = {
  SAFE: '0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8',
  TIMELOCK: '0xF98a25C78Ba1B8d7bC2D816993faD7E7f825B75b',
  FEE_COLLECTOR_V2: '0x2083B8b745Ff78c6a00395b1800469c0Dddc966c',
  NEW_REFERRAL_POOL: '0xC02CE39b6807B146397e12Eeb76DaeEDa840e055',
} as const;

function envOr(name: string, fallback: string): string {
  return (process.env[name] || fallback).trim();
}

type Tx = { label: string; to: string; value: string; data: string };

async function main() {
  const safe = envOr('SAFE', DEFAULTS.SAFE);
  const timelock = envOr('TIMELOCK_ADDRESS', DEFAULTS.TIMELOCK);
  const feeCollectorV2 = envOr('FEE_COLLECTOR_V2', DEFAULTS.FEE_COLLECTOR_V2);
  const newReferralPool = envOr('NEW_REFERRAL_POOL', DEFAULTS.NEW_REFERRAL_POOL);

  const timelockIface = new ethers.Interface([
    'function schedule(address target,uint256 value,bytes data,bytes32 predecessor,bytes32 salt,uint256 delay)',
    'function execute(address target,uint256 value,bytes data,bytes32 predecessor,bytes32 salt) payable',
    'function hashOperation(address target,uint256 value,bytes data,bytes32 predecessor,bytes32 salt) view returns (bytes32)',
    'function getMinDelay() view returns (uint256)',
  ]);

  const feeCollectorIface = new ethers.Interface([
    'function setReferralPool(address _referralPool)',
    'function referralPool() view returns (address)',
    'function owner() view returns (address)',
  ]);

  const fee = await ethers.getContractAt('FeeCollectorV2', feeCollectorV2);
  const currentPool = await fee.referralPool();
  const owner = await fee.owner();

  const timelockContract = new ethers.Contract(timelock, timelockIface, ethers.provider);
  const minDelay = await timelockContract.getMinDelay();

  const data = feeCollectorIface.encodeFunctionData('setReferralPool', [newReferralPool]);
  const predecessor = ethers.ZeroHash;
  const salt = ethers.keccak256(ethers.toUtf8Bytes(`setReferralPool:${feeCollectorV2}:${newReferralPool}`));
  const operationId = await timelockContract.hashOperation(feeCollectorV2, 0, data, predecessor, salt);

  const txs: Tx[] = [
    {
      label: `Timelock.schedule(FeeCollectorV2.setReferralPool(${newReferralPool}))`,
      to: timelock,
      value: '0',
      data: timelockIface.encodeFunctionData('schedule', [feeCollectorV2, 0, data, predecessor, salt, minDelay]),
    },
    {
      label: `Timelock.execute(FeeCollectorV2.setReferralPool(${newReferralPool}))  (after delay)`,
      to: timelock,
      value: '0',
      data: timelockIface.encodeFunctionData('execute', [feeCollectorV2, 0, data, predecessor, salt]),
    },
  ];

  console.log('\nContext:');
  console.log('  Safe:', safe);
  console.log('  Timelock:', timelock);
  console.log('  Timelock minDelay (s):', String(minDelay));
  console.log('  FeeCollectorV2:', feeCollectorV2);
  console.log('  FeeCollectorV2.owner:', owner);
  console.log('  FeeCollectorV2.referralPool (current):', currentPool);
  console.log('  FeeCollectorV2.referralPool (new):', newReferralPool);
  console.log('  Timelock operationId:', operationId);

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
          name: 'SwapPilot Timelock op: setReferralPool',
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
