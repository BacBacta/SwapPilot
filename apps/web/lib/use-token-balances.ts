"use client";

import { useAccount, useBalance, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { bsc } from "wagmi/chains";
import { useMemo } from "react";

/* ========================================
   TOKEN CONTRACTS (BNB Chain)
   ======================================== */
export const TOKEN_CONTRACTS: Record<string, { address: `0x${string}`; decimals: number }> = {
  BNB: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 }, // Native
  ETH: { address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", decimals: 18 },
  USDT: { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
  USDC: { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
  WBTC: { address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", decimals: 18 },
  CAKE: { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", decimals: 18 },
  BUSD: { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", decimals: 18 },
  DAI: { address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", decimals: 18 },
};

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
  balance: string;
  balanceFormatted: string;
  decimals: number;
}

export interface UseTokenBalancesReturn {
  balances: Record<string, TokenBalance>;
  isLoading: boolean;
  isConnected: boolean;
  address: string | undefined;
  getBalance: (symbol: string) => string;
  getBalanceFormatted: (symbol: string) => string;
  refetch: () => void;
}

/* ========================================
   HOOK: useTokenBalances
   ======================================== */
export function useTokenBalances(symbols: string[] = Object.keys(TOKEN_CONTRACTS)): UseTokenBalancesReturn {
  const { address, isConnected } = useAccount();

  // Fetch native BNB balance
  const { data: nativeBalance, refetch: refetchNative } = useBalance({
    address,
    chainId: bsc.id,
    query: {
      enabled: isConnected,
    },
  });

  // Prepare contracts for ERC20 tokens (exclude native BNB)
  const erc20Tokens = useMemo(() => {
    return symbols
      .filter((s) => s !== "BNB" && TOKEN_CONTRACTS[s])
      .map((symbol) => ({
        symbol,
        ...TOKEN_CONTRACTS[symbol],
      }));
  }, [symbols]);

  // Batch read ERC20 balances
  const { data: erc20Balances, isLoading, refetch: refetchErc20 } = useReadContracts({
    contracts: erc20Tokens.map((token) => ({
      address: token.address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address!],
      chainId: bsc.id,
    })),
    query: {
      enabled: isConnected && !!address,
    },
  });

  // Parse balances into a map
  const balances = useMemo(() => {
    const result: Record<string, TokenBalance> = {};

    // Add native BNB balance
    if (nativeBalance && symbols.includes("BNB")) {
      result.BNB = {
        symbol: "BNB",
        balance: nativeBalance.value.toString(),
        balanceFormatted: parseFloat(nativeBalance.formatted).toFixed(4),
        decimals: 18,
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
          result[token.symbol] = {
            symbol: token.symbol,
            balance: rawBalance.toString(),
            balanceFormatted: parseFloat(formatted).toFixed(4),
            decimals,
          };
        }
      });
    }

    return result;
  }, [nativeBalance, erc20Balances, erc20Tokens, symbols]);

  const getBalance = (symbol: string): string => {
    return balances[symbol]?.balance ?? "0";
  };

  const getBalanceFormatted = (symbol: string): string => {
    return balances[symbol]?.balanceFormatted ?? "0.0000";
  };

  const refetch = () => {
    refetchNative();
    refetchErc20();
  };

  return {
    balances,
    isLoading,
    isConnected,
    address,
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
