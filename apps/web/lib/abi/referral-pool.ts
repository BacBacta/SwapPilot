/**
 * ReferralPool ABI - Minimal ABI for frontend interactions
 */
export const referralPoolAbi = [
  // Read functions
  {
    type: "function",
    name: "pendingRewards",
    inputs: [{ name: "referrer", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalClaimed",
    inputs: [{ name: "referrer", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "addressToCode",
    inputs: [{ name: "referrer", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getReferrerInfo",
    inputs: [{ name: "referrer", type: "address" }],
    outputs: [
      { name: "pending", type: "uint256" },
      { name: "claimed", type: "uint256" },
      { name: "code", type: "bytes32" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPoolStats",
    inputs: [],
    outputs: [
      { name: "balance", type: "uint256" },
      { name: "allocated", type: "uint256" },
      { name: "claimed", type: "uint256" },
      { name: "available", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "minClaimAmount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getReferrerByCode",
    inputs: [{ name: "code", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  // Write functions
  {
    type: "function",
    name: "claim",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "registerReferralCode",
    inputs: [{ name: "code", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Events
  {
    type: "event",
    name: "RewardsClaimed",
    inputs: [
      { name: "referrer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ReferralCodeRegistered",
    inputs: [
      { name: "referrer", type: "address", indexed: true },
      { name: "code", type: "bytes32", indexed: false },
    ],
  },
] as const;

// ReferralPool address on BSC
export const REFERRAL_POOL_ADDRESS = "0xe810e4cfa68620cb51cd68618642ee1d44382f45" as const;
