"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { erc20Abi, type Address, maxUint256 } from "viem";

export type UseTokenApprovalParams = {
  tokenAddress: Address | undefined;
  spenderAddress: Address | undefined;
  amount: bigint;
};

export type UseTokenApprovalReturn = {
  // Current allowance
  allowance: bigint;
  isLoading: boolean;
  
  // Approval state
  needsApproval: boolean;
  isApproving: boolean;
  isApproved: boolean;
  
  // Actions
  approve: () => void;
  approveExact: (amount: bigint) => void;
  
  // Transaction state
  approvalHash: `0x${string}` | undefined;
  error: Error | null;
  
  // Refetch allowance
  refetchAllowance: () => void;
};

const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE".toLowerCase();
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function useTokenApproval({
  tokenAddress,
  spenderAddress,
  amount,
}: UseTokenApprovalParams): UseTokenApprovalReturn {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const [error, setError] = useState<Error | null>(null);

  // Check if this is a native token (no approval needed)
  const isNativeToken = useMemo(() => {
    if (!tokenAddress) return false;
    const lower = tokenAddress.toLowerCase();
    return lower === NATIVE_TOKEN || lower === ZERO_ADDRESS;
  }, [tokenAddress]);

  // Read current allowance
  const {
    data: allowance,
    isLoading: isLoadingAllowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: userAddress && spenderAddress ? [userAddress, spenderAddress] : undefined,
    query: {
      enabled: Boolean(tokenAddress && spenderAddress && userAddress && !isNativeToken),
    },
  });

  // Write approval
  const {
    writeContract,
    data: approvalHash,
    isPending: isWritePending,
    reset: resetWrite,
  } = useWriteContract({
    mutation: {
      onError: (err) => {
        console.error("[swap][approve] error", {
          message: err.message,
          name: err.name,
          tokenAddress,
          spenderAddress,
        });
        setError(err);
      },
    },
  });

  // Wait for approval transaction
  const {
    error: approvalReceiptError,
    isError: isApprovalReceiptError,
    isLoading: isWaitingForTx,
    isSuccess: isApprovalConfirmed,
  } = useWaitForTransactionReceipt({
    chainId,
    hash: approvalHash,
    query: {
      enabled: Boolean(approvalHash),
    },
  });

  useEffect(() => {
    if (!isApprovalReceiptError) return;
    if (!(approvalReceiptError instanceof Error)) return;
    setError(approvalReceiptError);
  }, [isApprovalReceiptError, approvalReceiptError]);

  // Refetch allowance when approval is confirmed
  useEffect(() => {
    if (isApprovalConfirmed) {
      console.info("[swap][approve] confirmed, refetching allowance", {
        tokenAddress,
        approvalHash,
      });
      refetchAllowance();
    }
  }, [isApprovalConfirmed, refetchAllowance, tokenAddress, approvalHash]);

  const isApproving = isWritePending || isWaitingForTx;

  // Check if approval is needed
  const needsApproval = useMemo(() => {
    if (isNativeToken) return false;
    if (!tokenAddress || !spenderAddress || !userAddress) return false;
    if (allowance === undefined) return true;
    return allowance < amount;
  }, [isNativeToken, tokenAddress, spenderAddress, userAddress, allowance, amount]);

  const isApproved = useMemo(() => {
    if (isNativeToken) return true;
    if (allowance === undefined) return false;
    return allowance >= amount;
  }, [isNativeToken, allowance, amount]);

  // Approve infinite (max uint256)
  const approve = useCallback(() => {
    if (!tokenAddress || !spenderAddress) return;
    console.info("[swap][approve] request", {
      tokenAddress,
      spenderAddress,
      mode: "infinite",
    });
    setError(null);
    writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [spenderAddress, maxUint256],
    });
  }, [tokenAddress, spenderAddress, writeContract]);

  // Approve exact amount
  const approveExact = useCallback((exactAmount: bigint) => {
    if (!tokenAddress || !spenderAddress) return;
    console.info("[swap][approve] request", {
      tokenAddress,
      spenderAddress,
      mode: "exact",
      exactAmount: exactAmount.toString(),
    });
    setError(null);
    writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [spenderAddress, exactAmount],
    });
  }, [tokenAddress, spenderAddress, writeContract]);

  return {
    allowance: allowance ?? 0n,
    isLoading: isLoadingAllowance,
    needsApproval,
    isApproving,
    isApproved: isApproved || isApprovalConfirmed,
    approve,
    approveExact,
    approvalHash,
    error,
    refetchAllowance: () => { refetchAllowance(); },
  };
}
