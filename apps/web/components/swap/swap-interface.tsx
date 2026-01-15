"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { CardDark } from "@/components/ui/surfaces";
import { Button, Pill, Badge } from "@/components/ui/primitives";
import { TokenInput, SwapDirectionButton } from "@/components/ui/token-input";
import { Tabs, PresetButtons } from "@/components/ui/inputs";
import { TokenPickerModal } from "@/components/swap/token-picker-modal";
import { SettingsDrawer } from "@/components/swap/settings-drawer";
import { ReceiptDrawer } from "@/components/swap/receipt-drawer";
import { RouteVisualization } from "@/components/swap/route-visualization";
import { 
  TransactionHistoryButton, 
  TransactionHistoryDrawer, 
  useTransactionHistory 
} from "@/components/swap/transaction-history";
import { PilotTierBadge, FeeBreakdown } from "@/components/swap/pilot-tier";
import { useFeeCalculation } from "@/lib/hooks/use-fees";
import { useToast } from "@/components/ui/toast";
import { 
  useSwapQuotes, 
  getConfidenceFromQuote, 
  getQuoteFlags,
  formatQuoteOutput,
  formatQuoteUsd,
} from "@/lib/use-swap-quotes";
import { useTokenPrices, usdToToken, tokenToUsd } from "@/lib/use-token-prices";
import { useTokenBalances } from "@/lib/use-token-balances";
import { useTokenRegistry } from "@/components/providers/token-registry-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { QuoteSkeleton } from "@/components/ui/skeleton";
import { ErrorDisplay } from "@/components/ui/error-display";
import { ModeExplanationBadge } from "@/components/ui/tooltip";
import { useTokenApproval } from "@/lib/hooks/use-token-approval";
import { useExecuteSwap } from "@/lib/hooks/use-execute-swap";
import { useDynamicSlippage } from "@/lib/hooks/use-dynamic-slippage";
import type { RankedQuote } from "@swappilot/shared";
import type { Address } from "viem";

// Gas reserve for native token swaps (0.001 BNB ~ enough for 2-3 transactions on BSC)
// BSC gas per swap: ~0.0003-0.0005 BNB
const GAS_RESERVE_WEI = 1000000000000000n; // 0.001 in wei (18 decimals)

// Native token addresses
const NATIVE_ADDRESSES = new Set([
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "0x0000000000000000000000000000000000000000",
]);

function isNativeTokenAddress(address: string): boolean {
  return NATIVE_ADDRESSES.has(address.toLowerCase());
}

/* ========================================
   PROVIDER ROW (API Version)
   ======================================== */
