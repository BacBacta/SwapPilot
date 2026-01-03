"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { type Address } from "viem";
import { postQuotes } from "@/lib/api";
import { useSettings } from "@/components/providers/settings-provider";
import { useTokenRegistry } from "@/components/providers/token-registry-provider";
import { useTokenBalances } from "@/lib/use-token-balances";
import { useTokenPrices } from "@/lib/hooks/use-token-prices";
import { useExecuteSwap } from "@/lib/hooks/use-execute-swap";
import { useTokenApproval } from "@/lib/hooks/use-token-approval";
import { usePilotTier, useFeeCalculation, getTierDisplay, formatFee } from "@/lib/hooks/use-fees";
import { BASE_TOKENS, type TokenInfo } from "@/lib/tokens";
import type { QuoteResponse, RankedQuote, DecisionReceipt } from "@swappilot/shared";

// Universal Router address (used as spender for approvals)
const UNIVERSAL_ROUTER_ADDRESS: Address = "0x5Dc88340E1c5c6366864Ee415d6034cadd1A9897";

// Transaction history storage key
const TX_HISTORY_KEY = "swappilot_tx_history";

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
  // Clear existing and rebuild
  const header = container.querySelector(".providers-header");
  const existingItems = container.querySelectorAll(".provider-item, .show-more-btn");
  existingItems.forEach((el) => el.remove());

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
      container.querySelectorAll(".provider-item").forEach((x) => x.classList.remove("selected"));
      item.classList.add("selected");
      setSelected(q);
    };

    container.appendChild(item);
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
    container.appendChild(showMoreBtn);
  }
}

