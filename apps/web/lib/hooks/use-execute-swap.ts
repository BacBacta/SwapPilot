"use client";

import { useState, useCallback } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import type { Address } from "viem";
import type { ProviderQuoteRaw, ProviderQuoteNormalized } from "@swappilot/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://swappilot-api.fly.dev";

export type SwapParams = {
  providerId: string;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  slippageBps: number;
  quoteRaw?: ProviderQuoteRaw;
  quoteNormalized?: ProviderQuoteNormalized;
};

export type BuiltTransaction = {
  to: string;
  data: string;
  value: string;
  gas?: string;
  gasPrice?: string;
  providerId: string;
  approvalAddress?: string;
};

export type SwapStatus = 
  | "idle"
  | "building"      // Fetching calldata from API
  | "awaiting-approval" // Waiting for user to approve
  | "pending"       // Transaction sent, waiting for confirmation
  | "success"       // Transaction confirmed
  | "error";        // Something went wrong

export type UseExecuteSwapReturn = {
  // State
  status: SwapStatus;
  error: string | null;
  txHash: `0x${string}` | undefined;
  
  // Built transaction (for approval flow)
  builtTx: BuiltTransaction | null;
  
  // Actions
  buildTransaction: (params: SwapParams) => Promise<BuiltTransaction | null>;
  executeSwap: (tx?: BuiltTransaction) => void;
  reset: () => void;
  
  // Derived state
  isBuilding: boolean;
  isPending: boolean;
  isSuccess: boolean;
};

export function useExecuteSwap(): UseExecuteSwapReturn {
  const { address: userAddress, isConnected } = useAccount();
  
  const [status, setStatus] = useState<SwapStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [builtTx, setBuiltTx] = useState<BuiltTransaction | null>(null);

  // Send transaction hook
  const {
    sendTransaction,
    data: txHash,
    isPending: isSendPending,
    reset: resetSendTx,
  } = useSendTransaction({
    mutation: {
      onSuccess: () => {
        setStatus("pending");
      },
      onError: (err) => {
        setError(err.message);
        setStatus("error");
      },
    },
  });

  // Wait for transaction receipt
  const { isLoading: isWaitingReceipt, isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Update status when transaction is confirmed
  if (isTxConfirmed && status === "pending") {
    setStatus("success");
  }

  // Build transaction from API
  const buildTransaction = useCallback(async (params: SwapParams): Promise<BuiltTransaction | null> => {
    if (!isConnected || !userAddress) {
      setError("Wallet not connected");
      setStatus("error");
      return null;
    }

    setStatus("building");
    setError(null);

    try {
      const res = await fetch(`${API_URL}/v1/build-tx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          providerId: params.providerId,
          sellToken: params.sellToken,
          buyToken: params.buyToken,
          sellAmount: params.sellAmount,
          slippageBps: params.slippageBps,
          account: userAddress,
          quoteRaw: params.quoteRaw,
          quoteNormalized: params.quoteNormalized,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(data.message || `Failed to build transaction`);
      }

      const tx = await res.json() as BuiltTransaction;
      setBuiltTx(tx);
      setStatus("awaiting-approval");
      return tx;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setStatus("error");
      return null;
    }
  }, [isConnected, userAddress]);

  // Execute the swap transaction
  const executeSwap = useCallback((tx?: BuiltTransaction) => {
    const transaction = tx || builtTx;
    
    if (!transaction) {
      setError("No transaction to execute");
      setStatus("error");
      return;
    }

    if (!isConnected) {
      setError("Wallet not connected");
      setStatus("error");
      return;
    }

    setError(null);

    sendTransaction({
      to: transaction.to as Address,
      data: transaction.data as `0x${string}`,
      value: BigInt(transaction.value || "0"),
      gas: transaction.gas ? BigInt(transaction.gas) : undefined,
    });
  }, [builtTx, isConnected, sendTransaction]);

  // Reset state
  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setBuiltTx(null);
    resetSendTx();
  }, [resetSendTx]);

  return {
    status,
    error,
    txHash,
    builtTx,
    buildTransaction,
    executeSwap,
    reset,
    isBuilding: status === "building",
    isPending: status === "pending" || isSendPending || isWaitingReceipt,
    isSuccess: status === "success",
  };
}
