"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useChainId, useSendTransaction, useWaitForTransactionReceipt, useEstimateGas, usePublicClient } from "wagmi";
import type { Address } from "viem";
import type { ProviderQuoteRaw, ProviderQuoteNormalized } from "@swappilot/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://swappilot-api.fly.dev";

type ErrorInfo = {
  name?: string;
  message: string;
  shortMessage?: string;
  details?: string;
  code?: unknown;
  data?: unknown;
  metaMessages?: unknown;
  causeType?: string;
  causeMessage?: string;
};

function getErrorInfo(err: unknown): ErrorInfo {
  if (!err || typeof err !== "object") {
    return { message: String(err) };
  }

  const anyErr = err as Record<string, unknown>;
  const cause = anyErr.cause;
  const causeMessage =
    cause && typeof cause === "object" && "message" in cause && typeof (cause as { message?: unknown }).message === "string"
      ? String((cause as { message?: unknown }).message)
      : undefined;

  return {
    name: typeof anyErr.name === "string" ? anyErr.name : undefined,
    message: typeof anyErr.message === "string" ? anyErr.message : String(err),
    shortMessage: typeof anyErr.shortMessage === "string" ? anyErr.shortMessage : undefined,
    details: typeof anyErr.details === "string" ? anyErr.details : undefined,
    code: anyErr.code,
    data: anyErr.data,
    metaMessages: Array.isArray(anyErr.metaMessages) ? anyErr.metaMessages : undefined,
    causeType: cause ? typeof cause : undefined,
    causeMessage,
  };
}