export function LandioSwapController() {
  const { settings, updateSettings } = useSettings();
  const { resolveToken, tokens: allTokens } = useTokenRegistry();
  const { address, isConnected } = useAccount();

  const lastRequestIdRef = useRef(0);
  const [response, setResponse] = useState<QuoteResponse | null>(null);
  const [selected, setSelected] = useState<RankedQuote | null>(null);
  const [receipt, setReceipt] = useState<DecisionReceipt | null>(null);

  // Execute swap hook for providers with buildTx capability
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

  // Dynamic token selection state
  const [fromTokenSymbol, setFromTokenSymbol] = useState("BNB");
  const [toTokenSymbol, setToTokenSymbol] = useState("ETH");
  
  // Token picker modal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"from" | "to">("from");
  const [searchQuery, setSearchQuery] = useState("");

  // Show all providers toggle state
  const [showAllProviders, setShowAllProviders] = useState(false);

  // Auto-refresh state
  const [refreshCountdown, setRefreshCountdown] = useState(12);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track current input amount in wei for approval check
  const [fromAmountWei, setFromAmountWei] = useState("0");

  // BEQ/RAW scoring mode state
  const [scoringMode, setScoringMode] = useState<"BEQ" | "RAW">("BEQ");

  // Transaction history drawer state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [txHistory, setTxHistory] = useState<StoredTransaction[]>([]);

  // Swap value in USD for fee calculation
  const [swapValueUsd, setSwapValueUsd] = useState(0);

  const fromTokenInfo = useMemo(() => resolveToken(fromTokenSymbol), [resolveToken, fromTokenSymbol]);
  const toTokenInfo = useMemo(() => resolveToken(toTokenSymbol), [resolveToken, toTokenSymbol]);

  // PILOT tier hook
  const { data: pilotTierInfo, isLoading: isPilotTierLoading } = usePilotTier();

  // Fee calculation hook
  const { data: feeInfo, isLoading: isFeeLoading } = useFeeCalculation(swapValueUsd);

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

  // Get wallet balances for BNB and ETH
  const balanceTokens = useMemo(() => {
    const tokens = [];
    if (fromTokenInfo) tokens.push(fromTokenInfo);
    if (toTokenInfo) tokens.push(toTokenInfo);
    return tokens.length > 0 ? tokens : BASE_TOKENS.slice(0, 2);
  }, [fromTokenInfo, toTokenInfo]);

  const { getBalanceFormatted, getBalance, isLoading: isLoadingBalances } = useTokenBalances(balanceTokens);

  // Get token prices for USD conversion
  const priceTokenAddresses = useMemo(() => {
    const addresses: string[] = [];
    if (fromTokenInfo) addresses.push(fromTokenInfo.address);
    if (toTokenInfo) addresses.push(toTokenInfo.address);
    return addresses;
  }, [fromTokenInfo, toTokenInfo]);

  const { formatUsd, getPrice } = useTokenPrices(priceTokenAddresses);

  // Token approval hook - skip for native tokens (BNB)
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
  } = useTokenApproval({
    tokenAddress: isFromNative ? undefined : (fromTokenInfo?.address as Address | undefined),
    spenderAddress: UNIVERSAL_ROUTER_ADDRESS,
    amount: approvalAmount,
  });

  // Check if balance is insufficient
  const hasInsufficientBalance = useMemo(() => {
    if (!fromTokenInfo || !isConnected) return false;
    const balanceRaw = getBalance(fromTokenInfo);
    try {
      const balanceBigInt = BigInt(balanceRaw || "0");
      const amountBigInt = BigInt(fromAmountWei || "0");
      return amountBigInt > 0n && amountBigInt > balanceBigInt;
    } catch {
      return false;
    }
  }, [fromTokenInfo, isConnected, getBalance, fromAmountWei]);

  // Track current input values for USD calculation
  const [fromAmountValue, setFromAmountValue] = useState(0);
  const [toAmountValue, setToAmountValue] = useState(0);

  // Update USD values when amounts or prices change
  useEffect(() => {
    const fromUsdEl = document.querySelector('.token-input-box:first-of-type .usd-value');
    const toUsdEl = document.querySelector('.token-input-box:nth-of-type(2) .usd-value, .token-input-box:last-of-type .usd-value');

    if (fromUsdEl && fromTokenInfo) {
      if (fromAmountValue > 0) {
        fromUsdEl.textContent = `≈ ${formatUsd(fromTokenInfo.address, fromAmountValue)}`;
      } else {
        fromUsdEl.textContent = "≈ $0.00";
      }
    }

    if (toUsdEl && toTokenInfo) {
      if (toAmountValue > 0) {
        toUsdEl.textContent = `≈ ${formatUsd(toTokenInfo.address, toAmountValue)}`;
      } else {
        toUsdEl.textContent = "≈ $0.00";
      }
    }
  }, [fromAmountValue, toAmountValue, fromTokenInfo, toTokenInfo, formatUsd]);

  // Update balance displays when wallet connects/disconnects
  useEffect(() => {
    const fromBalanceLabel = document.querySelector('.token-input-box:first-of-type .token-input-label span:last-child');
    const toBalanceLabel = document.querySelector('.token-input-box:last-of-type .token-input-label span:first-child + span, .token-input-box:nth-of-type(2) .token-input-label span:last-child');

    if (fromBalanceLabel && fromTokenInfo) {
      if (isConnected && !isLoadingBalances) {
        const balance = getBalanceFormatted(fromTokenInfo);
        fromBalanceLabel.innerHTML = `Balance: ${balance} ${fromTokenSymbol} <button class="max-btn">MAX</button>`;
      } else if (isConnected && isLoadingBalances) {
        fromBalanceLabel.innerHTML = `Balance: ... ${fromTokenSymbol} <button class="max-btn">MAX</button>`;
      } else {
        fromBalanceLabel.innerHTML = `Balance: — ${fromTokenSymbol} <button class="max-btn">MAX</button>`;
      }
    }

    // Find the "to" token balance label (second token-input-box)
    const tokenInputBoxes = document.querySelectorAll('.token-input-box');
    if (tokenInputBoxes.length >= 2 && toTokenInfo) {
      const toBox = tokenInputBoxes[1];
      const toLabel = toBox?.querySelector('.token-input-label span:last-child');
      if (toLabel) {
        if (isConnected && !isLoadingBalances) {
          const balance = getBalanceFormatted(toTokenInfo);
          toLabel.textContent = `Balance: ${balance} ${toTokenSymbol}`;
        } else if (isConnected && isLoadingBalances) {
          toLabel.textContent = `Balance: ... ${toTokenSymbol}`;
        } else {
          toLabel.textContent = `Balance: — ${toTokenSymbol}`;
        }
      }
    }

    // Hook up MAX button
    const maxBtn = document.querySelector('.max-btn');
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
  }, [isConnected, isLoadingBalances, getBalanceFormatted, fromTokenInfo, toTokenInfo, fromTokenSymbol, toTokenSymbol]);

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

    const onInput = async () => {
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

      // Show analyzing shimmer state
      const swapContainer = document.querySelector<HTMLElement>(".swap-container");
      swapContainer?.classList.add("analyzing-state");
      setSwapBtnText("Analyzing...");
      setDisabled("swapBtn", true);

      const requestId = ++lastRequestIdRef.current;

      try {
        const sellAmountWei = toWei(rawValue, fromTokenInfo.decimals);
        const res = await postQuotes({
          request: {
            chainId: 56,
            sellToken: fromTokenInfo.address,
            buyToken: toTokenInfo.address,
            sellAmount: sellAmountWei,
            slippageBps: settings.slippageBps,
            mode: settings.mode,
            scoringOptions: {
              sellabilityCheck: settings.sellabilityCheck,
              mevAwareScoring: settings.mevAwareScoring,
              canonicalPoolsOnly: settings.canonicalPoolsOnly,
            },
            sellTokenDecimals: fromTokenInfo.decimals,
            buyTokenDecimals: toTokenInfo.decimals,
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
          setText("priceImpact", `-${formatPercent(clamp(pct, 0, 99.99), 2)}`);
        } else {
          setText("priceImpact", "—");
        }

        // Gas & MEV
        setText("gasCost", best?.normalized.estimatedGasUsd ? `$${best.normalized.estimatedGasUsd}` : "$—");
        setText(
          "mevRisk",
          best?.signals?.mevExposure?.level ? (best.signals.mevExposure.level === "HIGH" ? "Exposed" : "Protected") : "—",
        );

        // Net Output: show delta vs avg of top-3 (token units)
        const top3ForNet = (res.rankedQuotes ?? []).slice(0, 3);
        const avgBuy = (() => {
          const buys = top3ForNet
            .map((q) => toBigIntSafe(q.normalized.buyAmount ?? q.raw.buyAmount))
            .filter((x): x is bigint => x !== null);
          if (!buys.length) return null;
          const sum = buys.reduce((a, b) => a + b, 0n);
          return sum / BigInt(buys.length);
        })();
        if (bestBuy !== null && avgBuy !== null) {
          setText("netOutput", formatSignedAmount(bestBuy - avgBuy, toTokenInfo.decimals, toTokenSymbol));
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
        const slippagePct = settings.slippageBps / 100;
        const outHuman = bestBuy !== null ? Number(bestBuy) / 10 ** toTokenInfo.decimals : null;
        const rate = outHuman !== null && valueNum > 0 ? outHuman / valueNum : null;
        const minReceived = outHuman !== null ? outHuman * (1 - settings.slippageBps / 10_000) : null;

        for (const row of detailsRows) {
          const cells = row.querySelectorAll("span");
          const labelEl = cells[0] as HTMLElement | undefined;
          const valueEl = cells[1] as HTMLElement | undefined;
          if (!labelEl || !valueEl) continue;
          const label = (labelEl.textContent ?? "").trim();

          if (label === "Rate") {
            valueEl.textContent = rate !== null ? `1 ${fromTokenSymbol} = ${rate.toFixed(rate >= 1 ? 4 : 6)} ${toTokenSymbol}` : "—";
          } else if (label === "Slippage Tolerance") {
            valueEl.textContent = `${slippagePct.toFixed(slippagePct % 1 === 0 ? 0 : 2)}%`;
          } else if (label === "Minimum Received") {
            valueEl.textContent = minReceived !== null ? `${minReceived.toFixed(minReceived >= 1 ? 4 : 6)} ${toTokenSymbol}` : "—";
          } else if (label === "Network Fee") {
            valueEl.textContent = best?.normalized.estimatedGasUsd ? `~$${best.normalized.estimatedGasUsd}` : "—";
          } else if (label === "Platform Fee") {
            valueEl.textContent = "—";
          } else if (label === "You Save") {
            valueEl.textContent = bestBuy !== null && avgBuy !== null ? formatSignedAmount(bestBuy - avgBuy, toTokenInfo.decimals, toTokenSymbol) : "—";
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
        setSwapBtnText("Failed to fetch quotes");
        setDisabled("swapBtn", true);
      } finally {
        const swapContainer = document.querySelector<HTMLElement>(".swap-container");
        swapContainer?.classList.remove("analyzing-state");
      }
    };

    amountInput?.addEventListener("input", onInput);

    // Swap button action - use buildTx for capable providers, fallback to deepLink
    const swapBtn = document.getElementById("swapBtn") as HTMLButtonElement | null;
    const onSwap = async () => {
      if (!selected || !fromTokenInfo || !toTokenInfo) return;

      const hasBuildTx = selected.capabilities?.buildTx === true;

      if (hasBuildTx && isConnected) {
        // Use buildTransaction + executeSwap for providers with buildTx
        setSwapBtnText("Building...");
        setDisabled("swapBtn", true);

        const amountInput = document.getElementById("fromAmount") as HTMLInputElement | null;
        const sellAmountWei = toWei(amountInput?.value ?? "0", fromTokenInfo.decimals);

        const tx = await buildTransaction({
          providerId: selected.providerId,
          sellToken: fromTokenInfo.address,
          buyToken: toTokenInfo.address,
          sellAmount: sellAmountWei,
          slippageBps: settings.slippageBps,
          quoteRaw: selected.raw,
          quoteNormalized: selected.normalized,
        });

        if (tx) {
          setSwapBtnText("Confirm in wallet...");
          executeSwap(tx);
        } else {
          setSwapBtnText("Swap");
          setDisabled("swapBtn", false);
        }
      } else if (selected.deepLink) {
        // Fallback to deepLink for providers without buildTx (binance-wallet, liquidmesh, metamask)
        window.open(selected.deepLink, "_blank", "noopener,noreferrer");
      }
    };
    swapBtn?.addEventListener("click", onSwap);

    return () => {
      amountInput?.removeEventListener("input", onInput);
      detailsToggle?.removeEventListener("click", onToggleDetails);
      swapBtn?.removeEventListener("click", onSwap);
    };
  }, [
    buildTransaction,
    executeSwap,
    fromTokenInfo,
    fromTokenSymbol,
    isConnected,
    toTokenSymbol,
    resolveToken,
    selected,
    settings.canonicalPoolsOnly,
    settings.mevAwareScoring,
    settings.mode,
    settings.sellabilityCheck,
    settings.slippageBps,
    toTokenInfo,
  ]);

  // Handle swap status changes
  useEffect(() => {
    if (swapStatus === "pending") {
      setSwapBtnText("Pending...");
      setDisabled("swapBtn", true);
    } else if (swapStatus === "success") {
      setSwapBtnText("Success!");
      setDisabled("swapBtn", true);
      
      // Save transaction to history
      if (selected && fromTokenInfo && toTokenInfo) {
        const fromAmountInput = document.getElementById("fromAmount") as HTMLInputElement | null;
        const toAmountInput = document.getElementById("toAmount") as HTMLInputElement | null;
        
        const newTx: StoredTransaction = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          timestamp: Date.now(),
          fromToken: fromTokenSymbol,
          toToken: toTokenSymbol,
          fromAmount: fromAmountInput?.value || "0",
          toAmount: toAmountInput?.value || "0",
          txHash: txHash ?? undefined,
          status: "success",
          providerId: selected.providerId,
        };
        
        setTxHistory((prev) => {
          const updated = [newTx, ...prev].slice(0, 50); // Keep last 50
          localStorage.setItem(TX_HISTORY_KEY, JSON.stringify(updated));
          return updated;
        });
      }
      
      // Reset after 3 seconds
      const timeout = setTimeout(() => {
        setSwapBtnText("Swap");
        setDisabled("swapBtn", false);
        resetSwap();
      }, 3000);
      return () => clearTimeout(timeout);
    } else if (swapStatus === "error") {
      setSwapBtnText(swapError ? `Error: ${swapError.slice(0, 20)}...` : "Swap Failed");
      setDisabled("swapBtn", false);
      // Reset after 3 seconds
      const timeout = setTimeout(() => {
        setSwapBtnText("Swap");
        resetSwap();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [swapStatus, swapError, resetSwap, selected, fromTokenInfo, toTokenInfo, fromTokenSymbol, toTokenSymbol, txHash]);

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

    if (needsApproval && !isFromNative) {
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

    const slippagePct = settings.slippageBps / 100;
    const slippageRisk = slippagePct >= 1 ? "high" : slippagePct >= 0.5 ? "medium" : "low";
    const slippageColor = slippageRisk === "high" ? "var(--error, #ff6b6b)" : slippageRisk === "medium" ? "var(--warning, #f0b90b)" : "var(--ok, #00ff88)";

    const stats = [
      { label: "Network", value: "BSC", icon: "🔗" },
      { label: "Slippage", value: `${slippagePct}%`, icon: "⚡", color: slippageColor },
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
        <div style="font-size: 14px; font-weight: 600; color: ${stat.color || 'var(--text-primary)'};">${stat.value}</div>
      `;
      statCardsContainer.appendChild(card);
    });

    // Insert before the BEQ container content
    beqContainer.insertBefore(statCardsContainer, beqContainer.firstChild);
  }, [response, settings.slippageBps, feeInfo]);

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
    
    // From token selector (first box)
    if (tokenInputBoxes[0]) {
      const selector = tokenInputBoxes[0].querySelector('.token-selector');
      const icon = selector?.querySelector('.token-icon');
      const name = selector?.querySelector('.token-name');
      if (icon) {
        icon.className = `token-icon ${fromTokenSymbol.toLowerCase()}`;
        icon.textContent = fromTokenSymbol.slice(0, 3);
      }
      if (name) {
        name.textContent = fromTokenSymbol;
      }
    }

    // To token selector (second box)
    if (tokenInputBoxes[1]) {
      const selector = tokenInputBoxes[1].querySelector('.token-selector');
      const icon = selector?.querySelector('.token-icon');
      const name = selector?.querySelector('.token-name');
      if (icon) {
        icon.className = `token-icon ${toTokenSymbol.toLowerCase()}`;
        icon.textContent = toTokenSymbol.slice(0, 3);
      }
      if (name) {
        name.textContent = toTokenSymbol;
      }
    }
  }, [fromTokenSymbol, toTokenSymbol]);

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

  // Filter tokens for picker
  const filteredTokens = useMemo(() => {
    const tokens = allTokens.length > 0 ? allTokens : BASE_TOKENS;
    if (!searchQuery.trim()) return tokens;
    const q = searchQuery.toLowerCase();
    return tokens.filter(t => 
      t.symbol.toLowerCase().includes(q) || 
      t.name.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q)
    );
  }, [allTokens, searchQuery]);

  // Always render the token picker modal (hidden when not open)
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
        background: 'rgba(0,0,0,0.7)',
        display: pickerOpen ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div 
        className="token-picker-modal"
        style={{
          background: 'var(--bg-card, #1a1a2e)',
          borderRadius: '16px',
          padding: '24px',
          width: '90%',
          maxWidth: '420px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border, #333)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
            Select {pickerTarget === "from" ? "From" : "To"} Token
          </h3>
          <button 
            onClick={() => setPickerOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-muted, #888)',
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
          autoFocus
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'var(--bg-card-inner, #252540)',
            border: '1px solid var(--border, #333)',
            borderRadius: '12px',
            color: 'var(--text-primary, #fff)',
            fontSize: '14px',
            marginBottom: '16px',
            outline: 'none',
          }}
        />

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filteredTokens.map((token) => (
            <div
              key={token.address}
              onClick={() => selectToken(token)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'background 0.2s',
                background: (pickerTarget === "from" ? fromTokenSymbol : toTokenSymbol) === token.symbol 
                  ? 'var(--accent-dim, rgba(0,255,136,0.1))' 
                  : 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-card-inner, #252540)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = (pickerTarget === "from" ? fromTokenSymbol : toTokenSymbol) === token.symbol 
                  ? 'var(--accent-dim, rgba(0,255,136,0.1))' 
                  : 'transparent';
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--accent, #00ff88)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px',
                color: '#000',
              }}>
                {token.symbol.slice(0, 3)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{token.symbol}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #888)' }}>{token.name}</div>
              </div>
            </div>
          ))}
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
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'flex-end',
          zIndex: 9999,
        }}
      >
        <div
          className="history-drawer"
          style={{
            background: 'var(--bg-card, #1a1a2e)',
            width: '100%',
            maxWidth: '420px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid var(--border, #333)',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border, #333)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📜</span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Transaction History</h3>
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
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
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
                    padding: '16px',
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
