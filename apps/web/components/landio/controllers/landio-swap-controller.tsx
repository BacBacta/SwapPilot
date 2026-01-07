"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { type Address, erc20Abi, maxUint256 } from "viem";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { bsc } from "viem/chains";
import { postQuotes } from "@/lib/api";
import { useSettings } from "@/components/providers/settings-provider";
import { useTokenRegistry } from "@/components/providers/token-registry-provider";
import { useTokenBalances } from "@/lib/use-token-balances";
import { useTokenPrices } from "@/lib/hooks/use-token-prices";
import { useExecuteSwap } from "@/lib/hooks/use-execute-swap";
import { useTokenApproval } from "@/lib/hooks/use-token-approval";
import { useDynamicSlippage } from "@/lib/hooks/use-dynamic-slippage";
import { usePilotTier, useFeeCalculation, getTierDisplay, formatFee } from "@/lib/hooks/use-fees";
import { useToast } from "@/components/ui/toast";
import { TOKEN_ICONS } from "@/components/ui/token-image";
import { BASE_TOKENS, type TokenInfo, isAddress } from "@/lib/tokens";
import type { QuoteResponse, RankedQuote, DecisionReceipt } from "@swappilot/shared";

// Debounce delay for quote fetching (ms)
const QUOTE_DEBOUNCE_MS = 500;

// Universal Router address (used as spender for approvals)
const UNIVERSAL_ROUTER_ADDRESS: Address = "0x5Dc88340E1c5c6366864Ee415d6034cadd1A9897";

// Transaction history storage key
const TX_HISTORY_KEY = "swappilot_tx_history";

// Get token logo URL - uses TOKEN_ICONS, then Trust Wallet, then fallback
function getTokenLogoUrl(token: TokenInfo | null | undefined): string | null {
  if (!token) return null;
  
  // First check if token has its own logoURI
  if (token.logoURI) return token.logoURI;
  
  // Then check TOKEN_ICONS by symbol
  const iconUrl = TOKEN_ICONS[token.symbol.toUpperCase()];
  if (iconUrl) return iconUrl;
  
  // Fallback to PancakeSwap token images for BSC tokens (more reliable, CORS-friendly)
  if (token.address && token.address !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
    return `https://tokens.pancakeswap.finance/images/${token.address}.png`;
  }
  
  return null;
}

// Transaction type for history
type StoredTransaction = {
  id: string;
  timestamp: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  txHash?: string | undefined;
  status: "pending" | "success" | "failed";
  providerId: string;
};

function parseNumber(input: string): number {
  const n = parseFloat(String(input).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
}

function setHtml(selector: string, html: string) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.innerHTML = html;
}

function setDisplay(id: string, display: string) {
  const el = document.getElementById(id);
  if (!el) return;
  (el as HTMLElement).style.display = display;
}

function setWidth(id: string, width: string) {
  const el = document.getElementById(id);
  if (!el) return;
  (el as HTMLElement).style.width = width;
}

function setDisabled(id: string, disabled: boolean) {
  const el = document.getElementById(id) as HTMLButtonElement | null;
  if (!el) return;
  el.disabled = disabled;
}

function setSwapBtnText(text: string) {
  const el = document.getElementById("swapBtn");
  if (!el) return;
  el.textContent = text;
}

function formatAmount(amount: string, decimals: number): string {
  try {
    const v = Number(BigInt(amount)) / 10 ** decimals;
    return v.toLocaleString(undefined, { maximumFractionDigits: v >= 1 ? 4 : 6 });
  } catch {
    return "—";
  }
}