export type SwapParams = {
  providerId: string;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  slippageBps: number;
  sellTokenDecimals?: number;
  buyTokenDecimals?: number;
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
          errorInfo: getErrorInfo(err),
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
    // Retry aggressively for faster feedback
    query: {
      enabled: Boolean(submittedTxHash ?? txHash),
      retry: 15, // Retry up to 15 times
      retryDelay: 3000, // Every 3 seconds = 45 seconds total
    },
  });

  // Timeout: if still pending after 45 seconds, show error and allow reset
  useEffect(() => {
    const hash = submittedTxHash ?? txHash;
    if (!hash || status !== "pending") return;

    const timeoutId = setTimeout(() => {
      if (status === "pending" && !isTxConfirmed && !isTxReceiptError) {
        console.warn("[swap][receipt] timeout - transaction may have failed to broadcast", {
          hash,
          chainId,
        });
        setError("Transaction not found on-chain. It may not have been broadcast. Check MetaMask activity or try again.");
        setStatus("error");
      }
    }, 45_000); // 45 seconds

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
      errorInfo: getErrorInfo(txReceiptError),
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
        sellTokenDecimals: params.sellTokenDecimals,
        buyTokenDecimals: params.buyTokenDecimals,
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
          sellTokenDecimals: params.sellTokenDecimals,
          buyTokenDecimals: params.buyTokenDecimals,
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
  // skipSimulation: bypass gas estimation for fee-on-transfer tokens
  const executeSwap = useCallback(async (tx?: BuiltTransaction, skipSimulation = false) => {
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

    // Step 0: Pre-check balance to detect wallet sync issues early
    if (publicClient && txRequest.value > 0n) {
      try {
        const currentBalance = await publicClient.getBalance({ address: userAddress });
        const requiredValue = txRequest.value;
        
        console.info("[swap][execute] balance check", {
          currentBalance: currentBalance.toString(),
          requiredValue: requiredValue.toString(),
          sufficient: currentBalance >= requiredValue,
        });
        
        if (currentBalance < requiredValue) {
          const haveFormatted = (Number(currentBalance) / 1e18).toFixed(6);
          const needFormatted = (Number(requiredValue) / 1e18).toFixed(6);
          setError(`Insufficient BNB balance: you have ${haveFormatted} BNB but need at least ${needFormatted} BNB (plus gas). Please add more BNB to your wallet.`);
          setStatus("error");
          return;
        }
      } catch (balanceError) {
        console.warn("[swap][execute] balance check failed, continuing...", balanceError);
        // Don't block on balance check failure, let the simulation catch it
      }
    }

    // Step 1: Estimate gas to simulate the transaction before sending
    // This catches revert errors early with better messages
    // Skip simulation for fee-on-transfer tokens (skipSimulation=true)
    let estimatedGas: bigint | undefined;
    
    if (skipSimulation) {
      console.info("[swap][execute] skipping simulation (fee-on-transfer token)", {
        providerId: transaction.providerId,
      });
      // Use a generous fixed gas limit for fee-on-transfer tokens
      estimatedGas = 500_000n;
    } else {
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
        console.error("[swap][execute] simulation error", {
          providerId: transaction.providerId,
          error: errMsg,
          errorInfo: getErrorInfo(estimateError),
          txRequest: {
            to: transaction.to,
            value: transaction.value,
            dataPrefix: typeof transaction.data === "string" ? transaction.data.slice(0, 10) : null,
          },
        });
        
        // Check if this is a fee-on-transfer token error or simulation-only failure
        // Some taxed tokens report misleading "insufficient allowance" during simulation
        // but work fine when actually executed
        const isFeeOnTransferError = 
          errMsg.includes("External call failed") ||
          errMsg.includes("TRANSFER_FROM_FAILED") ||
          errMsg.includes("TransferHelper") ||
          errMsg.includes("STF") ||
          // 1inch ReturnAmountIsNotEnough (0x064a4ec6) - often caused by fee-on-transfer tokens
          errMsg.includes("0x064a4ec6") ||
          errMsg.includes("ReturnAmountIsNotEnough") ||
          // Generic slippage errors that may indicate fee-on-transfer
          errMsg.includes("INSUFFICIENT_OUTPUT_AMOUNT") ||
          errMsg.includes("Too little received") ||
          errMsg.includes("MinReturnError") ||
          // ParaSwap specific slippage error
          errMsg.includes("less then expected") ||
          errMsg.includes("less than expected") ||
          // Taxed tokens often fail simulation with allowance errors even when approved
          (errMsg.includes("insufficient allowance") && errMsg.includes("execution reverted"));
        
        if (isFeeOnTransferError) {
          console.warn("[swap][execute] detected fee-on-transfer token or slippage error, bypassing simulation", {
            providerId: transaction.providerId,
            error: errMsg.slice(0, 300),
          });
          
          // For ParaSwap specifically, simulation failures often mean on-chain failure too
          // Recommend trying a different provider
          if (transaction.providerId === "paraswap") {
            setError("ParaSwap simulation failed for this token. Please try OpenOcean or another provider from the list.");
            setStatus("error");
            return;
          }
          
          // For other providers, bypass simulation and proceed
          // The user has already accepted the slippage tolerance.
          return executeSwap(transaction, true);
        }
        
        // Parse common revert reasons for better UX
        let userMessage = "Transaction would fail: ";
      
      // 1inch ReturnAmountIsNotEnough error (0x064a4ec6)
      if (errMsg.includes("0x064a4ec6") || errMsg.includes("ReturnAmountIsNotEnough")) {
        userMessage = "Price moved too much since quote. Increase slippage or refresh the quote.";
      }
      // 1inch AccessDenied / BadSignature / SwapFailed (0xf4059071) - usually allowance or stale quote
      else if (errMsg.includes("0xf4059071")) {
        userMessage = "Swap failed: Token approval may be insufficient or quote is stale. Please refresh and try again.";
      }
      // Generic slippage errors
      else if (errMsg.includes("INSUFFICIENT_OUTPUT_AMOUNT") || errMsg.includes("Too little received")) {
        userMessage = "Slippage too low. Try increasing slippage tolerance.";
      } 
      // Liquidity errors
      else if (errMsg.includes("INSUFFICIENT_LIQUIDITY") || errMsg.includes("INSUFFICIENT_INPUT_AMOUNT")) {
        userMessage = "Not enough liquidity for this swap.";
      } 
      // Token transfer errors (common with fee-on-transfer tokens)
      else if (errMsg.includes("TRANSFER_FROM_FAILED") || errMsg.includes("TransferHelper") || errMsg.includes("STF")) {
        userMessage = "Token transfer failed. Check approval or token balance.";
      } 
      // Quote/deadline expired
      else if (errMsg.includes("EXPIRED") || errMsg.includes("Transaction too old")) {
        userMessage = "Quote expired. Please refresh and try again.";
      } 
      // Balance issues - enhanced detection with wallet sync hint
      else if (errMsg.includes("insufficient funds") || errMsg.includes("insufficient balance")) {
        // Check if this might be a wallet sync issue
        const haveMatch = errMsg.match(/have\s+(\d+)/);
        const wantMatch = errMsg.match(/want\s+(\d+)/);
        
        if (haveMatch?.[1] && wantMatch?.[1]) {
          const have = BigInt(haveMatch[1]);
          const want = BigInt(wantMatch[1]);
          const haveFormatted = (Number(have) / 1e18).toFixed(6);
          const wantFormatted = (Number(want) / 1e18).toFixed(6);
          
          // If reported balance is very low but user expects more, suggest wallet resync
          if (have < want / 10n) {
            userMessage = `Wallet sync issue detected. Your wallet reports ${haveFormatted} BNB but needs ${wantFormatted} BNB. Try: 1) Refresh the page, 2) Disconnect and reconnect your wallet, 3) Clear MetaMask activity data in Settings → Advanced.`;
          } else {
            userMessage = `Insufficient balance: have ${haveFormatted} BNB, need ${wantFormatted} BNB (including gas).`;
          }
        } else {
          userMessage = "Insufficient balance for gas + value. Try refreshing the page or reconnecting your wallet.";
        }
      }
      // 0x Protocol errors
      else if (errMsg.includes("IncompleteFillError") || errMsg.includes("OrderNotFillableError")) {
        userMessage = "Order could not be filled. Try a different provider or smaller amount.";
      }
      // ParaSwap errors
      else if (errMsg.includes("InvalidBalance") || errMsg.includes("BadBalance")) {
        userMessage = "Balance check failed. Ensure you have enough tokens.";
      }
      // OpenOcean errors
      else if (errMsg.includes("MinReturnError")) {
        userMessage = "Price slipped too much. Increase slippage or refresh quote.";
      }
      // Fallback: show truncated error
      else {
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
    } // Close else block (skipSimulation)

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
        errorInfo: getErrorInfo(sendError),
        txRequest: {
          to: transaction.to,
          value: transaction.value,
          gas: gas?.toString(),
          dataPrefix: typeof transaction.data === "string" ? transaction.data.slice(0, 10) : null,
        },
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
