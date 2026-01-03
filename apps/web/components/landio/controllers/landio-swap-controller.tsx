"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { postQuotes } from "@/lib/api";
import { useSettings } from "@/components/providers/settings-provider";
import { useTokenRegistry } from "@/components/providers/token-registry-provider";
import { useTokenBalances } from "@/lib/use-token-balances";
import { useTokenPrices } from "@/lib/hooks/use-token-prices";
import { useExecuteSwap } from "@/lib/hooks/use-execute-swap";
import { BASE_TOKENS, type TokenInfo } from "@/lib/tokens";
import type { QuoteResponse, RankedQuote, DecisionReceipt } from "@swappilot/shared";

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

  const fromTokenInfo = useMemo(() => resolveToken(fromTokenSymbol), [resolveToken, fromTokenSymbol]);
  const toTokenInfo = useMemo(() => resolveToken(toTokenSymbol), [resolveToken, toTokenSymbol]);

  // Get wallet balances for BNB and ETH
  const balanceTokens = useMemo(() => {
    const tokens = [];
    if (fromTokenInfo) tokens.push(fromTokenInfo);
    if (toTokenInfo) tokens.push(toTokenInfo);
    return tokens.length > 0 ? tokens : BASE_TOKENS.slice(0, 2);
  }, [fromTokenInfo, toTokenInfo]);

  const { getBalanceFormatted, isLoading: isLoadingBalances } = useTokenBalances(balanceTokens);

  // Get token prices for USD conversion
  const priceTokenAddresses = useMemo(() => {
    const addresses: string[] = [];
    if (fromTokenInfo) addresses.push(fromTokenInfo.address);
    if (toTokenInfo) addresses.push(toTokenInfo.address);
    return addresses;
  }, [fromTokenInfo, toTokenInfo]);

  const { formatUsd, getPrice } = useTokenPrices(priceTokenAddresses);

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

      setResponse(null);
      setSelected(null);

      if (!amountInput || !toAmountInput || valueNum <= 0) {
        setFromAmountValue(0);
        setToAmountValue(0);
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

        // Fill provider list (top 3)
        const container = document.getElementById("providersContainer");
        if (container) {
          const items = Array.from(container.querySelectorAll<HTMLElement>(".provider-item"));
          const top3 = (res.rankedQuotes ?? []).slice(0, 3);

          const avgBuyAmount = (() => {
            const buys = top3
              .map((q) => toBigIntSafe(q.normalized.buyAmount ?? q.raw.buyAmount))
              .filter((x): x is bigint => x !== null);
            if (!buys.length) return null;
            const sum = buys.reduce((a, b) => a + b, 0n);
            return sum / BigInt(buys.length);
          })();

          items.forEach((el, idx) => {
            const q = top3[idx];
            if (!q) return;
            const out = formatAmount(q.normalized.buyAmount ?? q.raw.buyAmount, toTokenInfo.decimals);
            const nameEl = el.querySelector<HTMLElement>(".provider-name");
            const outputEl = el.querySelector<HTMLElement>(".provider-output");
            const rateEls = el.querySelectorAll<HTMLElement>(".provider-rate");
            const leftRateEl = rateEls[0] ?? null;
            const rightSavingsEl = el.querySelector<HTMLElement>(".provider-savings") ?? rateEls[1] ?? null;

            if (nameEl) nameEl.textContent = q.providerId;
            if (outputEl) outputEl.textContent = `${out} ${toTokenSymbol}`;

            const beq = typeof q.score?.beqScore === "number" ? Math.round(q.score.beqScore) : null;
            if (leftRateEl) leftRateEl.textContent = beq !== null ? (idx === 0 ? `Best • BEQ ${beq}` : `BEQ ${beq}`) : idx === 0 ? "Best" : "";

            if (rightSavingsEl) {
              const buy = toBigIntSafe(q.normalized.buyAmount ?? q.raw.buyAmount);
              if (avgBuyAmount !== null && buy !== null) {
                const diff = buy - avgBuyAmount;
                rightSavingsEl.textContent = `${formatSignedAmount(diff, toTokenInfo.decimals, toTokenSymbol)} vs avg`;
              } else {
                rightSavingsEl.textContent = "—";
              }
            }

            el.classList.toggle("selected", idx === 0);
            el.onclick = () => {
              items.forEach((x) => x.classList.remove("selected"));
              el.classList.add("selected");
              setSelected(q);
            };
          });
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
  }, [swapStatus, swapError, resetSwap]);

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
  );
}
