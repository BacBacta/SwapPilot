"use client";

import { useAccount, useBalance, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { bsc } from "wagmi/chains";
import { useMemo, useCallback } from "react";

import type { TokenInfo } from "@/lib/tokens";

// ERC20 ABI for balanceOf
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/* ========================================
   TYPES
   ======================================== */
export interface TokenBalance {
  symbol: string;
  address: `0x${string}`;
  balance: string;
  balanceFormatted: string;
  decimals: number;
}

export interface UseTokenBalancesReturn {
  balances: Record<string, TokenBalance>;
  isLoading: boolean;
  isConnected: boolean;
  address: string | undefined;
  error: Error | null;
  getBalance: (token: Pick<TokenInfo, "address" | "symbol">) => string;
  getBalanceFormatted: (token: Pick<TokenInfo, "address" | "symbol">) => string;
  refetch: () => void;
}

/* ========================================
   HOOK: useTokenBalances
   ======================================== */
export function useTokenBalances(tokens: TokenInfo[] = []): UseTokenBalancesReturn {
  const { address, isConnected } = useAccount();

  const nativeToken = useMemo(() => tokens.find((t) => t.isNative), [tokens]);
  const erc20Tokens = useMemo(() => tokens.filter((t) => !t.isNative), [tokens]);

  // Fetch native BNB balance
  const {
    data: nativeBalance,
    isLoading: isLoadingNative,
    error: nativeError,
    refetch: refetchNative,
  } = useBalance({
    address,
    chainId: bsc.id,
    query: {
      enabled: isConnected && !!address && !!nativeToken,
      staleTime: 15_000,
      refetchInterval: 30_000,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    },
  });

  // Batch read ERC20 balances
  const {
    data: erc20Balances,
    isLoading: isLoadingErc20,
    error: erc20Error,
    refetch: refetchErc20,
  } = useReadContracts({
    contracts: erc20Tokens.map((token) => ({
      address: token.address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address!],
      chainId: bsc.id,
    })),
    query: {
      enabled: isConnected && !!address,
      staleTime: 15_000,
      refetchInterval: 30_000,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    },
  });

  // Combine loading & error states from both queries
  const isLoading = isLoadingNative || isLoadingErc20;
  const error = useMemo<Error | null>(() => {
    if (nativeError) return nativeError;
    if (erc20Error) return erc20Error;
    return null;
  }, [nativeError, erc20Error]);

  // Parse balances into a map
  const balances = useMemo(() => {
    const result: Record<string, TokenBalance> = {};

    // Add native BNB balance
    if (nativeBalance && nativeToken) {
      result[nativeToken.address] = {
        symbol: nativeToken.symbol,
        address: nativeToken.address,
        balance: nativeBalance.value.toString(),
        balanceFormatted: parseFloat(nativeBalance.formatted).toFixed(4),
        decimals: nativeToken.decimals ?? 18,
      };
    }

    // Add ERC20 balances
    if (erc20Balances) {
      erc20Tokens.forEach((token, index) => {
        const balanceResult = erc20Balances[index];
        if (balanceResult?.status === "success" && balanceResult.result !== undefined) {
          const rawBalance = balanceResult.result as bigint;
          const decimals = token.decimals ?? 18;
          const formatted = formatUnits(rawBalance, decimals);
          result[token.address] = {
            symbol: token.symbol,
            address: token.address,
            balance: rawBalance.toString(),
            balanceFormatted: parseFloat(formatted).toFixed(4),
            decimals,
          };
        }
      });
    }

    return result;
  }, [nativeBalance, nativeToken, erc20Balances, erc20Tokens]);

  const getBalance = useCallback(
    (token: Pick<TokenInfo, "address" | "symbol">): string => {
      return balances[token.address]?.balance ?? "0";
    },
    [balances],
  );

  const getBalanceFormatted = useCallback(
    (token: Pick<TokenInfo, "address" | "symbol">): string => {
      return balances[token.address]?.balanceFormatted ?? "0.0000";
    },
    [balances],
  );

  const refetch = useCallback(() => {
    console.info("[balances] refetching balances...");
    // Force refetch by invalidating cache
    refetchNative({ cancelRefetch: true });
    refetchErc20({ cancelRefetch: true });
  }, [refetchNative, refetchErc20]);

  // Log errors for diagnostics
  if (error) {
    console.warn("[balances] fetch error:", error.message);
  }

  return {
    balances,
    isLoading,
    isConnected,
    address,
    error,
    getBalance,
    getBalanceFormatted,
    refetch,
  };
}

/* ========================================
   UTILITY: Format balance for display
   ======================================== */
export function formatBalance(balance: string, decimals: number = 18): string {
  const value = parseFloat(formatUnits(BigInt(balance), decimals));
  if (value === 0) return "0";
  if (value < 0.0001) return "<0.0001";
  if (value < 1) return value.toFixed(4);
  if (value < 1000) return value.toFixed(2);
  if (value < 1000000) return `${(value / 1000).toFixed(1)}K`;
  return `${(value / 1000000).toFixed(1)}M`;
}
