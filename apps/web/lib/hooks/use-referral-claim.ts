"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, type Address } from "viem";
import { referralPoolAbi, REFERRAL_POOL_ADDRESS } from "@/lib/abi/referral-pool";

export type UseReferralClaimReturn = {
  // Pending rewards in wei
  pendingRewards: bigint;
  // Pending rewards formatted as string (in BNB)
  pendingRewardsFormatted: string;
  // Total claimed by this user
  totalClaimed: bigint;
  totalClaimedFormatted: string;
  // Loading states
  isLoading: boolean;
  isClaiming: boolean;
  // Claim success
  isClaimSuccess: boolean;
  // Claim transaction hash
  claimHash: `0x${string}` | undefined;
  // Error
  error: Error | null;
  // Minimum claim amount
  minClaimAmount: bigint;
  // Can claim (has pending >= minClaimAmount)
  canClaim: boolean;
  // Actions
  claim: () => void;
  refetch: () => void;
  // Reset claim state (after success modal)
  resetClaimState: () => void;
};

export function useReferralClaim(): UseReferralClaimReturn {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const [error, setError] = useState<Error | null>(null);
  const [isClaimSuccess, setIsClaimSuccess] = useState(false);

  // Read pending rewards
  const {
    data: pendingRewards,
    isLoading: isLoadingPending,
    refetch: refetchPending,
  } = useReadContract({
    address: REFERRAL_POOL_ADDRESS as Address,
    abi: referralPoolAbi,
    functionName: "pendingRewards",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: Boolean(userAddress),
    },
  });

  // Read total claimed
  const {
    data: totalClaimed,
    isLoading: isLoadingClaimed,
    refetch: refetchClaimed,
  } = useReadContract({
    address: REFERRAL_POOL_ADDRESS as Address,
    abi: referralPoolAbi,
    functionName: "totalClaimed",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: Boolean(userAddress),
    },
  });

  // Read minimum claim amount
  const {
    data: minClaimAmount,
  } = useReadContract({
    address: REFERRAL_POOL_ADDRESS as Address,
    abi: referralPoolAbi,
    functionName: "minClaimAmount",
    query: {
      enabled: true,
    },
  });

  // Write claim
  const {
    writeContract,
    data: claimHash,
    isPending: isWritePending,
    reset: resetWrite,
  } = useWriteContract({
    mutation: {
      onError: (err) => {
        console.error("[referral][claim] error", {
          message: err.message,
          name: err.name,
        });
        setError(err);
      },
    },
  });

  // Wait for claim transaction
  const {
    error: claimReceiptError,
    isError: isClaimReceiptError,
    isLoading: isWaitingForTx,
    isSuccess: isClaimConfirmed,
  } = useWaitForTransactionReceipt({
    chainId,
    hash: claimHash,
    query: {
      enabled: Boolean(claimHash),
    },
  });

  // Handle receipt error
  useEffect(() => {
    if (!isClaimReceiptError) return;
    if (!(claimReceiptError instanceof Error)) return;
    setError(claimReceiptError);
  }, [isClaimReceiptError, claimReceiptError]);

  // Handle claim success - refetch balances
  useEffect(() => {
    if (isClaimConfirmed) {
      setIsClaimSuccess(true);
      refetchPending();
      refetchClaimed();
    }
  }, [isClaimConfirmed, refetchPending, refetchClaimed]);

  const isClaiming = isWritePending || isWaitingForTx;

  // Check if user can claim
  const canClaim = (() => {
    if (!userAddress) return false;
    if (!pendingRewards) return false;
    const minAmount = minClaimAmount ?? 0n;
    return pendingRewards >= minAmount && pendingRewards > 0n;
  })();

  // Claim rewards
  const claim = useCallback(() => {
    if (!userAddress) return;
    console.info("[referral][claim] request", { userAddress });
    setError(null);
    setIsClaimSuccess(false);
    writeContract({
      address: REFERRAL_POOL_ADDRESS as Address,
      abi: referralPoolAbi,
      functionName: "claim",
      args: [],
    });
  }, [userAddress, writeContract]);

  // Refetch both pending and claimed
  const refetch = useCallback(() => {
    refetchPending();
    refetchClaimed();
  }, [refetchPending, refetchClaimed]);

  // Reset claim state
  const resetClaimState = useCallback(() => {
    setIsClaimSuccess(false);
    setError(null);
    resetWrite();
  }, [resetWrite]);

  return {
    pendingRewards: pendingRewards ?? 0n,
    pendingRewardsFormatted: pendingRewards ? formatEther(pendingRewards) : "0",
    totalClaimed: totalClaimed ?? 0n,
    totalClaimedFormatted: totalClaimed ? formatEther(totalClaimed) : "0",
    isLoading: isLoadingPending || isLoadingClaimed,
    isClaiming,
    isClaimSuccess,
    claimHash,
    error,
    minClaimAmount: minClaimAmount ?? 0n,
    canClaim,
    claim,
    refetch,
    resetClaimState,
  };
}
