"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://swappilot-api.fly.dev";

export type PilotTier = "none" | "bronze" | "silver" | "gold";

export type FeeCalculation = {
  feeApplies: boolean;
  baseFeesBps: number;
  discountPercent: number;
  finalFeeBps: number;
  feeAmountUsd: number;
  pilotTier: PilotTier;
  pilotBalance: string;
  freeThresholdUsd: number;
  distribution: {
    burnPercent: number;
    treasuryPercent: number;
    referralPercent: number;
  };
};

export type PilotTierInfo = {
  tier: PilotTier;
  discountPercent: number;
  balance: string;
  balanceFormatted: string;
  nextTier: {
    name: string;
    requiredBalance: string;
    additionalNeeded: string;
    discountPercent: number;
  } | null;
};

/**
 * Fetch fee calculation for a swap
 */
async function fetchFeeCalculation(
  swapValueUsd: number,
  userAddress?: string
): Promise<FeeCalculation> {
  const res = await fetch(`${API_URL}/v1/fees/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ swapValueUsd, userAddress }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch fee calculation");
  }

  return res.json();
}

/**
 * Fetch PILOT tier info for a user
 */
async function fetchPilotTier(userAddress: string): Promise<PilotTierInfo> {
  const res = await fetch(`${API_URL}/v1/pilot/tier`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userAddress }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch PILOT tier");
  }

  return res.json();
}

/**
 * Hook to get fee calculation for a swap
 */
export function useFeeCalculation(swapValueUsd: number) {
  const { address } = useAccount();

  return useQuery({
    queryKey: ["feeCalculation", swapValueUsd, address],
    queryFn: () => fetchFeeCalculation(swapValueUsd, address),
    enabled: swapValueUsd > 0,
    staleTime: 30_000, // 30 seconds
    gcTime: 60_000,
  });
}

/**
 * Hook to get PILOT tier info
 */
export function usePilotTier() {
  const { address, isConnected } = useAccount();

  return useQuery({
    queryKey: ["pilotTier", address],
    queryFn: () => fetchPilotTier(address!),
    enabled: isConnected && Boolean(address),
    staleTime: 60_000, // 1 minute
    gcTime: 300_000, // 5 minutes
  });
}

/**
 * Format fee for display
 */
export function formatFee(feeBps: number): string {
  if (feeBps === 0) return "Free";
  return `${(feeBps / 100).toFixed(2)}%`;
}

/**
 * Get tier display info
 */
export function getTierDisplay(tier: PilotTier): {
  name: string;
  color: string;
  emoji: string;
} {
  switch (tier) {
    case "gold":
      return { name: "Gold", color: "text-yellow-500", emoji: "🥇" };
    case "silver":
      return { name: "Silver", color: "text-gray-400", emoji: "🥈" };
    case "bronze":
      return { name: "Bronze", color: "text-orange-600", emoji: "🥉" };
    default:
      return { name: "None", color: "text-sp-muted", emoji: "" };
  }
}

/**
 * Format PILOT balance for display
 */
export function formatPilotBalance(balanceWei: string): string {
  try {
    const balance = BigInt(balanceWei);
    const whole = balance / (10n ** 18n);
    
    if (whole >= 10_000n) {
      return `${(Number(whole) / 1000).toFixed(1)}K`;
    }
    if (whole >= 1_000n) {
      return `${Number(whole).toLocaleString()}`;
    }
    return whole.toString();
  } catch {
    return "0";
  }
}
