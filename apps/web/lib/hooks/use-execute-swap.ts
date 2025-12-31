"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useChainId, useSendTransaction, useWaitForTransactionReceipt, useEstimateGas, usePublicClient } from "wagmi";
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
  const chainId = useChainId();
  const publicClient = usePublicClient();
  
  const [status, setStatus] = useState<SwapStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [builtTx, setBuiltTx] = useState<BuiltTransaction | null>(null);
  const [submittedTxHash, setSubmittedTxHash] = useState<`0x${string}` | undefined>(undefined);

  // Send transaction hook
  const {
    sendTransaction,
    sendTransactionAsync,
    data: txHash,
    isPending: isSendPending,
    reset: resetSendTx,
  } = useSendTransaction({
    mutation: {
      onSuccess: (hash) => {
        console.info("[swap][sendTransaction] submitted", {
          txHash: hash,
          providerId: builtTx?.providerId,
        });
        setSubmittedTxHash(hash);
        setStatus("pending");
      },
      onError: (err) => {
        console.error("[swap][sendTransaction] error", {
          message: err.message,
          name: err.name,
          cause: (err as unknown as { cause?: unknown })?.cause,
          providerId: builtTx?.providerId,
          builtTx,
        });
        setError(err.message);
        setStatus("error");
      },
    },
  });

  // Wait for transaction receipt
  const {
    data: txReceipt,
    error: txReceiptError,
    isError: isTxReceiptError,
    isLoading: isWaitingReceipt,
    isSuccess: isTxConfirmed,
  } = useWaitForTransactionReceipt({
    chainId,
    hash: submittedTxHash ?? txHash,
    // Retry more aggressively for faster feedback
    query: {
      enabled: Boolean(submittedTxHash ?? txHash),
      retry: 60, // Retry up to 60 times
      retryDelay: 3000, // Every 3 seconds = 3 minutes total
    },
  });

  // Timeout: if still pending after 3 minutes, show error
  useEffect(() => {
    const hash = submittedTxHash ?? txHash;
    if (!hash || status !== "pending") return;

    const timeoutId = setTimeout(() => {
      if (status === "pending" && !isTxConfirmed && !isTxReceiptError) {
        console.warn("[swap][receipt] timeout - transaction may have failed to broadcast", {
          hash,
          chainId,
        });
        setError("Transaction timeout - the transaction may not have been broadcast to the network. Check your wallet or block explorer.");
        setStatus("error");
      }
    }, 180_000); // 3 minutes

    return () => clearTimeout(timeoutId);
  }, [submittedTxHash, txHash, status, isTxConfirmed, isTxReceiptError, chainId]);

  // Debug: log receipt polling state
  useEffect(() => {
    const hash = submittedTxHash ?? txHash;
    if (!hash) return;
    console.info("[swap][receipt] polling", {
      hash,
      chainId,
      isWaitingReceipt,
      isTxConfirmed,
      isTxReceiptError,
      status,
      receiptStatus: txReceipt?.status,
    });
  }, [submittedTxHash, txHash, chainId, isWaitingReceipt, isTxConfirmed, isTxReceiptError, status, txReceipt?.status]);

  // Update status when transaction is confirmed
  useEffect(() => {
    if (!isTxConfirmed) return;
    if (status !== "pending") return;

    console.info("[swap][receipt] confirmed", {
      txHash: submittedTxHash ?? txHash,
      providerId: builtTx?.providerId,
      receiptStatus: txReceipt?.status,
    });
    setStatus("success");
  }, [isTxConfirmed, status, txHash, submittedTxHash, builtTx?.providerId, txReceipt?.status]);

  useEffect(() => {
    if (!isTxReceiptError) return;
    if (status !== "pending") return;

    const message = txReceiptError instanceof Error ? txReceiptError.message : "Failed to fetch transaction receipt";
    console.error("[swap][receipt] error", {
      txHash: submittedTxHash ?? txHash,
      providerId: builtTx?.providerId,
      message,
      err: txReceiptError,
    });
    setError(message);
    setStatus("error");
  }, [isTxReceiptError, status, txHash, submittedTxHash, builtTx?.providerId, txReceiptError]);

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
      console.info("[swap][buildTx] request", {
        providerId: params.providerId,
        sellToken: params.sellToken,
        buyToken: params.buyToken,
        sellAmount: params.sellAmount,
        slippageBps: params.slippageBps,
        hasQuoteRaw: Boolean(params.quoteRaw),
      });

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
        const rawText = await res.text().catch(() => "");
        let parsed: unknown = null;
        try {
          parsed = rawText ? JSON.parse(rawText) : null;
        } catch {
          parsed = rawText;
        }

        console.error("[swap][buildTx] http_error", {
          status: res.status,
          providerId: params.providerId,
          response: parsed,
        });

        const message =
          typeof parsed === "object" && parsed && "message" in (parsed as any)
            ? String((parsed as any).message)
            : `HTTP ${res.status}`;
        throw new Error(message || "Failed to build transaction");
      }

      const tx = await res.json() as BuiltTransaction;

      console.info("[swap][buildTx] success", {
        providerId: tx.providerId,
        to: tx.to,
        value: tx.value,
        gas: tx.gas,
        dataPrefix: typeof tx.data === "string" ? tx.data.slice(0, 10) : null,
      });

      setBuiltTx(tx);
      setStatus("awaiting-approval");
      return tx;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";

      console.error("[swap][buildTx] error", {
        providerId: params.providerId,
        message,
        err,
      });

      setError(message);
      setStatus("error");
      return null;
    }
  }, [isConnected, userAddress]);

  // Execute the swap transaction with pre-flight simulation
  const executeSwap = useCallback(async (tx?: BuiltTransaction) => {
    const transaction = tx || builtTx;
    
    if (!transaction) {
      setError("No transaction to execute");
      setStatus("error");
      return;
    }

    if (!isConnected || !userAddress) {
      setError("Wallet not connected");
      setStatus("error");
      return;
    }

    setError(null);

    const txRequest = {
      to: transaction.to as Address,
      data: transaction.data as `0x${string}`,
      value: BigInt(transaction.value || "0"),
      account: userAddress,
    };

    // Step 1: Estimate gas to simulate the transaction before sending
    // This catches revert errors early with better messages
    let estimatedGas: bigint | undefined;
    try {
      if (publicClient) {
        console.info("[swap][execute] estimating gas...", {
          providerId: transaction.providerId,
          to: transaction.to,
        });
        
        estimatedGas = await publicClient.estimateGas(txRequest);
        
        console.info("[swap][execute] gas estimated", {
          providerId: transaction.providerId,
          estimatedGas: estimatedGas.toString(),
          providedGas: transaction.gas,
        });
      }
    } catch (estimateError) {
      // Gas estimation failed = transaction would revert
      const errMsg = estimateError instanceof Error ? estimateError.message : "Unknown error";
      
      // Parse common revert reasons
      let userMessage = "Transaction would fail: ";
      if (errMsg.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
        userMessage += "Slippage too low. Try increasing slippage tolerance.";
      } else if (errMsg.includes("INSUFFICIENT_LIQUIDITY")) {
        userMessage += "Not enough liquidity for this swap.";
      } else if (errMsg.includes("TRANSFER_FROM_FAILED") || errMsg.includes("TransferHelper")) {
        userMessage += "Token transfer failed. Check approval or token balance.";
      } else if (errMsg.includes("EXPIRED")) {
        userMessage += "Quote expired. Please refresh and try again.";
      } else if (errMsg.includes("insufficient funds") || errMsg.includes("insufficient balance")) {
        userMessage += "Insufficient balance for gas + value.";
      } else {
        userMessage += errMsg.slice(0, 200);
      }

      console.error("[swap][execute] simulation failed", {
        providerId: transaction.providerId,
        error: errMsg,
        userMessage,
      });
      
      setError(userMessage);
      setStatus("error");
      return;
    }

    // Use estimated gas with 20% buffer, or provided gas
    const gas = (() => {
      if (estimatedGas) {
        // Add 20% buffer to estimated gas
        return (estimatedGas * 120n) / 100n;
      }
      if (!transaction.gas) return undefined;
      try {
        const gasValue = BigInt(transaction.gas);
        return gasValue > 0n ? gasValue : undefined;
      } catch {
        return undefined;
      }
    })();

    console.info("[swap][execute] sending transaction", {
      providerId: transaction.providerId,
      to: transaction.to,
      value: transaction.value,
      gas: gas?.toString(),
      dataPrefix: typeof transaction.data === "string" ? transaction.data.slice(0, 10) : null,
    });

    // Step 2: Send the transaction
    try {
      const hash = await sendTransactionAsync({
        to: transaction.to as Address,
        data: transaction.data as `0x${string}`,
        value: BigInt(transaction.value || "0"),
        gas,
      });
      
      console.info("[swap][execute] transaction sent", {
        hash,
        providerId: transaction.providerId,
      });
      
      // Note: onSuccess callback handles setSubmittedTxHash and setStatus
    } catch (sendError) {
      // This catches wallet rejections and RPC errors during broadcast
      const errMsg = sendError instanceof Error ? sendError.message : "Unknown error";
      
      let userMessage = errMsg;
      if (errMsg.includes("User rejected") || errMsg.includes("user rejected") || errMsg.includes("User denied")) {
        userMessage = "Transaction cancelled by user";
      } else if (errMsg.includes("nonce")) {
        userMessage = "Nonce error - please try again";
      } else if (errMsg.includes("replacement transaction underpriced")) {
        userMessage = "A pending transaction exists. Wait or speed up the previous transaction.";
      }

      console.error("[swap][execute] send failed", {
        providerId: transaction.providerId,
        error: errMsg,
        userMessage,
      });
      
      setError(userMessage);
      setStatus("error");
    }
  }, [builtTx, isConnected, userAddress, publicClient, sendTransactionAsync]);

  // Reset state
  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setBuiltTx(null);
    setSubmittedTxHash(undefined);
    resetSendTx();
  }, [resetSendTx]);

  return {
    status,
    error,
    txHash: submittedTxHash ?? txHash,
    builtTx,
    buildTransaction,
    executeSwap,
    reset,
    isBuilding: status === "building",
    isPending: status === "pending" || isSendPending || isWaitingReceipt,
    isSuccess: status === "success",
  };
}