function ProviderRowAPI({
  quote,
  isWinner = false,
  rank,
  bestBuyAmount,
  buyTokenDecimals = 18,
  buyTokenPriceUsd,
  onSelect,
}: {
  quote: RankedQuote;
  isWinner?: boolean;
  rank: number;
  bestBuyAmount: bigint | undefined;
  buyTokenDecimals?: number;
  buyTokenPriceUsd: number | undefined;
  onSelect?: () => void;
}) {
  const confidence = getConfidenceFromQuote(quote);
  const flags = getQuoteFlags(quote);
  
  // Calculate delta percentage from best quote
  const deltaPct = useMemo(() => {
    if (!bestBuyAmount || rank === 1) return 0;
    const quoteBuy = BigInt(quote.normalized.buyAmount);
    const diff = quoteBuy - bestBuyAmount;
    return Number(diff * 10000n / bestBuyAmount) / 100;
  }, [quote, bestBuyAmount, rank]);

  return (
    <button
      onClick={onSelect}
      className={`group flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all duration-300 ${
        isWinner
          ? "border-sp-accent/40 bg-sp-accent/10 shadow-accentGlow"
          : "border-sp-border bg-sp-surface2 hover:border-sp-borderHover hover:bg-sp-surface3 hover:translate-y-[-2px]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`grid h-7 w-7 place-items-center rounded-full text-micro font-bold ${
            isWinner ? "bg-sp-accent text-black" : "bg-sp-surface3 text-sp-muted"
          }`}
        >
          {rank}
        </div>

        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-sp-border bg-sp-surface text-caption font-bold text-sp-text">
          {quote.providerId.slice(0, 2).toUpperCase()}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-body font-semibold text-sp-text">{quote.providerId}</span>
            {isWinner && <Pill tone="accent" size="sm">BEST</Pill>}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge dot tone={confidence >= 90 ? "ok" : confidence >= 80 ? "warn" : "bad"}>
              {confidence}%
            </Badge>
            {flags.includes("MEV") && <Pill tone="warn" size="sm">MEV</Pill>}
            {flags.includes("SELL_OK") && <Pill tone="ok" size="sm">✓</Pill>}
          </div>
        </div>
      </div>

      <div className="text-right">
        <div className={`text-h2 font-bold ${isWinner ? "text-sp-accent" : "text-sp-text"}`}>
          {formatQuoteOutput(quote, buyTokenDecimals)}
        </div>
        <div className="mt-0.5 text-caption text-sp-muted">
          {formatQuoteUsd(quote, buyTokenDecimals, buyTokenPriceUsd)}
        </div>
        {deltaPct !== 0 && (
          <div className={`text-micro font-medium ${deltaPct > 0 ? "text-sp-ok" : "text-sp-bad"}`}>
            {deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(2)}%
          </div>
        )}
      </div>
    </button>
  );
}

/* ========================================
   STAT CARD - Landio Style
   ======================================== */
function StatCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="rounded-2xl border border-sp-border bg-sp-surface2 p-3 sm:p-4 text-center transition-all duration-300 hover:border-sp-borderHover hover:translate-y-[-2px] min-h-[72px] flex flex-col justify-center">
      <div className="text-[10px] sm:text-micro text-sp-muted uppercase tracking-wider">{label}</div>
      <div className="mt-1 text-body sm:text-h2 font-bold text-sp-text">{value}</div>
      {subValue && <div className="mt-0.5 text-[10px] sm:text-micro text-sp-muted2">{subValue}</div>}
    </div>
  );
}

/* ========================================
   MAIN SWAP INTERFACE
   ======================================== */
export function SwapInterface() {
  // Global Settings
  const { settings, updateSettings, resetSettings } = useSettings();
  
  // Derive mode from settings (map API modes to UI modes)
  const mode = settings.mode === "DEGEN" ? "RAW" : "BEQ";
  const setMode = (m: "BEQ" | "RAW") => {
    updateSettings({ mode: m === "RAW" ? "DEGEN" : "NORMAL" });
  };
  
  // State
  const [fromToken, setFromToken] = useState("BNB");
  const [toToken, setToToken] = useState("ETH");
  const [fromAmount, setFromAmount] = useState("");
  const [fromAmountRawWei, setFromAmountRawWei] = useState<string | null>(null); // Exact wei amount when Max is clicked
  const [showMore, setShowMore] = useState(false);
  
  // Map settings.mode to execution mode display
  const executionMode = settings.mode === "SAFE" ? "safe" : settings.mode === "DEGEN" ? "turbo" : "balanced";
  const setExecutionMode = (m: string | number) => {
    const modeMap: Record<string, "SAFE" | "NORMAL" | "DEGEN"> = {
      safe: "SAFE",
      balanced: "NORMAL",
      turbo: "DEGEN",
    };
    updateSettings({ mode: modeMap[String(m)] ?? "NORMAL" });
  };
  
  // Modals/Drawers
  const [tokenPickerOpen, setTokenPickerOpen] = useState(false);
  const [tokenPickerTarget, setTokenPickerTarget] = useState<"from" | "to">("from");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedQuoteForReceipt, setSelectedQuoteForReceipt] = useState<RankedQuote | null>(null);

  // Prices Hook
  const { prices, getPrice, loading: pricesLoading } = useTokenPrices();

  // Token registry
  const { resolveToken } = useTokenRegistry();
  const fromTokenInfo = useMemo(() => resolveToken(fromToken), [resolveToken, fromToken]);
  const toTokenInfo = useMemo(() => resolveToken(toToken), [resolveToken, toToken]);

  // Balances Hook
  const balancesTokens = useMemo(
    () => [fromTokenInfo, toTokenInfo].filter((t): t is NonNullable<typeof t> => Boolean(t)),
    [fromTokenInfo, toTokenInfo],
  );
  const { getBalanceFormatted, getBalance, isConnected, refetch: refetchBalances } = useTokenBalances(balancesTokens);

  // Transaction History Hook
  const { transactions, pendingCount, addTransaction, updateTransaction, clearHistory } = useTransactionHistory();

  // Toast Hook
  const toast = useToast();

  // API Hook
  const {
    quotes,
    receipt,
    rankedQuotes,
    bestRawQuotes,
    bestExecutableQuote,
    bestRawQuote,
    fetchQuotes,
    fetchReceipt,
    reset,
    isAutoRefreshEnabled,
    setAutoRefresh,
    lastUpdatedAt,
    isRefreshing,
  } = useSwapQuotes(resolveToken);

  // Real swap execution hooks
  const { address: walletAddress, isConnected: isWalletConnected } = useAccount();
  const { 
    status: swapStatus, 
    error: swapError, 
    txHash, 
    builtTx,
    buildTransaction, 
    executeSwap, 
    reset: resetSwap,
    isBuilding,
    isPending: isSwapPending,
    isSuccess: isSwapSuccess,
  } = useExecuteSwap();

  // Token approval hook - only for ERC-20 tokens
  const sellAmountWei = useMemo(() => {
    try {
      // If we have an exact wei amount from Max click, use it directly
      if (fromAmountRawWei) {
        return BigInt(fromAmountRawWei);
      }
      // Otherwise, calculate from the display amount (may have precision loss)
      const amountNum = parseFloat(fromAmount.replace(/,/g, "") || "0");
      const decimals = fromTokenInfo?.decimals ?? 18;
      return BigInt(Math.floor(amountNum * 10 ** decimals));
    } catch {
      return 0n;
    }
  }, [fromAmount, fromAmountRawWei, fromTokenInfo]);

  const {
    needsApproval,
    isApproving,
    isApproved,
    approve,
    allowance,
    refetchAllowance,
  } = useTokenApproval({
    tokenAddress: fromTokenInfo?.address as Address | undefined,
    spenderAddress: builtTx?.approvalAddress as Address | undefined,
    amount: sellAmountWei,
  });

  // Dynamic slippage calculation based on selected quote
  const dynamicSlippage = useDynamicSlippage({
    quote: selectedQuoteForReceipt ?? bestExecutableQuote,
    userSlippageBps: settings.slippageBps,
    autoSlippageEnabled: settings.autoSlippage,
    tokenSymbol: toToken,
    sellTokenAddress: fromTokenInfo?.address,
    buyTokenAddress: toTokenInfo?.address,
  });

  // The effective slippage to use for swaps
  const effectiveSlippageBps = dynamicSlippage.slippageBps;

  // Derived states from hook
  const loading = quotes.status === "loading";
  const error = quotes.error?.message ?? null;

  // Auto-fetch quotes when tokens or amount change (debounced)
  // NOTE: We use settings.slippageBps (not effectiveSlippageBps) to avoid
  // a dependency cycle where dynamic slippage changes trigger new quotes,
  // which change the signals, which change dynamic slippage again.
  const prevModeRef = useRef(settings.mode);
  useEffect(() => {
    // Don't fetch if tokens are the same or amount is invalid
    if (fromToken === toToken) return;
    const amountNum = parseFloat(fromAmount.replace(/,/g, "") || "0");
    if (amountNum <= 0 || Number.isNaN(amountNum)) return;
    if (!fromTokenInfo || !toTokenInfo) return;

    // Check if only the mode changed
    const modeChanged = prevModeRef.current !== settings.mode;
    prevModeRef.current = settings.mode;

    // If only mode changed, fetch immediately without debounce
    if (modeChanged) {
      fetchQuotes({
        sellToken: fromToken,
        buyToken: toToken,
        sellAmount: fromAmount,
        slippageBps: settings.slippageBps,
        mode: settings.mode,
      });
      return;
    }

    // Debounce to avoid too many API calls while typing
    const timeoutId = setTimeout(() => {
      fetchQuotes({
        sellToken: fromToken,
        buyToken: toToken,
        sellAmount: fromAmount,
        slippageBps: settings.slippageBps, // Use user setting, not dynamic
        mode: settings.mode,
      });
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [fromToken, toToken, fromAmount, fromTokenInfo, toTokenInfo, settings.slippageBps, settings.mode, fetchQuotes]);

  // Force re-render every second to update "Updated Xs ago" display
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastUpdatedAt) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [lastUpdatedAt]);

  // Calculate USD value of input
  const fromAmountNum = parseFloat(fromAmount.replace(/,/g, "") || "0");
  const fromUsdValue = useMemo(() => {
    const price = getPrice(fromToken);
    if (!price || isNaN(fromAmountNum)) return 0;
    return fromAmountNum * price;
  }, [fromToken, fromAmountNum, getPrice]);

  // Fee calculation based on swap value
  const { data: feeData } = useFeeCalculation(fromUsdValue);

  // Check if amount exceeds balance using precise wei comparison
  const insufficientBalance = useMemo(() => {
    if (!isConnected || !fromTokenInfo) return false;
    if (isNaN(fromAmountNum) || fromAmountNum === 0) return false;
    
    // Get the exact balance in wei
    const balanceWei = getBalance(fromTokenInfo);
    if (!balanceWei) return false;
    
    // If we have exact wei amount (from Max/percentage click), compare directly
    if (fromAmountRawWei) {
      try {
        return BigInt(fromAmountRawWei) > BigInt(balanceWei);
      } catch {
        // Fall through to float comparison
      }
    }
    
    // For manual input, convert to wei for precise comparison
    try {
      const decimals = fromTokenInfo.decimals ?? 18;
      // Parse the input amount to wei (handle decimal input)
      const [whole, fraction = ""] = fromAmount.replace(/,/g, "").split(".");
      const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
      const amountWei = BigInt(whole + paddedFraction);
      return amountWei > BigInt(balanceWei);
    } catch {
      // Fallback: use float comparison with small tolerance
      const balanceNum = parseFloat(getBalanceFormatted(fromTokenInfo).replace(/,/g, "") || "0");
      // Allow a tiny tolerance for floating point errors (0.0001%)
      return fromAmountNum > balanceNum * 1.000001;
    }
  }, [isConnected, fromTokenInfo, fromAmountNum, fromAmountRawWei, fromAmount, getBalance, getBalanceFormatted]);

  // Get quotes based on mode
  const activeQuotes = useMemo(() => {
    return mode === "BEQ" ? rankedQuotes : bestRawQuotes;
  }, [mode, rankedQuotes, bestRawQuotes]);

  const displayedQuotes = useMemo(() => {
    return showMore ? activeQuotes : activeQuotes.slice(0, 3);
  }, [activeQuotes, showMore]);

  // Best buy amount for delta calculations
  const bestBuyAmount = useMemo(() => {
    const firstQuote = activeQuotes[0];
    if (!firstQuote) return undefined;
    return BigInt(firstQuote.normalized.buyAmount);
  }, [activeQuotes]);

  // Best quote for display
  const topQuote = mode === "BEQ" ? bestExecutableQuote : bestRawQuote;

  // SAFE mode soft-block when token security is uncertain
  const isSafeMode = settings.mode === "SAFE";
  const sellability = topQuote?.signals?.sellability;
  const tokenSecurityReasons = sellability?.reasons?.filter((r) => r.startsWith("token_security:")) ?? [];
  const isSecurityUncertain =
    isSafeMode &&
    Boolean(topQuote) &&
    tokenSecurityReasons.length > 0 &&
    sellability?.status !== "OK";
  const sellabilityReasons = sellability?.reasons ?? [];
  const isSellabilityUncertain =
    isSafeMode &&
    Boolean(topQuote) &&
    sellability?.status === "UNCERTAIN";
  const isRiskBlocked = isSecurityUncertain || isSellabilityUncertain;
  const sellabilityWarningBody = sellabilityReasons.some((r) => r.includes("no_txRequest_available"))
    ? "Simulation isn’t available, so sellability can’t be confirmed. We’ve paused execution to keep you safe."
    : sellabilityReasons.some((r) => r.includes("preflight"))
      ? "Simulation signals elevated risk, so sellability is uncertain. We’ve paused execution to protect you."
      : "Sellability is uncertain. We’ve paused execution to protect you.";

  // Handlers
  const handleSwapDirection = useCallback(() => {
    setFromToken(toToken);
    setToToken(fromToken);
    reset();
  }, [fromToken, toToken, reset]);

  const openTokenPicker = (target: "from" | "to") => {
    setTokenPickerTarget(target);
    setTokenPickerOpen(true);
  };

  const handleTokenSelect = (token: string) => {
    if (tokenPickerTarget === "from") {
      setFromToken(token);
    } else {
      setToToken(token);
    }
    setTokenPickerOpen(false);
    reset();
  };

  const handleExecute = async () => {
    if (fromAmountNum <= 0 || Number.isNaN(fromAmountNum)) {
      toast.warning("Invalid amount", "Please enter a valid amount to swap");
      return;
    }

    if (!fromTokenInfo || !toTokenInfo) {
      toast.warning("Token list not ready", "Please wait for tokens to load");
      return;
    }

    const loadingToastId = toast.loading("Finding best route...", `Comparing quotes for ${fromToken} → ${toToken}`);

    try {
      await fetchQuotes({
        sellToken: fromToken,
        buyToken: toToken,
        sellAmount: fromAmount,
        slippageBps: settings.slippageBps,
        mode: settings.mode,
      });
      toast.updateToast(loadingToastId, {
        type: "success",
        title: "Routes found!",
        message: `Found ${rankedQuotes.length || "multiple"} providers`,
      });
    } catch (err) {
      toast.updateToast(loadingToastId, {
        type: "error",
        title: "Failed to fetch quotes",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  // Handle real swap execution
  const handleSwapConfirm = async (quote: RankedQuote) => {
    if (isRiskBlocked) {
      const title = isSecurityUncertain ? "Token risk detected" : "Sellability uncertain";
      const message = isSecurityUncertain
        ? "A security source flagged elevated risk. Enable Expert Mode to proceed."
        : "We can’t confidently confirm sellability. Enable Expert Mode to proceed.";
      toast.warning(title, message);
      return;
    }
    console.groupCollapsed("[swap][ui] confirm", quote.providerId);
    console.info("[swap][ui] context", {
      fromToken,
      toToken,
      fromAmount,
      sellAmountWei: sellAmountWei.toString(),
      slippageBps: settings.slippageBps,
      walletAddress,
      isWalletConnected,
      quote: {
        providerId: quote.providerId,
        capabilities: quote.capabilities,
        raw: quote.raw,
        normalized: quote.normalized,
        deepLink: quote.deepLink,
      },
    });

    if (!isWalletConnected || !walletAddress) {
      toast.error("Wallet not connected", "Please connect your wallet to swap");
      console.warn("[swap][ui] blocked: wallet not connected");
      console.groupEnd();
      return;
    }

    if (!fromTokenInfo || !toTokenInfo) {
      toast.error("Token not found", "Unable to resolve token information");
      console.warn("[swap][ui] blocked: token info missing", { fromTokenInfo, toTokenInfo });
      console.groupEnd();
      return;
    }

    // Check if provider supports buildTx
    const supportsBuildTx = quote.capabilities.buildTx;
    
    if (!supportsBuildTx) {
      // Use deep link for providers that don't support buildTx
      if (quote.deepLink) {
        window.open(quote.deepLink, "_blank");
        toast.info("Opening external swap", `Redirecting to ${quote.providerId}`);
      } else {
        toast.error("No execution method", `${quote.providerId} doesn't support direct swaps or deep links`);
      }
      setReceiptOpen(false);
      console.warn("[swap][ui] provider has no buildTx", { providerId: quote.providerId });
      console.groupEnd();
      return;
    }

    // Add to transaction history
    const txId = addTransaction({
      fromToken,
      toToken,
      fromAmount,
      toAmount: formatQuoteOutput(quote),
      provider: quote.providerId,
      status: "pending",
      chainId: 56,
    });

    const loadingToastId = toast.loading("Building transaction...", `Preparing swap via ${quote.providerId}`);

    // Log the slippage being used
    console.info("[swap][ui] using slippage", {
      effectiveSlippageBps,
      isAuto: dynamicSlippage.isAuto,
      reason: dynamicSlippage.reason,
      riskLevel: dynamicSlippage.riskLevel,
    });

    try {
      // Step 1: Build the transaction
      const tx = await buildTransaction({
        providerId: quote.providerId,
        sellToken: fromTokenInfo.address,
        buyToken: toTokenInfo.address,
        sellAmount: sellAmountWei.toString(),
        slippageBps: effectiveSlippageBps, // Use dynamic slippage
        sellTokenDecimals: fromTokenInfo.decimals,
        buyTokenDecimals: toTokenInfo.decimals,
        quoteRaw: quote.raw,
        quoteNormalized: quote.normalized,
      });

      if (!tx) {
        throw new Error("Failed to build transaction");
      }

      console.info("[swap][ui] builtTx", tx);

      // Step 2: Check if approval is needed (for non-native tokens)
      const isNativeToken = fromTokenInfo.address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
                            fromTokenInfo.address.toLowerCase() === "0x0000000000000000000000000000000000000000";

      // Manually check allowance since the hook may not have updated yet with new spender
      if (!isNativeToken && tx.approvalAddress) {
        // Read current allowance directly
        const { readContract } = await import("viem/actions");
        const { createPublicClient, http, erc20Abi } = await import("viem");
        const { bsc } = await import("viem/chains");
        
        const publicClient = createPublicClient({
          chain: bsc,
          transport: http(),
        });

        let currentAllowance = 0n;
        try {
          currentAllowance = await publicClient.readContract({
            address: fromTokenInfo.address as `0x${string}`,
            abi: erc20Abi,
            functionName: "allowance",
            args: [walletAddress as `0x${string}`, tx.approvalAddress as `0x${string}`],
          });
        } catch (e) {
          console.warn("[swap][ui] failed to read allowance", e);
        }

        console.info("[swap][ui] allowance check", {
          token: fromTokenInfo.address,
          spender: tx.approvalAddress,
          currentAllowance: currentAllowance.toString(),
          requiredAmount: sellAmountWei.toString(),
          needsApproval: currentAllowance < sellAmountWei,
        });

        if (currentAllowance < sellAmountWei) {
          toast.updateToast(loadingToastId, {
            type: "info",
            title: "Approval required",
            message: `Please approve ${fromToken} spending in your wallet`,
          });

          // Request approval and wait for it
          const { writeContract, waitForTransactionReceipt } = await import("viem/actions");
          const { createWalletClient, custom, maxUint256 } = await import("viem");
          
          try {
            // Create wallet client from window.ethereum
            const walletClient = createWalletClient({
              chain: bsc,
              transport: custom((window as any).ethereum),
            });

            // Send approval transaction
            const approvalHash = await walletClient.writeContract({
              address: fromTokenInfo.address as `0x${string}`,
              abi: erc20Abi,
              functionName: "approve",
              args: [tx.approvalAddress as `0x${string}`, maxUint256],
              account: walletAddress as `0x${string}`,
            });

            console.info("[swap][ui] approval tx sent", approvalHash);

            toast.updateToast(loadingToastId, {
              type: "info",
              title: "Waiting for approval...",
              message: "Confirming on blockchain",
            });

            // Wait for approval to be confirmed
            await publicClient.waitForTransactionReceipt({
              hash: approvalHash,
              confirmations: 1,
            });

            console.info("[swap][ui] approval confirmed", approvalHash);
            
            toast.updateToast(loadingToastId, {
              type: "success",
              title: "Approval confirmed!",
              message: "Now executing swap...",
            });

            // Small delay to let the chain state propagate
            await new Promise(resolve => setTimeout(resolve, 1000));

          } catch (approvalError) {
            const msg = approvalError instanceof Error ? approvalError.message : "Approval failed";
            console.error("[swap][ui] approval failed", approvalError);
            toast.updateToast(loadingToastId, {
              type: "error",
              title: "Approval failed",
              message: msg.includes("User rejected") ? "User rejected the request" : msg,
            });
            updateTransaction(txId, { status: "failed" });
            console.groupEnd();
            return;
          }
        }
      }

      // Step 3: Execute the swap
      toast.updateToast(loadingToastId, {
        type: "info",
        title: "Confirm in wallet",
        message: "Please confirm the transaction in your wallet",
      });

      executeSwap(tx);

      // The rest is handled by useEffect watching txHash and swapStatus
      setReceiptOpen(false);

      console.groupEnd();

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[swap][ui] swap failed", {
        providerId: quote.providerId,
        message,
        err,
      });
      toast.updateToast(loadingToastId, {
        type: "error",
        title: "Swap failed",
        message,
      });
      updateTransaction(txId, { status: "failed" });
      console.groupEnd();
    }
  };

  // Watch for transaction completion
  useEffect(() => {
    if (isSwapSuccess && txHash) {
      toast.success("Swap successful!", `Transaction: ${txHash.slice(0, 10)}...`);
      // Update the most recent pending transaction
      const pendingTx = transactions.find(t => t.status === "pending");
      if (pendingTx) {
        updateTransaction(pendingTx.id, { status: "success", hash: txHash });
      }
      resetSwap();
      refetchAllowance();
      
      // Clear the form after successful swap to prevent re-using stale data
      setFromAmount("");
      setFromAmountRawWei(null);
      
      // Reset quotes to clear stale quote data
      reset();
      
      // Refresh balances multiple times to ensure UI updates
      // First refresh immediately
      refetchBalances();
      
      // Then refresh again after delays to catch chain propagation
      const refreshIntervals = [1000, 2500, 5000];
      refreshIntervals.forEach((delay) => {
        setTimeout(() => {
          refetchBalances();
        }, delay);
      });
    }
  }, [isSwapSuccess, txHash, toast, transactions, updateTransaction, resetSwap, refetchAllowance, refetchBalances, reset]);

  // Watch for swap errors
  useEffect(() => {
    if (swapError && swapStatus === "error") {
      toast.error("Transaction failed", swapError);
      const pendingTx = transactions.find(t => t.status === "pending");
      if (pendingTx) {
        updateTransaction(pendingTx.id, { status: "failed" });
      }
    }
  }, [swapError, swapStatus, toast, transactions, updateTransaction]);

  const handleViewReceipt = async (quote: RankedQuote) => {
    setSelectedQuoteForReceipt(quote);
    setReceiptOpen(true);

    // If receipt wasn't embedded (or got cleared), try fetching it using receiptId.
    if (!receipt.data && quotes.data?.receiptId) {
      await fetchReceipt(quotes.data.receiptId);
    }
  };

  return (
    <>
      <CardDark className="overflow-hidden">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-sp-border bg-sp-surface/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sp-accent font-bold text-black shadow-glow">
              SP
            </div>
            <div>
              <div className="text-body font-semibold text-sp-text">SwapPilot</div>
              <div className="text-micro text-sp-muted">Smart execution • BNB Chain</div>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:gap-3">
            <PilotTierBadge />
            <TransactionHistoryButton 
              pendingCount={pendingCount} 
              onClick={() => setHistoryOpen(true)} 
            />
            <div className="flex items-center gap-1.5">
              <Tabs
                tabs={[
                  { value: "BEQ", label: "Best Exec" },
                  { value: "RAW", label: "Raw Output" },
                ]}
                value={mode}
                onChange={setMode}
                size="sm"
              />
              <ModeExplanationBadge mode={mode} />
            </div>
            <div className="flex items-center gap-2">
              {/* Dynamic slippage indicator */}
              <button
                onClick={() => setSettingsOpen(true)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-micro font-medium transition-all ${
                  dynamicSlippage.riskLevel === "high"
                    ? "bg-sp-bad/20 text-sp-bad border border-sp-bad/30"
                    : dynamicSlippage.riskLevel === "medium"
                      ? "bg-sp-warn/20 text-sp-warn border border-sp-warn/30"
                      : "bg-sp-surface3 text-sp-muted border border-sp-border hover:border-sp-borderHover"
                }`}
                title={dynamicSlippage.reason}
              >
                {dynamicSlippage.isAuto && (
                  <span className="text-[10px]">⚡</span>
                )}
                <span>{(effectiveSlippageBps / 100).toFixed(1)}%</span>
              </button>
              <Button variant="soft" size="sm" onClick={() => setSettingsOpen(true)}>
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="p-5">
          {/* Error message */}
          {error && (
            <ErrorDisplay 
              error={{ 
                type: quotes.error?.kind === 'timeout' ? 'timeout' : 
                       quotes.error?.kind === 'network' ? 'network' : 'api',
                message: error,
                retryable: true
              }}
              onRetry={handleExecute}
              className="mb-4"
            />
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Left: Swap form */}
            <div className="space-y-1">
              <TokenInput
                label="From"
                token={fromTokenInfo?.symbol ?? fromToken}
                tokenLogoURI={fromTokenInfo?.logoURI}
                balance={isConnected && fromTokenInfo ? getBalanceFormatted(fromTokenInfo) : undefined}
                value={fromAmount}
                usdValue={fromUsdValue > 0 ? `≈ $${fromUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ""}
                error={insufficientBalance ? "Insufficient balance" : undefined}
                onChange={(val) => {
                  setFromAmount(val);
                  // Clear exact wei when user manually types (will recalculate from display value)
                  setFromAmountRawWei(null);
                }}
                onTokenClick={() => openTokenPicker("from")}
                onMaxClick={() => {
                  if (!fromTokenInfo) return;
                  const balanceWei = getBalance(fromTokenInfo);
                  if (!balanceWei) return;
                  
                  let maxWei = BigInt(balanceWei);
                  
                  // Reserve gas for native tokens (BNB/ETH)
                  if (isNativeTokenAddress(fromTokenInfo.address)) {
                    maxWei = maxWei > GAS_RESERVE_WEI ? maxWei - GAS_RESERVE_WEI : 0n;
                  }
                  
                  const formatted = (Number(maxWei) / 10 ** (fromTokenInfo.decimals ?? 18)).toString();
                  setFromAmount(formatted);
                  setFromAmountRawWei(maxWei.toString());
                }}
              />

              {/* Quick Amount Buttons - Mobile friendly */}
              {isConnected && fromTokenInfo && (
                <div className="flex gap-2 px-1 py-2">
                  {[
                    { label: "25%", pct: 0.25 },
                    { label: "50%", pct: 0.5 },
                    { label: "75%", pct: 0.75 },
                    { label: "MAX", pct: 1 },
                  ].map(({ label, pct }) => (
                    <button
                      key={label}
                      onClick={() => {
                        const bal = getBalance(fromTokenInfo);
                        if (!bal) return;
                        // Convert bal from string to bigint for calculation
                        let balBigInt = BigInt(bal);
                        
                        // Reserve gas for native tokens when using MAX (100%)
                        const isNative = isNativeTokenAddress(fromTokenInfo.address);
                        if (isNative && pct === 1) {
                          balBigInt = balBigInt > GAS_RESERVE_WEI ? balBigInt - GAS_RESERVE_WEI : 0n;
                        }
                        
                        const pctAmount = (balBigInt * BigInt(Math.floor(pct * 100))) / 100n;
                        const formatted = (Number(pctAmount) / 10 ** (fromTokenInfo.decimals ?? 18)).toString();
                        setFromAmount(formatted);
                        setFromAmountRawWei(pctAmount.toString());
                      }}
                      className="flex-1 rounded-xl border border-sp-border bg-sp-surface2 py-2.5 text-caption font-semibold text-sp-muted transition hover:border-sp-accent hover:text-sp-accent active:scale-95"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <SwapDirectionButton onClick={handleSwapDirection} />

              <TokenInput
                label="To"
                token={toTokenInfo?.symbol ?? toToken}
                tokenLogoURI={toTokenInfo?.logoURI}
                balance={isConnected && toTokenInfo ? getBalanceFormatted(toTokenInfo) : undefined}
                value={loading ? "" : topQuote ? formatQuoteOutput(topQuote, toTokenInfo?.decimals ?? 18) : "—"}
                usdValue={loading ? "" : topQuote ? formatQuoteUsd(topQuote, toTokenInfo?.decimals ?? 18, getPrice(toTokenInfo?.symbol ?? "") ?? undefined) : ""}
                loading={loading}
                readOnly
                onTokenClick={() => openTokenPicker("to")}
              />

              {/* Mode selector */}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-caption text-sp-muted">Execution mode</span>
                <PresetButtons
                  options={[
                    { value: "safe", label: "Safe" },
                    { value: "balanced", label: "Balanced" },
                    { value: "turbo", label: "Turbo" },
                  ]}
                  value={executionMode}
                  onChange={setExecutionMode}
                />
              </div>

              {/* Stats row */}
              <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
                <StatCard label="Network" value="$0.36" subValue="~12s" />
                <StatCard label="Slippage" value={`${(settings.slippageBps / 100).toFixed(1)}%`} />
                <StatCard 
                  label="Platform Fee" 
                  value={feeData?.feeApplies ? `${(feeData.finalFeeBps / 100).toFixed(2)}%` : "Free"} 
                  {...(feeData?.discountPercent ? { subValue: `-${feeData.discountPercent}% PILOT` } : {})}
                />
              </div>

              {/* Fee breakdown when applicable */}
              {feeData && feeData.feeApplies && (
                <div className="mt-3 rounded-lg border border-sp-border bg-sp-surface2 p-3">
                  <FeeBreakdown
                    swapValueUsd={fromUsdValue}
                    feeBps={feeData.finalFeeBps}
                    discountPercent={feeData.discountPercent}
                    pilotTier={feeData.pilotTier}
                  />
                </div>
              )}

              {/* Route Visualization */}
              {topQuote && (
                <RouteVisualization
                  quote={topQuote}
                  fromToken={fromToken}
                  toToken={toToken}
                  className="mt-4"
                />
              )}

              {/* Desktop CTA - Hidden on mobile (we show sticky version below) */}
              <div className="hidden md:block">
                {/* CTA - Dynamic based on wallet and swap state */}
                {!isWalletConnected ? (
                  <Button 
                    className="mt-5 h-12 w-full text-body" 
                    size="lg"
                    variant="primary"
                    onClick={() => {
                      // Trigger RainbowKit connect modal
                      document.querySelector<HTMLButtonElement>('[data-testid="rk-connect-button"]')?.click();
                    }}
                  >
                    Connect Wallet
                  </Button>
                ) : isApproving ? (
                  <Button 
                    className="mt-5 h-12 w-full text-body" 
                    size="lg"
                    loading
                    disabled
                  >
                    Approving {fromToken}...
                  </Button>
                ) : isBuilding ? (
                  <Button 
                    className="mt-5 h-12 w-full text-body" 
                    size="lg"
                    loading
                    disabled
                  >
                    Building transaction...
                  </Button>
                ) : isSwapPending ? (
                  <Button 
                    className="mt-5 h-12 w-full text-body" 
                    size="lg"
                    loading
                    disabled
                  >
                    Confirming swap...
                  </Button>
                ) : insufficientBalance ? (
                  <Button 
                    className="mt-5 h-12 w-full text-body" 
                    size="lg"
                    disabled
                    variant="destructive"
                  >
                    Insufficient balance
                  </Button>
                ) : isRiskBlocked ? (
                  <Button
                    className="mt-5 h-12 w-full text-body"
                    size="lg"
                    disabled
                    variant="destructive"
                  >
                    {isSecurityUncertain ? "Token risk detected" : "Sellability uncertain"}
                  </Button>
                ) : (
                  <Button 
                    className="mt-5 h-12 w-full text-body" 
                    size="lg" 
                    loading={loading}
                    onClick={handleExecute}
                    disabled={!topQuote || loading}
                  >
                    {loading ? "Finding best route..." : topQuote ? "Execute Best Quote" : "Enter amount"}
                  </Button>
                )}
              </div>

              {isRiskBlocked && (
                <div className="mt-3 rounded-lg border border-sp-bad/40 bg-sp-bad/10 p-3 text-caption text-sp-bad">
                  <div className="font-semibold">{isSecurityUncertain ? "Token risk detected" : "Sellability uncertain"}</div>
                  <div className="mt-1 text-sp-bad/90">
                    {isSecurityUncertain
                      ? "A security source flagged elevated risk. We’ve paused execution to protect you."
                      : sellabilityWarningBody}
                  </div>
                  <button
                    className="mt-2 rounded-md bg-sp-bad/20 px-3 py-1 text-[11px] font-semibold text-sp-bad transition hover:bg-sp-bad/30"
                    onClick={() => updateSettings({ mode: "DEGEN" })}
                  >
                    Continue in Expert Mode
                  </button>
                </div>
              )}

              <p className="mt-3 text-center text-micro text-sp-muted2">
                {mode === "BEQ" 
                  ? "BEQ-first routing with sellability + MEV protection" 
                  : "Raw output comparison without risk adjustment"}
              </p>
            </div>

            {/* Right: Provider quotes */}
            <div className="rounded-xl border border-sp-border bg-sp-surface p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-body font-semibold text-sp-text">Provider Quotes</h3>
                  <p className="mt-0.5 text-micro text-sp-muted">
                    {activeQuotes.length > 0 
                      ? `${activeQuotes.length} providers compared` 
                      : "Enter amount to get quotes"}
                    {lastUpdatedAt && activeQuotes.length > 0 && (
                      <span className="ml-2">
                        {isRefreshing ? (
                          <span className="inline-flex items-center gap-1 text-sp-accent">
                            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sp-accent" />
                            Updating...
                          </span>
                        ) : (
                          <span className="text-sp-muted2">
                            • Updated {Math.round((Date.now() - lastUpdatedAt) / 1000)}s ago
                          </span>
                        )}
                      </span>
                    )}
                  </p>
                </div>
                <Pill tone={mode === "BEQ" ? "accent" : "blue"}>{mode}</Pill>
              </div>

              <div className="space-y-2">
                {loading ? (
                  // Loading skeletons with staggered animation
                  <div className="animate-slideDown space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <QuoteSkeleton key={i} />
                    ))}
                  </div>
                ) : displayedQuotes.length > 0 ? (
                  <div className="animate-slideDown space-y-2">
                    {displayedQuotes.map((quote, i) => (
                      <ProviderRowAPI
                        key={quote.providerId}
                        quote={quote}
                        rank={i + 1}
                        isWinner={i === 0}
                        bestBuyAmount={bestBuyAmount}
                        buyTokenDecimals={toTokenInfo?.decimals ?? 18}
                        buyTokenPriceUsd={getPrice(toTokenInfo?.symbol ?? "") ?? undefined}
                        onSelect={() => handleViewReceipt(quote)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="text-3xl">📊</div>
                    <div className="mt-2 text-caption text-sp-muted">
                      Click &ldquo;Execute Best Quote&rdquo; to compare providers
                    </div>
                  </div>
                )}
              </div>

              {!loading && activeQuotes.length > 3 && (
                <button
                  onClick={() => setShowMore(!showMore)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sp-border py-3 text-caption text-sp-muted transition hover:border-sp-borderHover hover:text-sp-text"
                >
                  <span>{showMore ? "Show less" : `Show ${activeQuotes.length - 3} more`}</span>
                  <ChevronIcon className={`h-4 w-4 transition ${showMore ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </CardDark>

      {/* Mobile Sticky CTA - Fixed at bottom with safe-area */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 md:hidden safe-bottom">
        <div className="mx-auto max-w-lg rounded-2xl border border-sp-accent/20 bg-sp-surface/98 p-4 shadow-2xl backdrop-blur-xl" style={{ boxShadow: '0 -8px 32px rgba(0,0,0,0.4), 0 0 24px rgba(247,201,72,0.1)' }}>
          {/* Summary row */}
          {topQuote && (
            <div className="mb-3 flex items-center justify-between text-caption">
              <span className="text-sp-muted">You receive</span>
              <span className="font-bold text-sp-accent">
                {formatQuoteOutput(topQuote, toTokenInfo?.decimals ?? 18)} {toToken}
              </span>
            </div>
          )}
          
          {/* CTA Button */}
          {!isWalletConnected ? (
            <Button 
              className="h-14 w-full text-body font-bold shadow-glow" 
              size="xl"
              variant="primary"
              onClick={() => {
                document.querySelector<HTMLButtonElement>('[data-testid="rk-connect-button"]')?.click();
              }}
            >
              Connect Wallet
            </Button>
          ) : isApproving ? (
            <Button className="h-14 w-full text-body font-bold" size="xl" loading disabled>
              Approving {fromToken}...
            </Button>
          ) : isBuilding ? (
            <Button className="h-14 w-full text-body font-bold" size="xl" loading disabled>
              Building...
            </Button>
          ) : isSwapPending ? (
            <Button className="h-14 w-full text-body font-bold" size="xl" loading disabled>
              Confirming...
            </Button>
          ) : insufficientBalance ? (
            <Button className="h-14 w-full text-body font-bold" size="xl" disabled variant="destructive">
              Insufficient Balance
            </Button>
          ) : isRiskBlocked ? (
            <Button className="h-14 w-full text-body font-bold" size="xl" disabled variant="destructive">
              {isSecurityUncertain ? "Token risk detected" : "Sellability uncertain"}
            </Button>
          ) : (
            <Button 
              className="h-14 w-full text-body font-bold shadow-glow" 
              size="xl"
              loading={loading}
              onClick={handleExecute}
              disabled={!topQuote || loading}
            >
              {loading ? "Finding route..." : topQuote ? "Swap Now" : "Enter amount"}
            </Button>
          )}
        </div>
      </div>

      {/* Spacer for mobile sticky CTA */}
      <div className="h-48 md:hidden" />

      {/* Token Picker Modal */}
      <TokenPickerModal
        open={tokenPickerOpen}
        onClose={() => setTokenPickerOpen(false)}
        onSelect={handleTokenSelect}
        selectedToken={tokenPickerTarget === "from" ? fromToken : toToken}
      />

      {/* Settings Drawer */}
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Receipt Drawer */}
      <ReceiptDrawer
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        receipt={receipt.data}
        selectedQuote={selectedQuoteForReceipt}
        loading={receipt.status === "loading"}
        onConfirm={selectedQuoteForReceipt ? () => handleSwapConfirm(selectedQuoteForReceipt) : undefined}
      />

      {/* Transaction History Drawer */}
      <TransactionHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        transactions={transactions}
        onClear={clearHistory}
      />
    </>
  );
}

/* ========================================
   ICONS
   ======================================== */
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
