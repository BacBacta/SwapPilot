"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { postQuotes } from "@/lib/api";
import { useSettings } from "@/components/providers/settings-provider";
import { useTokenRegistry } from "@/components/providers/token-registry-provider";
import type { QuoteResponse, RankedQuote } from "@swappilot/shared";

function parseNumber(input: string): number {
  const n = parseFloat(String(input).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
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

export function LandioSwapController() {
  const { settings, updateSettings } = useSettings();
  const { resolveToken } = useTokenRegistry();

  const lastRequestIdRef = useRef(0);
  const [response, setResponse] = useState<QuoteResponse | null>(null);
  const [selected, setSelected] = useState<RankedQuote | null>(null);

  const fromToken = "BNB";
  const toToken = "ETH";

  const fromTokenInfo = useMemo(() => resolveToken(fromToken), [resolveToken, fromToken]);
  const toTokenInfo = useMemo(() => resolveToken(toToken), [resolveToken, toToken]);

  useEffect(() => {
    // Hook up settings modal buttons in the template.
    const openBtn = document.getElementById("openSlippage");
    const closeBtn = document.getElementById("closeSlippage");
    const modal = document.getElementById("slippageModal") as HTMLElement | null;

    const open = () => {
      if (modal) modal.classList.add("active");
    };

    const close = () => {
      if (modal) modal.classList.remove("active");
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

      setResponse(null);
      setSelected(null);

      if (!amountInput || !toAmountInput || valueNum <= 0) {
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
        const sellAmountRaw = rawValue.replace(/,/g, "");
        const res = await postQuotes({
          request: {
            chainId: 56,
            sellToken: fromTokenInfo.address,
            buyToken: toTokenInfo.address,
            sellAmount: sellAmountRaw,
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
          items.forEach((el, idx) => {
            const q = top3[idx];
            if (!q) return;
            const out = formatAmount(q.normalized.buyAmount ?? q.raw.buyAmount, toTokenInfo.decimals);
            const nameEl = el.querySelector<HTMLElement>(".provider-name");
            const outputEl = el.querySelector<HTMLElement>(".provider-output");
            if (nameEl) nameEl.textContent = q.providerId;
            if (outputEl) outputEl.textContent = `${out} ${toToken}`;
            el.classList.toggle("selected", idx === 0);
            el.onclick = () => {
              items.forEach((x) => x.classList.remove("selected"));
              el.classList.add("selected");
              setSelected(q);
            };
          });
        }

        // Details
        setText("gasCost", best?.normalized.estimatedGasUsd ? `$${best.normalized.estimatedGasUsd}` : "$—");
        setText("mevRisk", best?.signals?.mevExposure?.level ? (best.signals.mevExposure.level === "HIGH" ? "Exposed" : "Protected") : "—");

        setSwapBtnText("Swap");
        setDisabled("swapBtn", false);
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

    // Swap button action (phase 1: open deepLink when available)
    const swapBtn = document.getElementById("swapBtn") as HTMLButtonElement | null;
    const onSwap = () => {
      if (!selected) return;
      if (selected.deepLink) {
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
    fromTokenInfo,
    selected,
    settings.canonicalPoolsOnly,
    settings.mevAwareScoring,
    settings.mode,
    settings.sellabilityCheck,
    settings.slippageBps,
    toTokenInfo,
  ]);

  // Ensure the template starts hidden like in the HTML
  useEffect(() => {
    setDisplay("beqContainer", "none");
    setDisplay("routeContainer", "none");
    setDisplay("providersContainer", "none");
    setDisplay("detailsToggle", "none");
    setDisabled("swapBtn", true);
  }, []);

  return null;
}