function toBigIntSafe(value: unknown): bigint | null {
  if (typeof value !== "string" || !value.length) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function formatPercent(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const v = Math.abs(value) < 0.0005 ? 0 : value;
  return `${v.toFixed(fractionDigits)}%`;
}

function formatSignedAmount(amount: bigint, decimals: number, symbol: string): string {
  const sign = amount === 0n ? "" : amount > 0n ? "+" : "-";
  const abs = amount < 0n ? -amount : amount;
  const formatted = formatAmount(abs.toString(), decimals);
  return formatted === "—" ? "—" : `${sign}${formatted} ${symbol}`;
}

// Convert human-readable amount to wei (atomic units)
function toWei(amount: string, decimals: number): string {
  try {
    const cleanAmount = amount.replace(/,/g, "");
    // Handle decimal amounts
    const parts = cleanAmount.split(".");
    const wholePart = parts[0] || "0";
    let decimalPart = parts[1] || "";
    
    // Pad or truncate decimal part to match decimals
    if (decimalPart.length < decimals) {
      decimalPart = decimalPart.padEnd(decimals, "0");
    } else if (decimalPart.length > decimals) {
      decimalPart = decimalPart.slice(0, decimals);
    }
    
    // Combine and convert to BigInt
    const combined = wholePart + decimalPart;
    // Remove leading zeros but keep at least one digit
    const result = combined.replace(/^0+/, "") || "0";
    return result;
  } catch {
    return "0";
  }
}

// Rank badges for providers
const RANK_BADGES = ["🥇", "🥈", "🥉"];

// Render providers list with all enhancements
function renderProviders(
  container: HTMLElement,
  quotes: RankedQuote[],
  toTokenInfo: { decimals: number; symbol: string },
  toTokenSymbol: string,
  showAll: boolean,
  setSelected: (q: RankedQuote) => void,
) {
  // Find or create providers list container
  let listContainer = container.querySelector("#providersList") as HTMLElement | null;
  if (!listContainer) {
    // Fallback: use the container itself
    listContainer = container;
  }
  
  // Clear existing items
  listContainer.innerHTML = "";

  const displayQuotes = showAll ? quotes : quotes.slice(0, 3);
  const hasMore = quotes.length > 3 && !showAll;

  // Calculate average for delta %
  const avgBuyAmount = (() => {
    const buys = quotes
      .map((q) => toBigIntSafe(q.normalized.buyAmount ?? q.raw.buyAmount))
      .filter((x): x is bigint => x !== null);
    if (!buys.length) return null;
    const sum = buys.reduce((a, b) => a + b, 0n);
    return sum / BigInt(buys.length);
  })();

  // Get best buy amount for delta % calculation
  const bestBuyAmount = toBigIntSafe(quotes[0]?.normalized.buyAmount ?? quotes[0]?.raw.buyAmount);

  displayQuotes.forEach((q, idx) => {
    const item = document.createElement("div");
    item.className = `provider-item${idx === 0 ? " selected" : ""}`;
    
    const buyAmount = toBigIntSafe(q.normalized.buyAmount ?? q.raw.buyAmount);
    const out = formatAmount(q.normalized.buyAmount ?? q.raw.buyAmount, toTokenInfo.decimals);
    const beq = typeof q.score?.beqScore === "number" ? Math.round(q.score.beqScore) : null;
    
    // Calculate delta % vs best
    let deltaPercent = "";
    if (bestBuyAmount && buyAmount && idx > 0) {
      const diff = Number(buyAmount - bestBuyAmount) / Number(bestBuyAmount) * 100;
      deltaPercent = `${diff.toFixed(2)}%`;
    }

    // MEV flag
    const mevLevel = q.signals?.mevExposure?.level;
    const mevFlag = mevLevel === "LOW" ? "✓ MEV" : mevLevel === "HIGH" ? "⚠️ MEV" : "";

    // Confidence score (using reliabilityFactor from v2Details as proxy)
    const reliabilityFactor = q.score?.v2Details?.components?.reliabilityFactor;
    const confidence = typeof reliabilityFactor === "number" ? Math.round(reliabilityFactor * 100) : null;
    const confidenceText = confidence !== null ? `${confidence}%` : "";

    // Rank badge
    const rankBadge = idx < 3 ? RANK_BADGES[idx] : `#${idx + 1}`;

    // Calculate savings vs avg
    let savingsText = "—";
    if (avgBuyAmount !== null && buyAmount !== null) {
      const diff = buyAmount - avgBuyAmount;
      savingsText = formatSignedAmount(diff, toTokenInfo.decimals, toTokenSymbol);
    }

    item.innerHTML = `
      <div class="provider-left">
        <div class="provider-logo">${rankBadge}</div>
        <div>
          <div class="provider-name">${q.providerId}</div>
          <div class="provider-rate">${beq !== null ? `BEQ ${beq}` : ""}${confidenceText ? ` • 🎯${confidenceText}` : ""}${mevFlag ? ` • ${mevFlag}` : ""}${deltaPercent ? ` • ${deltaPercent}` : ""}</div>
        </div>
      </div>
      <div class="provider-right">
        <div class="provider-output">${out} ${toTokenSymbol}</div>
        <div class="provider-savings">${savingsText}</div>
      </div>
    `;

    item.onclick = () => {
      listContainer.querySelectorAll(".provider-item").forEach((x) => x.classList.remove("selected"));
      item.classList.add("selected");
      setSelected(q);
    };

    listContainer.appendChild(item);
  });

  // Add "Show more" button if needed
  if (hasMore) {
    const showMoreBtn = document.createElement("button");
    showMoreBtn.className = "show-more-btn";
    showMoreBtn.style.cssText = `
      width: 100%;
      padding: 12px;
      background: var(--bg-card-inner);
      border: 1px dashed var(--border);
      border-radius: 12px;
      color: var(--text-secondary);
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 8px;
    `;
    showMoreBtn.textContent = `Show ${quotes.length - 3} more providers...`;
    showMoreBtn.onmouseover = () => {
      showMoreBtn.style.borderColor = "var(--accent)";
      showMoreBtn.style.color = "var(--accent)";
    };
    showMoreBtn.onmouseout = () => {
      showMoreBtn.style.borderColor = "var(--border)";
      showMoreBtn.style.color = "var(--text-secondary)";
    };
    // The click event is handled by the useEffect that re-renders with showAll=true
    showMoreBtn.id = "showMoreProvidersBtn";
    listContainer.appendChild(showMoreBtn);
  }
}

export function LandioSwapController() {
  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: GLOBAL SETTINGS & CONTEXT PROVIDERS
  // ═══════════════════════════════════════════════════════════════════════════
  const { settings, updateSettings } = useSettings();
  const { resolveToken, tokens: allTokens } = useTokenRegistry();
  const { address, isConnected } = useAccount();

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: TOKEN STATE
  // ═══════════════════════════════════════════════════════════════════════════
  const [fromTokenSymbol, setFromTokenSymbol] = useState("BNB");
  const [toTokenSymbol, setToTokenSymbol] = useState("ETH");
  const [fromAmountWei, setFromAmountWei] = useState("0");
  const [fromAmountValue, setFromAmountValue] = useState(0);
  const [toAmountValue, setToAmountValue] = useState(0);
  const [swapValueUsd, setSwapValueUsd] = useState(0);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: UI CONTROL STATE (Modals, Drawers, Toggles)
  // ═══════════════════════════════════════════════════════════════════════════
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"from" | "to">("from");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [scoringMode, setScoringMode] = useState<"BEQ" | "RAW">("BEQ");
  const [refreshCountdown, setRefreshCountdown] = useState(12);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: INTERNAL REFS (Debounce, Request Tracking)
  // ═══════════════════════════════════════════════════════════════════════════
  const lastRequestIdRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const successToastShownRef = useRef<string | null>(null); // Track txHash to prevent duplicate toasts
  const errorToastShownRef = useRef<string | null>(null); // Track error to prevent duplicate error toasts
  const manualApprovalDoneRef = useRef(false); // Track if manual approval was done in-swap to prevent button loop
  // Ref to store current values for debounced callback (avoids stale closures)
  const currentParamsRef = useRef<{
    fromTokenInfo: TokenInfo | null;
    toTokenInfo: TokenInfo | null;
    effectiveSlippageBps: number;
    settings: typeof settings;
  }>({ fromTokenInfo: null, toTokenInfo: null, effectiveSlippageBps: 50, settings });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5: API RESPONSE STATE (Quotes)
  // ═══════════════════════════════════════════════════════════════════════════
  const [response, setResponse] = useState<QuoteResponse | null>(null);
  const [selected, setSelected] = useState<RankedQuote | null>(null);
  const [receipt, setReceipt] = useState<DecisionReceipt | null>(null);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6: TRANSACTION HISTORY STATE
  // ═══════════════════════════════════════════════════════════════════════════
  const [txHistory, setTxHistory] = useState<StoredTransaction[]>([]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 7: TOAST NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const toast = useToast();

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 8: TOKEN REGISTRY & RESOLUTION (useMemo)
  // ═══════════════════════════════════════════════════════════════════════════
  const fromTokenInfo = useMemo(() => resolveToken(fromTokenSymbol), [resolveToken, fromTokenSymbol]);
  const toTokenInfo = useMemo(() => resolveToken(toTokenSymbol), [resolveToken, toTokenSymbol]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 9: PRICES HOOK
  // ═══════════════════════════════════════════════════════════════════════════
  const priceTokenAddresses = useMemo(() => {
    const addresses: string[] = [];
    if (fromTokenInfo) addresses.push(fromTokenInfo.address);
    if (toTokenInfo) addresses.push(toTokenInfo.address);
    return addresses;
  }, [fromTokenInfo, toTokenInfo]);

  const { formatUsd, getPrice, prices } = useTokenPrices(priceTokenAddresses);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 10: BALANCES HOOK
  // ═══════════════════════════════════════════════════════════════════════════
  const balanceTokens = useMemo(() => {
    const tokens = [];
    if (fromTokenInfo) tokens.push(fromTokenInfo);
    if (toTokenInfo) tokens.push(toTokenInfo);
    return tokens.length > 0 ? tokens : BASE_TOKENS.slice(0, 2);
  }, [fromTokenInfo, toTokenInfo]);

  const { getBalanceFormatted, getBalance, isLoading: isLoadingBalances, refetch: refetchBalances } = useTokenBalances(balanceTokens);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 11: SWAP EXECUTION HOOK
  // ═══════════════════════════════════════════════════════════════════════════
  const {
    status: swapStatus,
    error: swapError,
    txHash,
    buildTransaction,
    executeSwap,
    reset: resetSwap,
    isBuilding,
    isPending,
    isSuccess,
  } = useExecuteSwap();

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 12: TOKEN APPROVAL HOOK
  // ═══════════════════════════════════════════════════════════════════════════
  const isFromNative = fromTokenInfo?.isNative ?? false;
  const approvalAmount = useMemo(() => {
    try {
      return BigInt(fromAmountWei || "0");
    } catch {
      return 0n;
    }
  }, [fromAmountWei]);

  const {
    needsApproval,
    isApproving,
    isApproved,
    approve,
    allowance,
    refetchAllowance,
  } = useTokenApproval({
    tokenAddress: isFromNative ? undefined : (fromTokenInfo?.address as Address | undefined),
    spenderAddress: UNIVERSAL_ROUTER_ADDRESS,
    amount: approvalAmount,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 13: DYNAMIC SLIPPAGE
  // ═══════════════════════════════════════════════════════════════════════════
  const dynamicSlippage = useDynamicSlippage({
    quote: selected,
    userSlippageBps: settings.slippageBps,
    autoSlippageEnabled: settings.autoSlippage ?? true,
    tokenSymbol: toTokenInfo?.symbol ?? "TOKEN",
  });

  // Effective slippage to use (dynamic when auto-enabled)
  const effectiveSlippageBps = dynamicSlippage.slippageBps;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 14: PILOT TIER & FEES
  // ═══════════════════════════════════════════════════════════════════════════
  const { data: pilotTierInfo, isLoading: isPilotTierLoading } = usePilotTier();
  const { data: feeInfo, isLoading: isFeeLoading } = useFeeCalculation(swapValueUsd);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 15: DERIVED STATE (useMemo)
  // ═══════════════════════════════════════════════════════════════════════════
  // Check if balance is insufficient (with tolerance for display rounding)
  const hasInsufficientBalance = useMemo(() => {
    if (!fromTokenInfo || !isConnected) return false;
    const balanceRaw = getBalance(fromTokenInfo);
    try {
      const balanceBigInt = BigInt(balanceRaw || "0");
      const amountBigInt = BigInt(fromAmountWei || "0");
      if (amountBigInt === 0n) return false;
      // Allow 0.01% tolerance for display rounding issues
      const tolerance = balanceBigInt / 10000n;
      return amountBigInt > balanceBigInt + tolerance;
    } catch {
      return false;
    }
  }, [fromTokenInfo, isConnected, getBalance, fromAmountWei]);

  // Filter tokens for picker - includes dynamic resolution for unknown addresses
  const filteredTokens = useMemo(() => {
    const tokens = allTokens.length > 0 ? allTokens : BASE_TOKENS;
    if (!searchQuery.trim()) return tokens;
    const q = searchQuery.toLowerCase().trim();
    
    // Filter existing tokens by symbol, name, or address
    const filtered = tokens.filter(t => 
      t.symbol.toLowerCase().includes(q) || 
      t.name.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q)
    );
    
    // If no results and query looks like an address, try to resolve it
    if (filtered.length === 0 && isAddress(q)) {
      const resolved = resolveToken(q);
      if (resolved) {
        return [resolved];
      }
    }
    
    return filtered;
  }, [allTokens, searchQuery, resolveToken]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 16: HANDLERS (useCallback)
  // ═══════════════════════════════════════════════════════════════════════════
  // Token picker modal handler
  const selectToken = useCallback((token: TokenInfo) => {
    if (pickerTarget === "from") {
      if (token.symbol === toTokenSymbol) {
        // Swap if selecting same token
        setToTokenSymbol(fromTokenSymbol);
      }
      setFromTokenSymbol(token.symbol);
    } else {
      if (token.symbol === fromTokenSymbol) {
        // Swap if selecting same token
        setFromTokenSymbol(toTokenSymbol);
      }
      setToTokenSymbol(token.symbol);
    }
    setPickerOpen(false);
    
    // Reset manual approval flag when changing tokens
    manualApprovalDoneRef.current = false;
    
    // Clear amounts and reset
    const fromAmountInput = document.getElementById('fromAmount') as HTMLInputElement | null;
    const toAmountInput = document.getElementById('toAmount') as HTMLInputElement | null;
    if (fromAmountInput) fromAmountInput.value = "";
    if (toAmountInput) toAmountInput.value = "";
    setFromAmountValue(0);
    setToAmountValue(0);
    setResponse(null);
    setSelected(null);
    setDisplay("beqContainer", "none");
    setDisplay("routeContainer", "none");
    setDisplay("providersContainer", "none");
    setDisplay("detailsToggle", "none");
    setDisabled("swapBtn", true);
    setSwapBtnText("Enter an amount");
  }, [pickerTarget, fromTokenSymbol, toTokenSymbol]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 17: REF SYNC EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════
  // Keep refs up to date for debounced callbacks
  useEffect(() => {
    currentParamsRef.current = {
      fromTokenInfo: fromTokenInfo ?? null,
      toTokenInfo: toTokenInfo ?? null,
      effectiveSlippageBps,
      settings,
    };
  }, [fromTokenInfo, toTokenInfo, effectiveSlippageBps, settings]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 18: INITIALIZATION EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════
  // Load transaction history from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(TX_HISTORY_KEY);
      if (stored) {
        setTxHistory(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Ensure the template starts hidden and reset BEQ values
  useEffect(() => {
    setDisplay("beqContainer", "none");
    setDisplay("routeContainer", "none");
    setDisplay("providersContainer", "none");
    setDisplay("detailsToggle", "none");
    setDisabled("swapBtn", true);
    
    // Reset BEQ values to placeholder (they will be updated when quotes load)
    setText("priceImpact", "—");
    setText("gasCost", "—");
    setText("mevRisk", "—");
    setText("netOutput", "—");
    setText("beqScore", "—");
  }, []);
  
  // Update slippage display dynamically when settings change
  useEffect(() => {
    const slippageDisplay = document.getElementById("slippageDisplay");
    if (slippageDisplay) {
      const pct = effectiveSlippageBps / 100;
      const autoIndicator = dynamicSlippage.isAuto ? "⚡ " : "";
      slippageDisplay.textContent = `${autoIndicator}${pct.toFixed(pct % 1 === 0 ? 0 : 2)}%`;
      slippageDisplay.title = dynamicSlippage.reason;
    }
  }, [effectiveSlippageBps, dynamicSlippage.isAuto, dynamicSlippage.reason]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 19: DOM SYNC EFFECTS - Balance & USD Display
  // ═══════════════════════════════════════════════════════════════════════════
  // Update USD values when amounts or prices change
  useEffect(() => {
    const fromUsdEl = document.getElementById('fromUsdValue');
    const toUsdEl = document.getElementById('toUsdValue');

    if (fromUsdEl && fromTokenInfo) {
      if (fromAmountValue > 0) {
        const usdFormatted = formatUsd(fromTokenInfo.address, fromAmountValue);
        fromUsdEl.textContent = `≈ ${usdFormatted}`;
      } else {
        fromUsdEl.textContent = "≈ $0.00";
      }
    }

    if (toUsdEl && toTokenInfo) {
      if (toAmountValue > 0) {
        const usdFormatted = formatUsd(toTokenInfo.address, toAmountValue);
        toUsdEl.textContent = `≈ ${usdFormatted}`;
      } else {
        toUsdEl.textContent = "≈ $0.00";
      }
    }
  }, [fromAmountValue, toAmountValue, fromTokenInfo, toTokenInfo, formatUsd, prices]);

  // Update balance displays when wallet connects/disconnects
  useEffect(() => {
    const fromBalanceLabel = document.getElementById('fromBalanceLabel');
    const toBalanceLabel = document.getElementById('toBalanceLabel');

    if (fromBalanceLabel && fromTokenInfo) {
      if (isConnected && !isLoadingBalances) {
        const balance = getBalanceFormatted(fromTokenInfo);
        fromBalanceLabel.innerHTML = `Balance: ${balance} <button class="max-btn">MAX</button>`;
      } else if (isConnected && isLoadingBalances) {
        fromBalanceLabel.innerHTML = `Balance: ... <button class="max-btn">MAX</button>`;
      } else {
        fromBalanceLabel.innerHTML = `Balance: -- <button class="max-btn">MAX</button>`;
      }
    }

    if (toBalanceLabel && toTokenInfo) {
      if (isConnected && !isLoadingBalances) {
        const balance = getBalanceFormatted(toTokenInfo);
        toBalanceLabel.textContent = `Balance: ${balance}`;
      } else if (isConnected && isLoadingBalances) {
        toBalanceLabel.textContent = `Balance: ...`;
      } else {
        toBalanceLabel.textContent = `Balance: --`;
      }
    }

    // Hook up MAX button
    const maxBtn = fromBalanceLabel?.querySelector('.max-btn');
    const fromAmountInput = document.getElementById('fromAmount') as HTMLInputElement | null;
    const handleMax = () => {
      if (fromAmountInput && fromTokenInfo && isConnected) {
        const balance = getBalanceFormatted(fromTokenInfo);
        fromAmountInput.value = balance;
        fromAmountInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    maxBtn?.addEventListener('click', handleMax);

    return () => {
      maxBtn?.removeEventListener('click', handleMax);
    };
  }, [isConnected, isLoadingBalances, getBalanceFormatted, fromTokenInfo, toTokenInfo]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 20: DOM SYNC EFFECTS - Settings Modal
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Hook up settings modal buttons in the template.
    const openBtn = document.getElementById("openSlippage");
    const closeBtn = document.getElementById("closeSlippage");
    const modal = document.getElementById("slippageModal") as HTMLElement | null;

    const open = () => {
      // Landio template uses `.slippage-modal.open` for visibility.
      if (modal) modal.classList.add("open");
    };

    const close = () => {
      if (modal) modal.classList.remove("open");
    };

    openBtn?.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);

    const onBackdrop = (e: MouseEvent) => {
      if (e.target === modal) close();
    };
    modal?.addEventListener("click", onBackdrop);

    // Bind slippage options (0.1/0.5/1.0)
    const optionEls = Array.from(document.querySelectorAll<HTMLElement>(".slippage-option"));
    const values = [10, 50, 100];
    optionEls.forEach((el, idx) => {
      el.addEventListener("click", () => {
        optionEls.forEach((x) => x.classList.remove("active"));
        el.classList.add("active");
        const bps = values[idx] ?? 50;
        updateSettings({ slippageBps: bps });
      });
    });

    return () => {
      openBtn?.removeEventListener("click", open);
      closeBtn?.removeEventListener("click", close);
      modal?.removeEventListener("click", onBackdrop);
    };
  }, [updateSettings]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 21: MAIN QUOTE FETCH & SWAP LOGIC (Core Business Logic)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const amountInput = document.getElementById("fromAmount") as HTMLInputElement | null;
    const toAmountInput = document.getElementById("toAmount") as HTMLInputElement | null;

    const detailsToggle = document.getElementById("detailsToggle");
    const detailsContent = document.getElementById("detailsContent") as HTMLElement | null;

    const onToggleDetails = () => {
      if (!detailsContent) return;
      const isVisible = detailsContent.classList.toggle("active");
      const icon = detailsToggle?.querySelector<HTMLElement>(".details-toggle-icon");
      if (icon) icon.style.transform = isVisible ? "rotate(180deg)" : "rotate(0deg)";
    };

    detailsToggle?.addEventListener("click", onToggleDetails);

    const onInput = () => {
      const rawValue = amountInput?.value ?? "";
      const valueNum = parseNumber(rawValue);

      // Update fromAmount for USD calculation
      setFromAmountValue(valueNum);

      // Update fromAmountWei for approval check
      if (fromTokenInfo && valueNum > 0) {
        setFromAmountWei(toWei(rawValue, fromTokenInfo.decimals));
        // Update swap value in USD for fee calculation
        const price = getPrice(fromTokenInfo.address);
        if (price) {
          setSwapValueUsd(valueNum * price);
        }
      } else {
        setFromAmountWei("0");
        setSwapValueUsd(0);
      }

      // Reset refresh countdown
      setRefreshCountdown(12);

      setResponse(null);
      setSelected(null);
      setShowAllProviders(false);

      if (!amountInput || !toAmountInput || valueNum <= 0) {
        setFromAmountValue(0);
        setToAmountValue(0);
        setFromAmountWei("0");
        setDisplay("beqContainer", "none");
        setDisplay("routeContainer", "none");
        setDisplay("providersContainer", "none");
        setDisplay("detailsToggle", "none");
        setDisabled("swapBtn", true);
        setSwapBtnText("Enter an amount");
        if (toAmountInput) toAmountInput.value = "";
        return;
      }

      if (!fromTokenInfo || !toTokenInfo) {
        setSwapBtnText("Loading tokens...");
        setDisabled("swapBtn", true);
        return;
      }

      // Check if user has sufficient balance before fetching quotes
      // Also determine the actual amount to use (may be capped to exact balance)
      let finalSellAmountWei = toWei(rawValue, fromTokenInfo.decimals);
      
      if (isConnected) {
        const balanceRaw = getBalance(fromTokenInfo);
        try {
          const balanceBigInt = BigInt(balanceRaw || "0");
          if (balanceBigInt === 0n) {
            setDisplay("beqContainer", "none");
            setDisplay("routeContainer", "none");
            setDisplay("providersContainer", "none");
            setDisplay("detailsToggle", "none");
            setDisabled("swapBtn", true);
            setSwapBtnText(`No ${fromTokenInfo.symbol} balance`);
            if (toAmountInput) toAmountInput.value = "";
            return;
          }
          const amountBigInt = BigInt(finalSellAmountWei || "0");
          
          // Allow a small tolerance (0.01%) to account for display rounding
          // If user enters a value very close to their balance, cap it to balance
          const tolerance = balanceBigInt / 10000n; // 0.01%
          if (amountBigInt > balanceBigInt && amountBigInt <= balanceBigInt + tolerance) {
            // User likely entered the displayed (rounded) balance - use exact balance
            finalSellAmountWei = balanceRaw;
            setFromAmountWei(balanceRaw); // Use exact balance
            console.info("[landio][input] capped to exact balance:", balanceRaw);
          }
          
          if (amountBigInt > balanceBigInt + tolerance) {
            setDisplay("beqContainer", "none");
            setDisplay("routeContainer", "none");
            setDisplay("providersContainer", "none");
            setDisplay("detailsToggle", "none");
            setDisabled("swapBtn", true);
            setSwapBtnText(`Insufficient ${fromTokenInfo.symbol} balance`);
            if (toAmountInput) toAmountInput.value = "";
            return;
          }
        } catch {
          // Ignore balance check errors, continue with quote fetch
        }
      }

      // Show analyzing shimmer state
      const swapContainer = document.querySelector<HTMLElement>(".swap-container");
      swapContainer?.classList.add("analyzing-state");
      setSwapBtnText("Analyzing...");
      setDisabled("swapBtn", true);

      // Cancel previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Capture current values in local variables for the debounced callback
      const capturedFromTokenInfo = fromTokenInfo;
      const capturedToTokenInfo = toTokenInfo;
      const capturedSellAmountWei = finalSellAmountWei; // Use the corrected amount (may be capped to balance)

      // Debounce the API call by 500ms
      debounceTimerRef.current = setTimeout(async () => {
        const requestId = ++lastRequestIdRef.current;
        
        // Use captured values and ref for slippage (which may have changed)
        const currentSlippageBps = currentParamsRef.current.effectiveSlippageBps;
        const currentSettings = currentParamsRef.current.settings;

        try {
          const res = await postQuotes({
            request: {
              chainId: 56,
              sellToken: capturedFromTokenInfo.address,
              buyToken: capturedToTokenInfo.address,
              sellAmount: capturedSellAmountWei, // Use the captured (possibly corrected) amount
              slippageBps: currentSlippageBps, // Use current slippage from ref
              mode: currentSettings.mode,
              scoringOptions: {
                sellabilityCheck: currentSettings.sellabilityCheck,
                mevAwareScoring: currentSettings.mevAwareScoring,
                canonicalPoolsOnly: currentSettings.canonicalPoolsOnly,
              },
              sellTokenDecimals: capturedFromTokenInfo.decimals,
              buyTokenDecimals: capturedToTokenInfo.decimals,
            },
            timeoutMs: 12_000,
          });

        if (requestId !== lastRequestIdRef.current) return;

        setResponse(res);
        const best = (res.rankedQuotes ?? [])[0] ?? null;
        setSelected(best);

        // Update UI
        setDisplay("beqContainer", "block");
        setDisplay("routeContainer", "block");
        setDisplay("providersContainer", "block");
        setDisplay("detailsToggle", "flex");

        const buyAmount = best?.normalized.buyAmount ?? best?.raw.buyAmount;
        const formatted = buyAmount ? formatAmount(buyAmount, toTokenInfo.decimals) : "—";
        toAmountInput.value = formatted === "—" ? "" : formatted;

        // Update toAmount for USD calculation
        if (buyAmount) {
          try {
            const toNum = Number(BigInt(buyAmount)) / 10 ** toTokenInfo.decimals;
            setToAmountValue(toNum);
          } catch {
            setToAmountValue(0);
          }
        } else {
          setToAmountValue(0);
        }

        const score = best?.score?.beqScore;
        if (typeof score === "number") {
          setText("beqScore", `${Math.round(score)}/100`);
          setWidth("beqProgress", `${Math.max(0, Math.min(100, score))}%`);
        }

        // Fill provider list dynamically (respects showAllProviders)
        // This initial render shows top 3, the showAllProviders effect will re-render
        const container = document.getElementById("providersContainer");
        if (container && res.rankedQuotes) {
          renderProviders(container, res.rankedQuotes, toTokenInfo, toTokenSymbol, false, setSelected);
        }

        // BEQ details + route + transaction details
        const bestBuy = toBigIntSafe(best?.normalized.buyAmount ?? best?.raw.buyAmount);
        const maxBuy = (() => {
          const buys = (res.rankedQuotes ?? [])
            .map((q) => toBigIntSafe(q.normalized.buyAmount ?? q.raw.buyAmount))
            .filter((x): x is bigint => x !== null);
          if (!buys.length) return null;
          return buys.reduce((a, b) => (b > a ? b : a), buys[0]!);
        })();

        // Price Impact: use a quote-relative proxy (best vs best-raw)
        if (bestBuy !== null && maxBuy !== null && maxBuy > 0n) {
          const ratio = Number(bestBuy) / Number(maxBuy);
          const pct = (1 - ratio) * 100;
          // Only show negative sign if there's actual impact, format nicely
          if (pct < 0.01) {
            setText("priceImpact", "0.00%");
          } else {
            setText("priceImpact", `-${formatPercent(clamp(pct, 0, 99.99), 2)}`);
          }
        } else {
          setText("priceImpact", "—");
        }

        // Gas & MEV - format gas USD properly
        const gasUsdRaw = parseFloat(best?.normalized.estimatedGasUsd ?? "");
        const formattedGas = Number.isFinite(gasUsdRaw) && gasUsdRaw >= 0 && gasUsdRaw < 1000
          ? `$${gasUsdRaw.toFixed(2)}`
          : "$—";
        setText("gasCost", formattedGas);
        setText(
          "mevRisk",
          best?.signals?.mevExposure?.level ? (best.signals.mevExposure.level === "HIGH" ? "Exposed" : "Protected") : "—",
        );

        // Net Output: show delta vs worst quote (actual savings)
        const allBuys = (res.rankedQuotes ?? [])
          .map((q) => toBigIntSafe(q.normalized.buyAmount ?? q.raw.buyAmount))
          .filter((x): x is bigint => x !== null);
        const worstBuy = allBuys.length > 1 ? allBuys.reduce((a, b) => (b < a ? b : a), allBuys[0]!) : null;
        const avgBuy = allBuys.length > 0 
          ? allBuys.reduce((a, b) => a + b, 0n) / BigInt(allBuys.length)
          : null;
        
        if (bestBuy !== null && worstBuy !== null && bestBuy !== worstBuy) {
          setText("netOutput", formatSignedAmount(bestBuy - worstBuy, toTokenInfo.decimals, toTokenSymbol));
        } else if (bestBuy !== null) {
          // Only one quote or all same - show actual output
          const outFormatted = formatAmount(bestBuy.toString(), toTokenInfo.decimals);
          setText("netOutput", `${outFormatted} ${toTokenSymbol}`);
        } else {
          setText("netOutput", "—");
        }

        // Route: derive from quote route addresses when present
        const routeAddrs = Array.isArray(best?.raw?.route) ? best!.raw!.route : [];
        const routeSymbols = routeAddrs
          .map((addr) => resolveToken(String(addr)))
          .filter((t): t is NonNullable<ReturnType<typeof resolveToken>> => Boolean(t))
          .map((t) => t.symbol);

        const fromSym = fromTokenInfo.symbol;
        const toSym = toTokenInfo.symbol;
        const mid = routeSymbols.filter((s) => s !== fromSym && s !== toSym);
        const compactMid = mid.length > 0 ? "…" : null;
        const path = [fromSym, compactMid, toSym].filter((x): x is string => Boolean(x));

        const p0 = path[0] ?? "—";
        const p1 = path[1] ?? "—";
        const p2 = path[2] ?? "—";
        const routeHtml =
          `<div class="route-step"><div class="route-token"><div class="route-token-icon">${p0.slice(0, 1)}</div><span class="route-token-name">${p0}</span></div></div>` +
          `<span class="route-arrow">→</span>` +
          `<span class="route-dex">${best?.providerId ?? "—"}</span>` +
          `<span class="route-arrow">→</span>` +
          (path.length === 3
            ? `<div class="route-step"><div class="route-token"><div class="route-token-icon">${p1}</div><span class="route-token-name">${p1}</span></div></div><span class="route-arrow">→</span>` +
              `<div class="route-step"><div class="route-token"><div class="route-token-icon">${p2.slice(0, 1)}</div><span class="route-token-name">${p2}</span></div></div>`
            : `<div class="route-step"><div class="route-token"><div class="route-token-icon">${p1.slice(0, 1)}</div><span class="route-token-name">${p1}</span></div></div>`);
        setHtml("#routeContainer .route-path", routeHtml);

        // Details accordion rows
        const detailsRows = Array.from(document.querySelectorAll<HTMLElement>("#detailsContent .detail-row"));
        const slippagePct = effectiveSlippageBps / 100;
        const outHuman = bestBuy !== null ? Number(bestBuy) / 10 ** toTokenInfo.decimals : null;
        const rate = outHuman !== null && valueNum > 0 ? outHuman / valueNum : null;
        const minReceived = outHuman !== null ? outHuman * (1 - effectiveSlippageBps / 10_000) : null;

        for (const row of detailsRows) {
          const cells = row.querySelectorAll("span");
          const labelEl = cells[0] as HTMLElement | undefined;
          const valueEl = cells[1] as HTMLElement | undefined;
          if (!labelEl || !valueEl) continue;
          const label = (labelEl.textContent ?? "").trim();

          if (label === "Rate") {
            valueEl.textContent = rate !== null ? `1 ${fromTokenSymbol} = ${rate.toFixed(rate >= 1 ? 4 : 6)} ${toTokenSymbol}` : "—";
          } else if (label === "Slippage Tolerance") {
            const autoIndicator = dynamicSlippage.isAuto ? "⚡ " : "";
            valueEl.textContent = `${autoIndicator}${slippagePct.toFixed(slippagePct % 1 === 0 ? 0 : 2)}%`;
            valueEl.title = dynamicSlippage.reason;
          } else if (label === "Minimum Received") {
            valueEl.textContent = minReceived !== null ? `${minReceived.toFixed(minReceived >= 1 ? 4 : 6)} ${toTokenSymbol}` : "—";
          } else if (label === "Network Fee") {
            // Format network fee properly - validate it's a reasonable value
            const networkFeeRaw = parseFloat(best?.normalized.estimatedGasUsd ?? "");
            valueEl.textContent = Number.isFinite(networkFeeRaw) && networkFeeRaw >= 0 && networkFeeRaw < 1000
              ? `~$${networkFeeRaw.toFixed(2)}`
              : "—";
          } else if (label === "Platform Fee") {
            // Use feeInfo from the hook if available
            if (feeInfo && pilotTierInfo) {
              const tierName = getTierDisplay(pilotTierInfo.tier);
              valueEl.textContent = feeInfo.feeAmountUsd > 0 ? `$${formatFee(feeInfo.feeAmountUsd)} (${tierName})` : `$0.00 (${tierName})`;
            } else {
              valueEl.textContent = "$0.00 (Free)";
            }
          } else if (label === "You Save") {
            // Show savings vs worst quote
            if (bestBuy !== null && worstBuy !== null && bestBuy !== worstBuy) {
              valueEl.textContent = formatSignedAmount(bestBuy - worstBuy, toTokenInfo.decimals, toTokenSymbol);
            } else {
              valueEl.textContent = "—";
            }
          }
        }

        setSwapBtnText("Swap");
        setDisabled("swapBtn", false);

        // Store the receipt if available
        if (res.receipt) {
          setReceipt(res.receipt);
        }
        } catch {
          if (requestId !== lastRequestIdRef.current) return;
          toast.error("Failed to fetch quotes", "Please try again");
          setSwapBtnText("Failed to fetch quotes");
          setDisabled("swapBtn", true);
        } finally {
          const swapContainer = document.querySelector<HTMLElement>(".swap-container");
          swapContainer?.classList.remove("analyzing-state");
        }
      }, QUOTE_DEBOUNCE_MS); // End of debounce setTimeout
    };

    amountInput?.addEventListener("input", onInput);

    // Swap button action - use buildTx for capable providers, fallback to deepLink
    const swapBtn = document.getElementById("swapBtn") as HTMLButtonElement | null;
    const onSwap = async () => {
      if (!selected || !fromTokenInfo || !toTokenInfo || !address) return;

      const hasBuildTx = selected.capabilities?.buildTx === true;

      if (!hasBuildTx) {
        // Fallback to deepLink for providers without buildTx
        if (selected.deepLink) {
          window.open(selected.deepLink, "_blank", "noopener,noreferrer");
          toast.info("Opening external swap", `Redirecting to ${selected.providerId}`);
        } else {
          toast.error("No execution method", `${selected.providerId} doesn't support direct swaps`);
        }
        return;
      }

      if (!isConnected) {
        toast.error("Wallet not connected", "Please connect your wallet to swap");
        return;
      }

      // Add transaction to history optimistically (pending state)
      const txId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const fromAmountInputEl = document.getElementById("fromAmount") as HTMLInputElement | null;
      const toAmountInputEl = document.getElementById("toAmount") as HTMLInputElement | null;
      const pendingTx: StoredTransaction = {
        id: txId,
        timestamp: Date.now(),
        fromToken: fromTokenSymbol,
        toToken: toTokenSymbol,
        fromAmount: fromAmountInputEl?.value || "0",
        toAmount: toAmountInputEl?.value || "0",
        status: "pending",
        providerId: selected.providerId,
      };
      setTxHistory((prev) => {
        const updated = [pendingTx, ...prev].slice(0, 50);
        localStorage.setItem(TX_HISTORY_KEY, JSON.stringify(updated));
        return updated;
      });

      const loadingToastId = toast.loading("Building transaction...", `Preparing swap via ${selected.providerId}`);

      try {
        setSwapBtnText("Building...");
        setDisabled("swapBtn", true);

        // Use the state-stored amount which may have been capped to exact balance
        // This prevents TRANSFER_FROM_FAILED errors due to rounding differences
        const sellAmountWei = fromAmountWei || toWei(fromAmountInputEl?.value ?? "0", fromTokenInfo.decimals);

        // Step 1: Build the transaction
        const tx = await buildTransaction({
          providerId: selected.providerId,
          sellToken: fromTokenInfo.address,
          buyToken: toTokenInfo.address,
          sellAmount: sellAmountWei,
          slippageBps: effectiveSlippageBps, // Use dynamic slippage
          quoteRaw: selected.raw,
          quoteNormalized: selected.normalized,
        });

        if (!tx) {
          throw new Error("Failed to build transaction");
        }

        // Step 2: Check if approval is needed (for non-native tokens)
        const isNativeToken = fromTokenInfo.isNative ||
          fromTokenInfo.address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
          fromTokenInfo.address.toLowerCase() === "0x0000000000000000000000000000000000000000";

        if (!isNativeToken && tx.approvalAddress) {
          // Read current allowance directly using reliable BSC RPC
          const BSC_RPC = "https://bsc-dataseed1.binance.org";
          const publicClient = createPublicClient({
            chain: bsc,
            transport: http(BSC_RPC),
          });

          let currentAllowance = 0n;
          try {
            currentAllowance = await publicClient.readContract({
              address: fromTokenInfo.address as `0x${string}`,
              abi: erc20Abi,
              functionName: "allowance",
              args: [address as `0x${string}`, tx.approvalAddress as `0x${string}`],
            });
            console.info("[landio][swap] current allowance:", currentAllowance.toString(), "needed:", sellAmountWei);
          } catch (e) {
            console.warn("[landio][swap] failed to read allowance", e);
          }

          const sellAmountBigInt = BigInt(sellAmountWei);
          if (currentAllowance < sellAmountBigInt) {
            toast.updateToast(loadingToastId, {
              type: "info",
              title: "Approval required",
              message: `Please approve ${fromTokenSymbol} spending in your wallet`,
            });

            setSwapBtnText("Approving...");

            try {
              // Create wallet client from window.ethereum
              const ethereum = window.ethereum;
              if (!ethereum) {
                throw new Error("No wallet provider found");
              }
              const walletClient = createWalletClient({
                chain: bsc,
                transport: custom(ethereum as Parameters<typeof custom>[0]),
              });

              // Send approval transaction
              const approvalHash = await walletClient.writeContract({
                address: fromTokenInfo.address as `0x${string}`,
                abi: erc20Abi,
                functionName: "approve",
                args: [tx.approvalAddress as `0x${string}`, maxUint256],
                account: address as `0x${string}`,
              });

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

              toast.updateToast(loadingToastId, {
                type: "success",
                title: "Approval confirmed!",
                message: "Verifying allowance...",
              });

              // Mark manual approval as done to prevent button loop
              manualApprovalDoneRef.current = true;

              // Wait for chain state to propagate, then verify allowance
              await new Promise(resolve => setTimeout(resolve, 2000));
              refetchAllowance();
              
              // Re-verify allowance before proceeding
              let verifiedAllowance = 0n;
              for (let attempt = 0; attempt < 3; attempt++) {
                try {
                  verifiedAllowance = await publicClient.readContract({
                    address: fromTokenInfo.address as `0x${string}`,
                    abi: erc20Abi,
                    functionName: "allowance",
                    args: [address as `0x${string}`, tx.approvalAddress as `0x${string}`],
                  });
                  console.info(`[landio][swap] verified allowance (attempt ${attempt + 1}):`, verifiedAllowance.toString());
                  if (verifiedAllowance >= sellAmountBigInt) {
                    break;
                  }
                } catch (e) {
                  console.warn("[landio][swap] allowance verification failed", e);
                }
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 1500));
              }
              
              if (verifiedAllowance < sellAmountBigInt) {
                toast.updateToast(loadingToastId, {
                  type: "error",
                  title: "Approval not detected",
                  message: "Please try the swap again - the approval may take a moment to propagate",
                });
                setSwapBtnText("Swap");
                setDisabled("swapBtn", false);
                return;
              }
              
              toast.updateToast(loadingToastId, {
                type: "success",
                title: "Allowance verified!",
                message: "Now executing swap...",
              });

            } catch (approvalError) {
              const msg = approvalError instanceof Error ? approvalError.message : "Approval failed";
              toast.updateToast(loadingToastId, {
                type: "error",
                title: "Approval failed",
                message: msg.includes("User rejected") ? "User rejected the request" : msg,
              });
              // Update tx history to failed
              setTxHistory((prev) => {
                const updated = prev.map((t) => t.id === txId ? { ...t, status: "failed" as const } : t);
                localStorage.setItem(TX_HISTORY_KEY, JSON.stringify(updated));
                return updated;
              });
              setSwapBtnText("Swap");
              setDisabled("swapBtn", false);
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

        setSwapBtnText("Confirm in wallet...");
        executeSwap(tx);

        // The rest is handled by useEffect watching txHash and swapStatus

      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        toast.updateToast(loadingToastId, {
          type: "error",
          title: "Swap failed",
          message,
        });
        // Update tx history to failed
        setTxHistory((prev) => {
          const updated = prev.map((t) => t.id === txId ? { ...t, status: "failed" as const } : t);
          localStorage.setItem(TX_HISTORY_KEY, JSON.stringify(updated));
          return updated;
        });
        setSwapBtnText("Swap");
        setDisabled("swapBtn", false);
      }
    };
    swapBtn?.addEventListener("click", onSwap);

    // Cancel button event listener
    const cancelBtn = document.getElementById("cancelSwapBtn");
    const onCancel = () => {
      console.info("[swap][cancel] user cancelled pending swap");
      resetSwap();
      setSwapBtnText("Swap");
      setDisabled("swapBtn", false);
      // Mark pending transaction as cancelled
      setTxHistory((prev) => {
        const pendingTx = prev.find((t) => t.status === "pending");
        if (pendingTx) {
          const updated = prev.map((t) => t.id === pendingTx.id ? { ...t, status: "failed" as const } : t);
          localStorage.setItem(TX_HISTORY_KEY, JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
      toast.info("Swap cancelled", "You can try again with a new quote.");
    };
    cancelBtn?.addEventListener("click", onCancel);

    return () => {
      amountInput?.removeEventListener("input", onInput);
      detailsToggle?.removeEventListener("click", onToggleDetails);
      swapBtn?.removeEventListener("click", onSwap);
      cancelBtn?.removeEventListener("click", onCancel);
      // NOTE: Don't cleanup debounce timer here - it's managed by the timer itself
    };
  }, [
    address,
    buildTransaction,
    dynamicSlippage.isAuto,
    dynamicSlippage.reason,
    effectiveSlippageBps,
    executeSwap,
    feeInfo,
    fromTokenInfo,
    fromTokenSymbol,
    getBalance,
    getPrice,
    isConnected,
    pilotTierInfo,
    refetchAllowance,
    resetSwap,
    toTokenSymbol,
    resolveToken,
    selected,
    toast,
    toTokenInfo,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 22: SWAP STATUS EFFECTS (Success/Error Handling)
  // ═══════════════════════════════════════════════════════════════════════════
  // Handle swap status changes
  useEffect(() => {
    // Show/hide cancel button based on pending status
    const cancelBtn = document.getElementById("cancelSwapBtn");
    if (cancelBtn) {
      cancelBtn.style.display = swapStatus === "pending" ? "block" : "none";
    }

    if (swapStatus === "pending") {
      setSwapBtnText("Pending...");
      setDisabled("swapBtn", true);
    } else if (swapStatus === "success") {
      setSwapBtnText("Success!");
      setDisabled("swapBtn", true);
      
      // Show success toast only once per transaction
      if (txHash && successToastShownRef.current !== txHash) {
        successToastShownRef.current = txHash;
        toast.success("Swap successful!", `Transaction: ${txHash.slice(0, 10)}...`);
      }
      
      // Update the most recent pending transaction to success
      setTxHistory((prev) => {
        const pendingTx = prev.find((t) => t.status === "pending");
        if (pendingTx) {
          const updated = prev.map((t) => 
            t.id === pendingTx.id 
              ? { ...t, status: "success" as const, txHash: txHash ?? undefined } 
              : t
          );
          localStorage.setItem(TX_HISTORY_KEY, JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
      
      // Refresh balances and quotes after successful swap
      refetchAllowance();
      
      // Refresh balances multiple times to ensure UI updates
      // RPC nodes can have slight delays in reflecting new state
      console.info("[swap][success] refreshing balances...");
      refetchBalances(); // Immediate
      const balanceRefresh1 = setTimeout(() => refetchBalances(), 1000);  // 1s
      const balanceRefresh2 = setTimeout(() => refetchBalances(), 2500);  // 2.5s
      const balanceRefresh3 = setTimeout(() => refetchBalances(), 5000);  // 5s
      
      // Re-fetch quotes after a delay to let the chain state propagate
      const refreshTimeout = setTimeout(() => {
        const fromAmountInput = document.getElementById("fromAmount") as HTMLInputElement | null;
        if (fromAmountInput && fromAmountInput.value) {
          fromAmountInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }, 2000);
      
      // Reset after 3 seconds
      const timeout = setTimeout(() => {
        setSwapBtnText("Swap");
        setDisabled("swapBtn", false);
        successToastShownRef.current = null; // Reset toast tracker for next swap
        manualApprovalDoneRef.current = false; // Reset manual approval tracker for next swap
        resetSwap();
      }, 3000);
      return () => {
        clearTimeout(timeout);
        clearTimeout(refreshTimeout);
        clearTimeout(balanceRefresh1);
        clearTimeout(balanceRefresh2);
        clearTimeout(balanceRefresh3);
      };
    } else if (swapStatus === "error") {
      // Show error toast only once per error
      const errorKey = swapError ?? "unknown";
      if (errorToastShownRef.current !== errorKey) {
        errorToastShownRef.current = errorKey;
        toast.error("Transaction failed", swapError ?? "Unknown error");
      }
      
      // Update the most recent pending transaction to failed
      setTxHistory((prev) => {
        const pendingTx = prev.find((t) => t.status === "pending");
        if (pendingTx) {
          const updated = prev.map((t) => 
            t.id === pendingTx.id 
              ? { ...t, status: "failed" as const } 
              : t
          );
          localStorage.setItem(TX_HISTORY_KEY, JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
      
      setSwapBtnText(swapError ? `Error: ${swapError.slice(0, 20)}...` : "Swap Failed");
      setDisabled("swapBtn", false);
      // Reset after 3 seconds
      const timeout = setTimeout(() => {
        setSwapBtnText("Swap");
        errorToastShownRef.current = null; // Reset error toast tracker for next swap
        manualApprovalDoneRef.current = false; // Reset manual approval tracker for next swap
        resetSwap();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [swapStatus, swapError, resetSwap, toast, refetchAllowance, refetchBalances, txHash]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 23: DOM SYNC EFFECTS - Providers & Details Display
  // ═══════════════════════════════════════════════════════════════════════════
  // Display receipt info (whyWinner) when available
  useEffect(() => {
    if (!receipt) return;

    // Find or create receipt info row in details
    const detailsContent = document.getElementById("detailsContent");
    if (!detailsContent) return;

    // Check if receipt row already exists
    let receiptRow = detailsContent.querySelector<HTMLElement>(".detail-row.receipt-info");
    if (!receiptRow) {
      // Create receipt info row
      receiptRow = document.createElement("div");
      receiptRow.className = "detail-row receipt-info";
      receiptRow.innerHTML = `<span>Why Recommended</span><span class="receipt-reason"></span>`;
      detailsContent.appendChild(receiptRow);
    }

    // Update receipt info
    const reasonEl = receiptRow.querySelector<HTMLElement>(".receipt-reason");
    if (reasonEl && receipt.whyWinner && receipt.whyWinner.length > 0) {
      // Show first 2 reasons, formatted nicely
      const reasons = receipt.whyWinner
        .slice(0, 2)
        .map((r) => r.replace(/_/g, " ").replace(/^ranked_by_/, ""))
        .join(", ");
      reasonEl.textContent = reasons || "—";
    }
  }, [receipt]);

  // Re-render providers when showAllProviders changes
  useEffect(() => {
    if (!response?.rankedQuotes || !toTokenInfo) return;
    
    const container = document.getElementById("providersContainer");
    if (!container) return;

    renderProviders(container, response.rankedQuotes, toTokenInfo, toTokenSymbol, showAllProviders, setSelected);

    // Hook up show more button
    const showMoreBtn = document.getElementById("showMoreProvidersBtn");
    if (showMoreBtn) {
      showMoreBtn.onclick = () => setShowAllProviders(true);
    }
  }, [showAllProviders, response, toTokenInfo, toTokenSymbol]);

  // Update BEQ panel when selected quote changes
  useEffect(() => {
    if (!selected || !response?.rankedQuotes || !toTokenInfo) return;

    // BEQ Score for selected quote
    const score = selected.score?.beqScore;
    if (typeof score === "number") {
      setText("beqScore", `${Math.round(score)}/100`);
      setWidth("beqProgress", `${Math.max(0, Math.min(100, score))}%`);
    } else {
      setText("beqScore", "—");
      setWidth("beqProgress", "0%");
    }

    // Calculate max buy amount across all quotes for Price Impact comparison
    const allBuys = response.rankedQuotes
      .map((q) => toBigIntSafe(q.normalized.buyAmount ?? q.raw.buyAmount))
      .filter((x): x is bigint => x !== null);
    const maxBuy = allBuys.length > 0 ? allBuys.reduce((a, b) => (b > a ? b : a), allBuys[0]!) : null;
    const selectedBuy = toBigIntSafe(selected.normalized.buyAmount ?? selected.raw.buyAmount);

    // Price Impact: ratio of selected vs best possible
    if (selectedBuy !== null && maxBuy !== null && maxBuy > 0n) {
      const ratio = Number(selectedBuy) / Number(maxBuy);
      const pct = (1 - ratio) * 100;
      if (pct < 0.01) {
        setText("priceImpact", "0.00%");
      } else {
        setText("priceImpact", `-${formatPercent(clamp(pct, 0, 99.99), 2)}`);
      }
    } else {
      setText("priceImpact", "—");
    }

    // Gas Cost for selected quote
    const gasUsdRaw = parseFloat(selected.normalized.estimatedGasUsd ?? "");
    const formattedGas = Number.isFinite(gasUsdRaw) && gasUsdRaw >= 0 && gasUsdRaw < 1000
      ? `$${gasUsdRaw.toFixed(2)}`
      : "—";
    setText("gasCost", formattedGas);

    // MEV Risk for selected quote
    setText(
      "mevRisk",
      selected.signals?.mevExposure?.level 
        ? (selected.signals.mevExposure.level === "HIGH" ? "Exposed" : "Protected") 
        : "—",
    );

    // Net Output: delta vs worst quote
    const worstBuy = allBuys.length > 1 ? allBuys.reduce((a, b) => (b < a ? b : a), allBuys[0]!) : null;
    if (selectedBuy !== null && worstBuy !== null && selectedBuy !== worstBuy) {
      setText("netOutput", formatSignedAmount(selectedBuy - worstBuy, toTokenInfo.decimals, toTokenInfo.symbol));
    } else if (selectedBuy !== null) {
      const outFormatted = formatAmount(selectedBuy.toString(), toTokenInfo.decimals);
      setText("netOutput", `${outFormatted} ${toTokenInfo.symbol}`);
    } else {
      setText("netOutput", "—");
    }

    // Update route display for selected provider
    const routeAddrs = Array.isArray(selected.raw?.route) ? selected.raw.route : [];
    const routeSymbols = routeAddrs
      .map((addr) => resolveToken(String(addr)))
      .filter((t): t is NonNullable<ReturnType<typeof resolveToken>> => Boolean(t))
      .map((t) => t.symbol);

    const fromSym = fromTokenInfo?.symbol ?? "—";
    const toSym = toTokenInfo.symbol;
    const mid = routeSymbols.filter((s) => s !== fromSym && s !== toSym);
    const compactMid = mid.length > 0 ? "…" : null;
    const path = [fromSym, compactMid, toSym].filter((x): x is string => Boolean(x));

    const p0 = path[0] ?? "—";
    const p1 = path[1] ?? "—";
    const p2 = path[2] ?? "—";
    const routeHtml =
      `<div class="route-step"><div class="route-token"><div class="route-token-icon">${p0.slice(0, 1)}</div><span class="route-token-name">${p0}</span></div></div>` +
      `<span class="route-arrow">→</span>` +
      `<span class="route-dex">${selected.providerId ?? "—"}</span>` +
      `<span class="route-arrow">→</span>` +
      (path.length === 3
        ? `<div class="route-step"><div class="route-token"><div class="route-token-icon">${p1}</div><span class="route-token-name">${p1}</span></div></div><span class="route-arrow">→</span>` +
          `<div class="route-step"><div class="route-token"><div class="route-token-icon">${p2.slice(0, 1)}</div><span class="route-token-name">${p2}</span></div></div>`
        : `<div class="route-step"><div class="route-token"><div class="route-token-icon">${p1.slice(0, 1)}</div><span class="route-token-name">${p1}</span></div></div>`);
    setHtml("#routeContainer .route-path", routeHtml);

  }, [selected, response, toTokenInfo, fromTokenInfo, resolveToken]);

  // Update swap button state based on approval, balance, and connection
  useEffect(() => {
    if (!selected || !fromTokenInfo) return;
    
    const swapBtn = document.getElementById("swapBtn") as HTMLButtonElement | null;
    if (!swapBtn) return;

    // Check conditions in priority order
    if (!isConnected) {
      swapBtn.textContent = "Connect Wallet";
      swapBtn.disabled = true;
      return;
    }

    if (hasInsufficientBalance) {
      swapBtn.textContent = `Insufficient ${fromTokenSymbol} balance`;
      swapBtn.disabled = true;
      swapBtn.style.background = "var(--bg-card-inner)";
      return;
    }

    // Skip approval button if manual approval was done in-swap flow
    if (needsApproval && !isFromNative && !manualApprovalDoneRef.current) {
      swapBtn.textContent = isApproving ? "Approving..." : `Approve ${fromTokenSymbol}`;
      swapBtn.disabled = isApproving;
      swapBtn.style.background = "var(--accent)";
      
      // Override click handler for approval
      const handleApprove = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        approve();
      };
      swapBtn.onclick = handleApprove;
      return;
    }

    // Reset to swap state
    swapBtn.style.background = "var(--accent)";
    swapBtn.onclick = null; // Will be handled by the main useEffect
    
    if (swapStatus === "idle") {
      swapBtn.textContent = "Swap";
      swapBtn.disabled = false;
    }
  }, [selected, fromTokenInfo, isConnected, hasInsufficientBalance, needsApproval, isApproving, isFromNative, fromTokenSymbol, approve, swapStatus]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 24: DOM SYNC EFFECTS - Validation & Quick Actions
  // ═══════════════════════════════════════════════════════════════════════════
  // Add insufficient balance warning element
  useEffect(() => {
    const fromTokenBox = document.querySelector('.token-input-box:first-of-type');
    if (!fromTokenBox) return;

    // Remove existing warning if any
    const existingWarning = fromTokenBox.querySelector('.insufficient-warning');
    if (existingWarning) existingWarning.remove();

    if (hasInsufficientBalance && isConnected) {
      const warning = document.createElement("div");
      warning.className = "insufficient-warning";
      warning.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--error, #ff6b6b);
        font-size: 12px;
        margin-top: 8px;
        padding: 8px 12px;
        background: rgba(255, 107, 107, 0.1);
        border-radius: 8px;
      `;
      warning.innerHTML = `⚠️ Insufficient ${fromTokenSymbol} balance`;
      fromTokenBox.appendChild(warning);
    }
  }, [hasInsufficientBalance, isConnected, fromTokenSymbol]);

  // Add quick amount buttons (25%, 50%, 75%, MAX)
  useEffect(() => {
    const fromTokenBox = document.querySelector('.token-input-box:first-of-type');
    const balanceLabel = fromTokenBox?.querySelector('.token-input-label');
    if (!balanceLabel) return;

    // Remove existing quick buttons if any
    const existingQuickBtns = balanceLabel.querySelector('.quick-amount-btns');
    if (existingQuickBtns) existingQuickBtns.remove();

    if (isConnected && fromTokenInfo) {
      const quickBtns = document.createElement("div");
      quickBtns.className = "quick-amount-btns";
      quickBtns.style.cssText = `
        display: flex;
        gap: 4px;
        margin-left: 8px;
      `;

      const percentages = [25, 50, 75, 100];
      const labels = ["25%", "50%", "75%", "MAX"];

      percentages.forEach((pct, idx) => {
        const btn = document.createElement("button");
        btn.className = "quick-btn";
        btn.textContent = labels[idx] ?? `${pct}%`;
        btn.style.cssText = `
          padding: 2px 6px;
          background: var(--accent-dim);
          border: none;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          color: var(--accent);
          cursor: pointer;
          transition: all 0.2s;
        `;
        btn.onmouseover = () => {
          btn.style.background = "var(--accent-medium)";
        };
        btn.onmouseout = () => {
          btn.style.background = "var(--accent-dim)";
        };
        btn.onclick = () => {
          const balanceRaw = getBalance(fromTokenInfo);
          try {
            const balanceBigInt = BigInt(balanceRaw || "0");
            const pctAmount = (balanceBigInt * BigInt(pct)) / 100n;
            // Convert back to human-readable
            const humanAmount = Number(pctAmount) / 10 ** fromTokenInfo.decimals;
            const fromAmountInput = document.getElementById('fromAmount') as HTMLInputElement | null;
            if (fromAmountInput) {
              fromAmountInput.value = humanAmount.toFixed(humanAmount >= 1 ? 4 : 6);
              fromAmountInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
          } catch {
            // ignore
          }
        };
        quickBtns.appendChild(btn);
      });

      // Replace the MAX button with quick buttons
      const maxBtn = balanceLabel.querySelector('.max-btn');
      if (maxBtn) {
        maxBtn.replaceWith(quickBtns);
      } else {
        balanceLabel.appendChild(quickBtns);
      }
    }
  }, [isConnected, fromTokenInfo, getBalance]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 25: DOM SYNC EFFECTS - UI Enhancements (Presets, Tabs, StatCards)
  // ═══════════════════════════════════════════════════════════════════════════
  // Auto-refresh countdown and timer
  useEffect(() => {
    if (!response || !selected) {
      setRefreshCountdown(12);
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    // Update countdown every second
    refreshIntervalRef.current = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          // Trigger refresh by simulating input event
          const fromAmountInput = document.getElementById('fromAmount') as HTMLInputElement | null;
          if (fromAmountInput && fromAmountInput.value) {
            fromAmountInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          return 12;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [response, selected]);

  // Display refresh countdown in providers header
  useEffect(() => {
    const header = document.querySelector(".providers-header");
    if (!header) return;

    if (response?.rankedQuotes && response.rankedQuotes.length > 0) {
      const countText = showAllProviders 
        ? `${response.rankedQuotes.length} Providers` 
        : `Top 3 of ${response.rankedQuotes.length} Providers`;
      header.innerHTML = `${countText} <span style="color: var(--text-muted); font-size: 12px;">⟳ ${refreshCountdown}s</span>`;
    } else {
      header.textContent = "Available Providers";
    }
  }, [refreshCountdown, response, showAllProviders]);

  // Add execution mode presets (Safe/Balanced/Turbo)
  useEffect(() => {
    const swapHeader = document.querySelector('.swap-header');
    if (!swapHeader) return;

    // Remove existing presets if any
    const existingPresets = document.querySelector('.execution-presets');
    if (existingPresets) existingPresets.remove();

    // Create presets container
    const presetsContainer = document.createElement("div");
    presetsContainer.className = "execution-presets";
    presetsContainer.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    `;

    const modes: Array<{ key: 'SAFE' | 'NORMAL' | 'DEGEN'; label: string; icon: string; description: string }> = [
      { key: 'SAFE', label: 'Safe', icon: '🛡️', description: 'Lower risk, may have slightly less optimal rates' },
      { key: 'NORMAL', label: 'Balanced', icon: '⚖️', description: 'Balanced between safety and rate optimization' },
      { key: 'DEGEN', label: 'Turbo', icon: '⚡', description: 'Maximum rate optimization, higher risk tolerance' },
    ];

    modes.forEach((mode) => {
      const btn = document.createElement("button");
      btn.className = `preset-btn${settings.mode === mode.key ? ' active' : ''}`;
      btn.title = mode.description;
      btn.innerHTML = `${mode.icon} ${mode.label}`;
      btn.style.cssText = `
        flex: 1;
        padding: 10px 12px;
        background: ${settings.mode === mode.key ? 'var(--accent-dim)' : 'var(--bg-card-inner)'};
        border: 1px solid ${settings.mode === mode.key ? 'var(--accent)' : 'var(--border)'};
        border-radius: 10px;
        font-size: 12px;
        font-weight: 600;
        color: ${settings.mode === mode.key ? 'var(--accent)' : 'var(--text-secondary)'};
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      `;
      btn.onmouseover = () => {
        if (settings.mode !== mode.key) {
          btn.style.borderColor = "var(--border-light)";
        }
      };
      btn.onmouseout = () => {
        if (settings.mode !== mode.key) {
          btn.style.borderColor = "var(--border)";
        }
      };
      btn.onclick = () => {
        updateSettings({ mode: mode.key });
        // Trigger a re-quote if there's an amount
        const fromAmountInput = document.getElementById('fromAmount') as HTMLInputElement | null;
        if (fromAmountInput && fromAmountInput.value) {
          setTimeout(() => {
            fromAmountInput.dispatchEvent(new Event('input', { bubbles: true }));
          }, 100);
        }
      };
      presetsContainer.appendChild(btn);
    });

    // Insert after the swap header
    swapHeader.after(presetsContainer);

    return () => {
      presetsContainer.remove();
    };
  }, [settings.mode, updateSettings]);

  // Add dynamic slippage indicator with risk colors
  useEffect(() => {
    const slippageOptions = document.querySelectorAll('.slippage-option');
    
    slippageOptions.forEach((opt, idx) => {
      const el = opt as HTMLElement;
      const values = [10, 50, 100]; // 0.1%, 0.5%, 1.0%
      const bps = values[idx] ?? 50;
      const isActive = settings.slippageBps === bps;
      
      // Add risk color indicator
      let riskColor = 'var(--ok)'; // green for low slippage
      if (bps >= 100) riskColor = 'var(--warning, #f0b90b)'; // yellow for 1%+
      
      if (isActive) {
        el.style.borderColor = riskColor;
        el.style.color = riskColor;
        el.style.background = `${riskColor}15`;
      }
    });
  }, [settings.slippageBps]);

  // Add BEQ/RAW mode tabs
  useEffect(() => {
    const swapHeader = document.querySelector('.swap-header');
    if (!swapHeader) return;

    // Remove existing tabs if any
    const existingTabs = document.querySelector('.scoring-mode-tabs');
    if (existingTabs) existingTabs.remove();

    // Create tabs container - insert before the presets
    const tabsContainer = document.createElement("div");
    tabsContainer.className = "scoring-mode-tabs";
    tabsContainer.style.cssText = `
      display: flex;
      gap: 4px;
      padding: 4px;
      background: var(--bg-card-inner);
      border-radius: 12px;
      margin-bottom: 12px;
    `;

    const modes: Array<{ key: "BEQ" | "RAW"; label: string; description: string }> = [
      { key: "BEQ", label: "BEQ Mode", description: "Best Execution Quality - optimized for overall value" },
      { key: "RAW", label: "RAW Mode", description: "Raw quotes - sorted by output amount only" },
    ];

    modes.forEach((mode) => {
      const tab = document.createElement("button");
      tab.className = `mode-tab${scoringMode === mode.key ? ' active' : ''}`;
      tab.title = mode.description;
      tab.textContent = mode.label;
      tab.style.cssText = `
        flex: 1;
        padding: 10px 16px;
        background: ${scoringMode === mode.key ? 'var(--bg-card)' : 'transparent'};
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        color: ${scoringMode === mode.key ? 'var(--accent)' : 'var(--text-muted)'};
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: ${scoringMode === mode.key ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'};
      `;
      tab.onclick = () => {
        setScoringMode(mode.key);
        // Update settings mode for API
        updateSettings({ mode: mode.key === "RAW" ? "DEGEN" : "NORMAL" });
        // Trigger re-quote
        const fromAmountInput = document.getElementById('fromAmount') as HTMLInputElement | null;
        if (fromAmountInput && fromAmountInput.value) {
          setTimeout(() => {
            fromAmountInput.dispatchEvent(new Event('input', { bubbles: true }));
          }, 100);
        }
      };
      tabsContainer.appendChild(tab);
    });

    // Insert after header
    swapHeader.after(tabsContainer);

    return () => {
      tabsContainer.remove();
    };
  }, [scoringMode, updateSettings]);

  // Add StatCard grid (Network/Slippage/Platform Fee)
  useEffect(() => {
    const beqContainer = document.getElementById('beqContainer');
    if (!beqContainer) return;

    // Remove existing stat cards if any
    const existingStatCards = document.querySelector('.stat-cards-grid');
    if (existingStatCards) existingStatCards.remove();

    // Only show when we have quotes
    if (!response?.rankedQuotes?.length) return;

    const statCardsContainer = document.createElement("div");
    statCardsContainer.className = "stat-cards-grid";
    statCardsContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    `;

    const slippagePct = effectiveSlippageBps / 100;
    const slippageRisk = dynamicSlippage.riskLevel;
    const slippageColor = slippageRisk === "high" ? "var(--error, #ff6b6b)" : slippageRisk === "medium" ? "var(--warning, #f0b90b)" : "var(--ok, #00ff88)";
    const autoIndicator = dynamicSlippage.isAuto ? "⚡" : "";

    const stats = [
      { label: "Network", value: "BSC", icon: "🔗" },
      { label: "Slippage", value: `${autoIndicator}${slippagePct}%`, icon: "⚡", color: slippageColor, title: dynamicSlippage.reason },
      { label: "Platform Fee", value: feeInfo ? formatFee(feeInfo.finalFeeBps) : "0.1%", icon: "💰" },
    ];

    stats.forEach((stat) => {
      const card = document.createElement("div");
      card.style.cssText = `
        background: var(--bg-card-inner);
        border-radius: 12px;
        padding: 12px;
        text-align: center;
      `;
      card.innerHTML = `
        <div style="font-size: 16px; margin-bottom: 4px;">${stat.icon}</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 2px;">${stat.label}</div>
        <div style="font-size: 14px; font-weight: 600; color: ${stat.color || 'var(--text-primary)'};" title="${stat.title || ''}">${stat.value}</div>
      `;
      statCardsContainer.appendChild(card);
    });

    // Insert before the BEQ container content
    beqContainer.insertBefore(statCardsContainer, beqContainer.firstChild);
  }, [response, effectiveSlippageBps, dynamicSlippage, feeInfo]);

  // Add PILOT Tier Badge
  useEffect(() => {
    const swapHeader = document.querySelector('.swap-header');
    if (!swapHeader) return;

    // Remove existing badge if any
    const existingBadge = document.querySelector('.pilot-tier-badge');
    if (existingBadge) existingBadge.remove();

    if (!isConnected || !pilotTierInfo || pilotTierInfo.tier === "none") return;

    const tierDisplay = getTierDisplay(pilotTierInfo.tier);
    const badge = document.createElement("div");
    badge.className = "pilot-tier-badge";
    badge.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--bg-card-inner);
      border: 1px solid var(--border);
      border-radius: 100px;
      font-size: 12px;
      font-weight: 600;
    `;
    badge.innerHTML = `
      <span>${tierDisplay.emoji}</span>
      <span style="color: var(--text-secondary);">${tierDisplay.name}</span>
      <span style="color: var(--ok);">-${pilotTierInfo.discountPercent}%</span>
    `;
    badge.title = `PILOT Balance: ${pilotTierInfo.balanceFormatted} PILOT`;

    // Insert in the header area
    const settingsBtn = swapHeader.querySelector('.swap-settings-btn');
    if (settingsBtn) {
      swapHeader.insertBefore(badge, settingsBtn);
    }
  }, [isConnected, pilotTierInfo]);

  // Add Mobile Sticky CTA
  useEffect(() => {
    // Remove existing sticky if any
    const existingSticky = document.querySelector('.mobile-sticky-cta');
    if (existingSticky) existingSticky.remove();

    // Only show on mobile (check viewport width)
    const checkMobile = () => window.innerWidth <= 768;
    if (!checkMobile()) return;

    const stickyContainer = document.createElement("div");
    stickyContainer.className = "mobile-sticky-cta";
    stickyContainer.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 16px;
      background: linear-gradient(to top, var(--bg-primary) 80%, transparent);
      z-index: 100;
      display: none;
    `;

    const stickyBtn = document.createElement("button");
    stickyBtn.id = "mobileSwapBtn";
    stickyBtn.style.cssText = `
      width: 100%;
      padding: 18px;
      background: var(--accent);
      border: none;
      border-radius: 16px;
      font-size: 16px;
      font-weight: 700;
      color: #000;
      cursor: pointer;
      font-family: inherit;
    `;
    stickyBtn.textContent = "Swap";
    stickyBtn.onclick = () => {
      document.getElementById("swapBtn")?.click();
    };

    stickyContainer.appendChild(stickyBtn);
    document.body.appendChild(stickyContainer);

    // Show/hide based on scroll position
    const handleScroll = () => {
      const mainSwapBtn = document.getElementById("swapBtn") as HTMLButtonElement | null;
      if (!mainSwapBtn) return;
      
      const rect = mainSwapBtn.getBoundingClientRect();
      const isMainBtnVisible = rect.top < window.innerHeight && rect.bottom > 0;
      stickyContainer.style.display = isMainBtnVisible ? "none" : "block";
      
      // Sync button text
      stickyBtn.textContent = mainSwapBtn.textContent || "Swap";
      stickyBtn.disabled = mainSwapBtn.disabled;
      if (mainSwapBtn.disabled) {
        stickyBtn.style.background = "var(--bg-card-inner)";
        stickyBtn.style.color = "var(--text-muted)";
        stickyBtn.style.cursor = "not-allowed";
      } else {
        stickyBtn.style.background = "var(--accent)";
        stickyBtn.style.color = "#000";
        stickyBtn.style.cursor = "pointer";
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener("scroll", handleScroll);
      stickyContainer.remove();
    };
  }, []);

  // Add Fee Breakdown in details
  useEffect(() => {
    if (!feeInfo) return;

    const detailsContent = document.getElementById("detailsContent");
    if (!detailsContent) return;

    // Remove existing fee breakdown if any
    const existingFeeBreakdown = detailsContent.querySelector('.fee-breakdown-section');
    if (existingFeeBreakdown) existingFeeBreakdown.remove();

    // Create fee breakdown section
    const feeSection = document.createElement("div");
    feeSection.className = "fee-breakdown-section";
    feeSection.style.cssText = `
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px dashed var(--border);
    `;
    feeSection.innerHTML = `
      <div style="font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">Fee Breakdown</div>
      <div class="detail-row" style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
        <span style="color: var(--text-muted);">Base Fee</span>
        <span>${formatFee(feeInfo.baseFeesBps)}</span>
      </div>
      ${feeInfo.discountPercent > 0 ? `
      <div class="detail-row" style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
        <span style="color: var(--text-muted);">PILOT Discount</span>
        <span style="color: var(--ok);">-${feeInfo.discountPercent}%</span>
      </div>
      ` : ''}
      <div class="detail-row" style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
        <span style="color: var(--text-muted);">Final Fee</span>
        <span style="font-weight: 600; color: var(--accent);">${formatFee(feeInfo.finalFeeBps)}</span>
      </div>
      ${feeInfo.feeAmountUsd > 0 ? `
      <div class="detail-row" style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
        <span style="color: var(--text-muted);">Fee Amount</span>
        <span>~$${feeInfo.feeAmountUsd.toFixed(2)}</span>
      </div>
      ` : ''}
    `;

    detailsContent.appendChild(feeSection);
  }, [feeInfo]);

  // Add Transaction History button and drawer
  useEffect(() => {
    const swapHeader = document.querySelector('.swap-header');
    if (!swapHeader) return;

    // Remove existing history button if any
    const existingHistoryBtn = document.querySelector('.history-btn');
    if (existingHistoryBtn) existingHistoryBtn.remove();

    if (!isConnected) return;

    const historyBtn = document.createElement("button");
    historyBtn.className = "history-btn";
    historyBtn.style.cssText = `
      width: 40px;
      height: 40px;
      background: var(--bg-card-inner);
      border: 1px solid var(--border);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 18px;
      margin-right: 8px;
    `;
    historyBtn.innerHTML = "📜";
    historyBtn.title = "Transaction History";
    historyBtn.onclick = () => setHistoryOpen(true);
    historyBtn.onmouseover = () => {
      historyBtn.style.borderColor = "var(--accent)";
    };
    historyBtn.onmouseout = () => {
      historyBtn.style.borderColor = "var(--border)";
    };

    // Insert before settings button
    const settingsBtn = swapHeader.querySelector('.swap-settings-btn');
    if (settingsBtn) {
      swapHeader.insertBefore(historyBtn, settingsBtn);
    }
  }, [isConnected]);

  // Update confidence score display in renderProviders
  // (Already handled in the enhanced renderProviders function)

  // Ensure the template starts hidden like in the HTML
  useEffect(() => {
    setDisplay("beqContainer", "none");
    setDisplay("routeContainer", "none");
    setDisplay("providersContainer", "none");
    setDisplay("detailsToggle", "none");
    setDisabled("swapBtn", true);
  }, []);

  // Update token selector displays when tokens change
  useEffect(() => {
    const tokenInputBoxes = document.querySelectorAll('.token-input-box');
    
    // Helper to update token icon with logo or fallback
    const updateTokenIcon = (iconEl: Element | null, token: TokenInfo | null | undefined) => {
      if (!iconEl || !token) return;
      const logoUrl = getTokenLogoUrl(token);
      
      if (logoUrl) {
        // Use image logo
        iconEl.innerHTML = `<img src="${logoUrl}" alt="${token.symbol}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-weight:700;font-size:10px;">${token.symbol.slice(0, 2)}</span>`;
        iconEl.className = 'token-icon';
        (iconEl as HTMLElement).style.cssText = 'width:28px;height:28px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;';
      } else {
        // Fallback to initials
        iconEl.className = `token-icon ${token.symbol.toLowerCase()}`;
        iconEl.textContent = token.symbol.slice(0, 2);
        (iconEl as HTMLElement).style.cssText = '';
      }
    };
    
    // From token selector (first box)
    if (tokenInputBoxes[0]) {
      const selector = tokenInputBoxes[0].querySelector('.token-selector');
      const icon = selector?.querySelector('.token-icon');
      const name = selector?.querySelector('.token-name');
      updateTokenIcon(icon ?? null, fromTokenInfo);
      if (name) {
        name.textContent = fromTokenSymbol;
      }
    }

    // To token selector (second box)
    if (tokenInputBoxes[1]) {
      const selector = tokenInputBoxes[1].querySelector('.token-selector');
      const icon = selector?.querySelector('.token-icon');
      const name = selector?.querySelector('.token-name');
      updateTokenIcon(icon ?? null, toTokenInfo);
      if (name) {
        name.textContent = toTokenSymbol;
      }
    }
  }, [fromTokenSymbol, toTokenSymbol, fromTokenInfo, toTokenInfo]);

  // Handle token selector clicks and swap direction
  useEffect(() => {
    // Small delay to ensure DOM is ready after hydration
    const timer = setTimeout(() => {
      const tokenInputBoxes = document.querySelectorAll('.token-input-box');
      const fromSelector = tokenInputBoxes[0]?.querySelector('.token-selector') as HTMLElement | null;
      const toSelector = tokenInputBoxes[1]?.querySelector('.token-selector') as HTMLElement | null;
      const swapArrowBtn = document.querySelector('.swap-arrow-btn') as HTMLElement | null;

      const openFromPicker = (e: Event) => {
        e.stopPropagation();
        setPickerTarget("from");
        setSearchQuery("");
        setPickerOpen(true);
      };

      const openToPicker = (e: Event) => {
        e.stopPropagation();
        setPickerTarget("to");
        setSearchQuery("");
        setPickerOpen(true);
      };

      const swapTokens = () => {
        const tempFrom = fromTokenSymbol;
        setFromTokenSymbol(toTokenSymbol);
        setToTokenSymbol(tempFrom);
        
        // Clear amounts and reset UI
        const fromAmountInput = document.getElementById('fromAmount') as HTMLInputElement | null;
        const toAmountInput = document.getElementById('toAmount') as HTMLInputElement | null;
        if (fromAmountInput) fromAmountInput.value = "";
        if (toAmountInput) toAmountInput.value = "";
        setFromAmountValue(0);
        setToAmountValue(0);
        setResponse(null);
        setSelected(null);
        setDisplay("beqContainer", "none");
        setDisplay("routeContainer", "none");
        setDisplay("providersContainer", "none");
        setDisplay("detailsToggle", "none");
        setDisabled("swapBtn", true);
        setSwapBtnText("Enter an amount");
      };

      // Add cursor pointer to make selectors clearly clickable
      if (fromSelector) fromSelector.style.cursor = 'pointer';
      if (toSelector) toSelector.style.cursor = 'pointer';

      fromSelector?.addEventListener('click', openFromPicker);
      toSelector?.addEventListener('click', openToPicker);
      swapArrowBtn?.addEventListener('click', swapTokens);

      // Store cleanup refs
      (window as any).__swapPilotCleanup = () => {
        fromSelector?.removeEventListener('click', openFromPicker);
        toSelector?.removeEventListener('click', openToPicker);
        swapArrowBtn?.removeEventListener('click', swapTokens);
      };
    }, 100);

    return () => {
      clearTimeout(timer);
      (window as any).__swapPilotCleanup?.();
    };
  }, [fromTokenSymbol, toTokenSymbol]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 26: JSX RETURN (Token Picker Modal + History Drawer)
  // ═══════════════════════════════════════════════════════════════════════════
  // Always render the token picker modal (hidden when not open)
  // Detect mobile for responsive layout
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  return (
    <>
    <div 
      className="token-picker-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) setPickerOpen(false);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: pickerOpen ? 'flex' : 'none',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: isMobile ? 0 : '16px',
      }}
    >
      <div 
        className="token-picker-modal"
        style={{
          background: 'var(--bg-card, #1a1a2e)',
          borderRadius: isMobile ? '20px 20px 0 0' : '16px',
          padding: isMobile ? '20px 16px' : '24px',
          paddingBottom: isMobile ? 'max(20px, env(safe-area-inset-bottom, 20px))' : '24px',
          width: isMobile ? '100%' : '90%',
          maxWidth: isMobile ? '100%' : '420px',
          maxHeight: isMobile ? '85vh' : '70vh',
          display: 'flex',
          flexDirection: 'column',
          border: isMobile ? 'none' : '1px solid var(--border, #333)',
          borderTop: '1px solid var(--border, #333)',
        }}
      >
        {/* Drag handle for mobile */}
        {isMobile && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginBottom: '12px',
            marginTop: '-8px',
          }}>
            <div style={{
              width: '36px',
              height: '4px',
              background: 'var(--text-muted, #666)',
              borderRadius: '2px',
            }} />
          </div>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: isMobile ? '17px' : '18px', fontWeight: 600 }}>
            Select {pickerTarget === "from" ? "From" : "To"} Token
          </h3>
          <button 
            onClick={() => setPickerOpen(false)}
            style={{
              background: 'var(--bg-card-inner, #252540)',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--text-muted, #888)',
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
        
        <input
          type="text"
          placeholder="Search by name or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus={!isMobile} // Don't autofocus on mobile to prevent keyboard jump
          style={{
            width: '100%',
            padding: isMobile ? '14px 16px' : '12px 16px',
            background: 'var(--bg-card-inner, #252540)',
            border: '1px solid var(--border, #333)',
            borderRadius: '12px',
            color: 'var(--text-primary, #fff)',
            fontSize: '16px', // 16px prevents iOS zoom
            marginBottom: '16px',
            outline: 'none',
            minHeight: '48px',
          }}
        />

        <div style={{ 
          overflowY: 'auto', 
          flex: 1,
          WebkitOverflowScrolling: 'touch', // Smooth scroll on iOS
        }}>
          {filteredTokens.map((token) => {
            const logoUrl = getTokenLogoUrl(token);
            return (
            <div
              key={token.address}
              onClick={() => selectToken(token)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: isMobile ? '14px 12px' : '12px',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'background 0.2s',
                minHeight: '48px', // Touch-friendly
                background: (pickerTarget === "from" ? fromTokenSymbol : toTokenSymbol) === token.symbol 
                  ? 'var(--accent-dim, rgba(0,255,136,0.1))' 
                  : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isMobile) e.currentTarget.style.background = 'var(--bg-card-inner, #252540)';
              }}
              onMouseLeave={(e) => {
                if (!isMobile) e.currentTarget.style.background = (pickerTarget === "from" ? fromTokenSymbol : toTokenSymbol) === token.symbol 
                  ? 'var(--accent-dim, rgba(0,255,136,0.1))' 
                  : 'transparent';
              }}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- External token logos with onError fallback
                <img
                  src={logoUrl}
                  alt={token.symbol}
                  style={{
                    width: isMobile ? '40px' : '36px',
                    height: isMobile ? '40px' : '36px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    // Fallback to initials on error
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div style={{
                width: isMobile ? '40px' : '36px',
                height: isMobile ? '40px' : '36px',
                borderRadius: '50%',
                background: 'var(--accent, #00ff88)',
                display: logoUrl ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: isMobile ? '13px' : '12px',
                color: '#000',
                flexShrink: 0,
              }}>
                {token.symbol.slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: isMobile ? '16px' : '15px' }}>{token.symbol}</div>
                <div style={{ 
                  fontSize: isMobile ? '13px' : '12px', 
                  color: 'var(--text-muted, #888)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>{token.name}</div>
              </div>
            </div>
          );
          })}
          {filteredTokens.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #888)' }}>
              No tokens found
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Transaction History Drawer */}
    {historyOpen && (
      <div
        className="history-drawer-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) setHistoryOpen(false);
        }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          justifyContent: isMobile ? 'center' : 'flex-end',
          alignItems: isMobile ? 'flex-end' : 'stretch',
          zIndex: 9999,
        }}
      >
        <div
          className="history-drawer"
          style={{
            background: 'var(--bg-card, #1a1a2e)',
            width: '100%',
            maxWidth: isMobile ? '100%' : '420px',
            height: isMobile ? '85vh' : '100%',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: isMobile ? 'none' : '1px solid var(--border, #333)',
            borderRadius: isMobile ? '20px 20px 0 0' : '0',
            paddingBottom: isMobile ? 'max(16px, env(safe-area-inset-bottom, 16px))' : '0',
          }}
        >
          {/* Drag handle for mobile */}
          {isMobile && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              padding: '12px 0 8px',
            }}>
              <div style={{
                width: '36px',
                height: '4px',
                background: 'var(--text-muted, #666)',
                borderRadius: '2px',
              }} />
            </div>
          )}
          
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: isMobile ? '12px 16px 16px' : '20px 24px',
            borderBottom: '1px solid var(--border, #333)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📜</span>
              <h3 style={{ margin: 0, fontSize: isMobile ? '17px' : '18px', fontWeight: 700 }}>Transaction History</h3>
              {txHistory.length > 0 && (
                <span style={{
                  background: 'var(--bg-card-inner)',
                  padding: '2px 8px',
                  borderRadius: '100px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}>
                  {txHistory.length}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {txHistory.length > 0 && (
                <button
                  onClick={() => {
                    setTxHistory([]);
                    localStorage.removeItem(TX_HISTORY_KEY);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '12px',
                    color: 'var(--error, #ff6b6b)',
                    cursor: 'pointer',
                    padding: '8px',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setHistoryOpen(false)}
                style={{
                  background: 'var(--bg-card-inner)',
                  border: 'none',
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: isMobile ? '12px' : '16px',
            WebkitOverflowScrolling: 'touch',
          }}>
            {txHistory.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 24px',
                color: 'var(--text-muted)',
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No transactions yet</div>
                <div style={{ fontSize: '14px' }}>Your swap history will appear here</div>
              </div>
            ) : (
              txHistory.map((tx) => (
                <div
                  key={tx.id}
                  style={{
                    background: 'var(--bg-card-inner)',
                    borderRadius: '12px',
                    padding: isMobile ? '14px' : '16px',
                    marginBottom: '12px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 600 }}>{tx.fromToken} → {tx.toToken}</div>
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: tx.status === 'success' ? 'rgba(0,255,136,0.1)' : tx.status === 'failed' ? 'rgba(255,107,107,0.1)' : 'rgba(240,185,11,0.1)',
                      color: tx.status === 'success' ? 'var(--ok)' : tx.status === 'failed' ? 'var(--error)' : 'var(--warning)',
                    }}>
                      {tx.status.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    {tx.fromAmount} {tx.fromToken} → {tx.toAmount} {tx.toToken}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span>{new Date(tx.timestamp).toLocaleString()}</span>
                    <span>{tx.providerId}</span>
                  </div>
                  {tx.txHash && (
                    <a
                      href={`https://bscscan.com/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        marginTop: '8px',
                        fontSize: '12px',
                        color: 'var(--accent)',
                        textDecoration: 'none',
                      }}
                    >
                      View on BscScan →
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
