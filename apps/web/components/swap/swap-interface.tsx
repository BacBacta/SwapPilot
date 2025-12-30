"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
import type { RankedQuote } from "@swappilot/shared";
import type { Address } from "viem";

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
      className={`group flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all duration-200 ${
        isWinner
          ? "border-sp-accent/40 bg-sp-accent/10 shadow-glow animate-glow"
          : "border-sp-border bg-sp-surface2 hover:border-sp-borderHover hover:bg-sp-surface3"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`grid h-7 w-7 place-items-center rounded-lg text-micro font-bold ${
            isWinner ? "bg-sp-accent text-black" : "bg-sp-surface3 text-sp-muted"
          }`}
        >
          {rank}
        </div>

        <div className="grid h-10 w-10 place-items-center rounded-xl border border-sp-border bg-sp-surface text-caption font-bold text-sp-text">
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
   STAT CARD
   ======================================== */
function StatCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="rounded-xl border border-sp-border bg-sp-surface2 p-3 text-center transition hover:border-sp-borderHover">
      <div className="text-micro text-sp-muted">{label}</div>
      <div className="mt-1 text-body font-bold text-sp-text">{value}</div>
      {subValue && <div className="mt-0.5 text-micro text-sp-muted2">{subValue}</div>}
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
  const [fromAmount, setFromAmount] = useState("1");
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
  const { getBalanceFormatted, isConnected } = useTokenBalances(balancesTokens);

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
      const amountNum = parseFloat(fromAmount.replace(/,/g, "") || "0");
      const decimals = fromTokenInfo?.decimals ?? 18;
      return BigInt(Math.floor(amountNum * 10 ** decimals));
    } catch {
      return 0n;
    }
  }, [fromAmount, fromTokenInfo]);

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

  // Derived states from hook
  const loading = quotes.status === "loading";
  const error = quotes.error?.message ?? null;

  // Auto-fetch quotes when tokens or amount change (debounced)
  useEffect(() => {
    // Don't fetch if tokens are the same or amount is invalid
    if (fromToken === toToken) return;
    const amountNum = parseFloat(fromAmount.replace(/,/g, "") || "0");
    if (amountNum <= 0 || Number.isNaN(amountNum)) return;
    if (!fromTokenInfo || !toTokenInfo) return;

    // Debounce to avoid too many API calls while typing
    const timeoutId = setTimeout(() => {
      fetchQuotes({
        sellToken: fromToken,
        buyToken: toToken,
        sellAmount: fromAmount,
        slippageBps: settings.slippageBps,
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
    if (!isWalletConnected || !walletAddress) {
      toast.error("Wallet not connected", "Please connect your wallet to swap");
      return;
    }

    if (!fromTokenInfo) {
      toast.error("Token not found", "Unable to resolve token information");
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

    try {
      // Step 1: Build the transaction
      const tx = await buildTransaction({
        providerId: quote.providerId,
        sellToken: fromTokenInfo.address,
        buyToken: toTokenInfo?.address ?? quote.raw.route[quote.raw.route.length - 1],
        sellAmount: sellAmountWei.toString(),
        slippageBps: settings.slippageBps,
      });

      if (!tx) {
        throw new Error("Failed to build transaction");
      }

      // Step 2: Check if approval is needed (for non-native tokens)
      const isNativeToken = fromTokenInfo.address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
                            fromTokenInfo.address.toLowerCase() === "0x0000000000000000000000000000000000000000";

      if (!isNativeToken && needsApproval) {
        toast.updateToast(loadingToastId, {
          type: "info",
          title: "Approval required",
          message: `Please approve ${fromToken} spending`,
        });
        approve();
        // Wait for approval - the user will need to click swap again after approval
        updateTransaction(txId, { status: "failed" });
        setReceiptOpen(false);
        return;
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

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.updateToast(loadingToastId, {
        type: "error",
        title: "Swap failed",
        message,
      });
      updateTransaction(txId, { status: "failed" });
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
    }
  }, [isSwapSuccess, txHash, toast, transactions, updateTransaction, resetSwap, refetchAllowance]);

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

    setReceiptOpen(false);
  };

  const handleViewReceipt = (quote: RankedQuote) => {
    setSelectedQuoteForReceipt(quote);
    setReceiptOpen(true);
  };

  return (
    <>
      <CardDark className="overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sp-border bg-sp-surface/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sp-accent font-bold text-black shadow-glow">
              SP
            </div>
            <div>
              <div className="text-body font-semibold text-sp-text">SwapPilot</div>
              <div className="text-micro text-sp-muted">Smart execution • BNB Chain</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
            <Button variant="soft" size="sm" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon className="h-4 w-4" />
            </Button>
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
                balance={isConnected && fromTokenInfo ? getBalanceFormatted(fromTokenInfo) : undefined}
                value={fromAmount}
                usdValue={fromUsdValue > 0 ? `≈ $${fromUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ""}
                onChange={setFromAmount}
                onTokenClick={() => openTokenPicker("from")}
                onMaxClick={() => {
                  if (!fromTokenInfo) return;
                  setFromAmount(getBalanceFormatted(fromTokenInfo));
                }}
              />

              <SwapDirectionButton onClick={handleSwapDirection} />

              <TokenInput
                label="To"
                token={toTokenInfo?.symbol ?? toToken}
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
              <div className="mt-4 grid grid-cols-3 gap-2">
                <StatCard label="Network" value="$0.36" subValue="~12s" />
                <StatCard label="Slippage" value={`${(settings.slippageBps / 100).toFixed(1)}%`} />
                <StatCard label="Impact" value="-0.02%" />
              </div>

              {/* Route Visualization */}
              {topQuote && (
                <RouteVisualization
                  quote={topQuote}
                  fromToken={fromToken}
                  toToken={toToken}
                  className="mt-4"
                />
              )}

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
