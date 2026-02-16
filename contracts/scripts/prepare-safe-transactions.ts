import { ethers } from "hardhat";

/**
 * Prepare calldata for Safe multisig transactions
 *
 * Outputs ready-to-paste targets + calldata for Safe UI (Contract Interaction)
 * and/or Safe Transaction Builder.
 *
 * Usage examples:
 *   TIMELOCK_ADDRESS=0x... FEECOLLECTOR_V2=0x... npx hardhat run scripts/prepare-safe-transactions.ts --network bsc
 *   TIMELOCK_ADDRESS=0x... FEECOLLECTOR_V2=0x... AMOUNT_WEI=123 npx hardhat run scripts/prepare-safe-transactions.ts --network bsc
 */

const DEFAULTS = {
  SAFE: "0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8",
  FEE_COLLECTOR_V1: "0xEe841Def61326C116F92e71FceF8cb11FBC05034",
  REFERRAL_REWARDS: "0x3b39d37F4bB831AD7783D982a46cAb85AA887d3E",
  NATIVE_TOKEN: ethers.ZeroAddress,
} as const;

type Tx = {
  label: string;
  to: string;
  value: string;
  data: string;
};

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

function envOr(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

async function main() {
  const timelock = mustEnv("TIMELOCK_ADDRESS");
  const feeCollectorV2 = mustEnv("FEECOLLECTOR_V2");

  const safe = envOr("SAFE", DEFAULTS.SAFE);
  const feeCollectorV1 = envOr("FEE_COLLECTOR_V1", DEFAULTS.FEE_COLLECTOR_V1);
  const referralRewards = envOr("REFERRAL_REWARDS", DEFAULTS.REFERRAL_REWARDS);

  const amountWei = process.env.AMOUNT_WEI; // optional

  const ownableIface = new ethers.Interface([
    "function transferOwnership(address newOwner)",
  ]);

  const feeCollectorIface = new ethers.Interface([
    "function emergencyWithdraw(address token,uint256 amount)",
  ]);

  const txs: Tx[] = [];

  txs.push({
    label: "FeeCollectorV2.transferOwnership(Timelock)",
    to: feeCollectorV2,
    value: "0",
    data: ownableIface.encodeFunctionData("transferOwnership", [timelock]),
  });

  txs.push({
    label: "ReferralRewards.transferOwnership(Timelock)",
    to: referralRewards,
    value: "0",
    data: ownableIface.encodeFunctionData("transferOwnership", [timelock]),
  });

  if (amountWei) {
    txs.push({
      label: "FeeCollectorV1.emergencyWithdraw(NATIVE, AMOUNT_WEI) → Safe",
      to: feeCollectorV1,
      value: "0",
      data: feeCollectorIface.encodeFunctionData("emergencyWithdraw", [DEFAULTS.NATIVE_TOKEN, amountWei]),
    });
  }

  console.log("\nSafe context:");
  console.log("  Safe:", safe);
  console.log("  Timelock:", timelock);
  console.log("  FeeCollectorV2:", feeCollectorV2);
  console.log("  FeeCollectorV1:", feeCollectorV1);
  console.log("  ReferralRewards:", referralRewards);

  console.log("\nTransactions (paste into Safe UI → New transaction → Contract interaction):\n");
  for (const tx of txs) {
    console.log("-".repeat(80));
    console.log(tx.label);
    console.log("to:   ", tx.to);
    console.log("value:", tx.value);
    console.log("data: ", tx.data);
  }

  console.log("\nSafe Transaction Builder JSON (minimal):\n");
  console.log(
    JSON.stringify(
      {
        version: "1.0",
        chainId: String((await ethers.provider.getNetwork()).chainId),
        createdAt: Date.now(),
        meta: {
          name: "SwapPilot governance/migration",
          description: "Ownership transfers + optional migration withdraw",
        },
        transactions: txs.map((tx) => ({
          to: tx.to,
          value: tx.value,
          data: tx.data,
        })),
      },
      null,
      2
    )
  );

  console.log("\nNotes:");
  console.log("- If you want to withdraw ALL BNB from FeeCollectorV1, first read its balance on BscScan or via cast, then rerun with AMOUNT_WEI=<balanceWei>.");
  console.log("- After V1 withdraw executes, send BNB from Safe to FeeCollectorV2 using a normal 'Send' transaction.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
