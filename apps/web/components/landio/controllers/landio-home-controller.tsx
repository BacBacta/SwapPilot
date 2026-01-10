"use client";

import { useEffect, useRef } from "react";

type ProviderStatus = {
  providerId: string;
  displayName: string;
  category: string;
  status: "ok" | "degraded" | "down" | "unknown";
};

type ProviderStatusResponse = {
  providers: ProviderStatus[];
  timestamp: number;
};

type HealthResponse = {
  status: "ok" | "degraded" | "down";
  uptime?: number;
  version?: string;
};

type QuoteResult = {
  providerId: string;
  displayName: string;
  buyAmount: string;
  buyAmountUsd?: number;
  sellAmountUsd?: number;
  gasCostUsd?: number;
  netOutputUsd?: number;
  score?: number;
  slippageRisk?: string;
  mevRisk?: string;
};

type QuoteResponse = {
  results: QuoteResult[];
  bestProviderId?: string;
};

type FeeInfo = {
  feeApplies: boolean;
  baseFeesBps: number;
  discountPercent: number;
  finalFeeBps: number;
  freeThresholdUsd: number;
  distribution: {
    burnPercent: number;
    treasuryPercent: number;
    referralPercent: number;
  };
};

function getApiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    (process.env.NODE_ENV === "production" ? "https://swappilot-api.fly.dev" : "http://localhost:3001");
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

/**
 * Controller for the Landio homepage - loads dynamic data from the API
 * and updates the static HTML with live information.
 */
export function LandioHomeController() {
  const mountedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const teardownIntegrations = setupIntegrationsReveal();

    const controller = new AbortController();
    abortRef.current = controller;

    loadDynamicData(controller.signal);

    return () => {
      controller.abort();
      teardownIntegrations?.();
    };
  }, []);

  return null;
}

function setupIntegrationsReveal(): (() => void) | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  // Respect reduced-motion users (keep everything static)
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReducedMotion) return null;

  document.documentElement.classList.add("sp-motion");

  const showcase = document.querySelector<HTMLElement>("#integrations .integrations-showcase");
  if (!showcase) return null;

  // Apple-like spotlight parallax: follows pointer (desktop) and drifts slightly on scroll (mobile).
  const cleanupParallax = setupIntegrationsSpotlightParallax(showcase);

  // If IntersectionObserver isn't available, just enable the final state.
  if (typeof IntersectionObserver === "undefined") {
    showcase.classList.add("sp-inview");
    return cleanupParallax;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add("sp-inview");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.25, rootMargin: "0px 0px -10% 0px" },
  );

  observer.observe(showcase);

  return () => {
    try {
      observer.unobserve(showcase);
      observer.disconnect();
    } catch {
      // no-op
    }
    cleanupParallax();
  };
}

function setupIntegrationsSpotlightParallax(showcase: HTMLElement): () => void {
  let rafId: number | null = null;
  let pendingX: number | null = null;
  let pendingY: number | null = null;
  let lastScrollY = window.scrollY;

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const apply = () => {
    rafId = null;
    if (pendingX !== null) showcase.style.setProperty("--sp-spot-x", pendingX.toFixed(2));
    if (pendingY !== null) showcase.style.setProperty("--sp-spot-y", pendingY.toFixed(2));
  };

  const schedule = () => {
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(apply);
  };

  const onPointerMove = (ev: PointerEvent) => {
    // Only react to fine pointers (mouse/trackpad). Touch scrolling is handled separately.
    if (ev.pointerType && ev.pointerType !== "mouse" && ev.pointerType !== "pen") return;
    const rect = showcase.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 100;
    const y = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * 60; // keep spotlight mostly near top
    pendingX = clamp(x, 0, 100);
    pendingY = clamp(y, 0, 60);
    schedule();
  };

  const onPointerLeave = () => {
    pendingX = 50;
    pendingY = 0;
    schedule();
  };

  const onScroll = () => {
    const y = window.scrollY;
    const delta = y - lastScrollY;
    lastScrollY = y;

    // Gentle drift; keep within [0, 24]
    const current = Number.parseFloat(getComputedStyle(showcase).getPropertyValue("--sp-spot-y")) || 0;
    pendingY = clamp(current + delta * 0.015, 0, 24);
    schedule();
  };

  // Initialize
  showcase.style.setProperty("--sp-spot-x", "50");
  showcase.style.setProperty("--sp-spot-y", "0");

  showcase.addEventListener("pointermove", onPointerMove, { passive: true });
  showcase.addEventListener("pointerleave", onPointerLeave, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    showcase.removeEventListener("pointermove", onPointerMove);
    showcase.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("scroll", onScroll);
    if (rafId !== null) window.cancelAnimationFrame(rafId);
  };
}

async function loadDynamicData(signal: AbortSignal): Promise<void> {
  const baseUrl = getApiBaseUrl();

  // Load all data in parallel
  const [healthResult, providersResult, quoteResult, feeInfoResult] = await Promise.allSettled([
    fetchHealth(baseUrl, signal),
    fetchProviders(baseUrl, signal),
    fetchLiveQuote(baseUrl, signal),
    fetchFeeInfo(baseUrl, signal),
  ]);

  // Update provider count in hero
  if (providersResult.status === "fulfilled") {
    updateProviderCount(providersResult.value);
    updateIntegrationsSection(providersResult.value);
  }

  // Ensure the FAQ content matches the deployed app (client-side, no caching surprises)
  updateFaqSection({
    providers: providersResult.status === "fulfilled" ? providersResult.value : null,
    feeInfo: feeInfoResult.status === "fulfilled" ? feeInfoResult.value : null,
  });

  // Update status indicator if health is available
  if (healthResult.status === "fulfilled") {
    updateHealthBadge(healthResult.value);
  }

  // Update live quote and BEQ demo
  if (quoteResult.status === "fulfilled") {
    updateLiveQuote(quoteResult.value);
    updateBEQDemo(quoteResult.value);
  }
}

async function fetchFeeInfo(baseUrl: string, signal: AbortSignal): Promise<FeeInfo> {
  const res = await fetch(`${baseUrl}/v1/fees/calculate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ swapValueUsd: 100 }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`fees/calculate failed: HTTP ${res.status}`);
  }

  return (await res.json()) as FeeInfo;
}

function updateFaqSection({ providers, feeInfo }: { providers: ProviderStatusResponse | null; feeInfo: FeeInfo | null }): void {
  const faqList = document.querySelector<HTMLElement>("#faq .faq-list");
  if (!faqList) return;

  const providersCount = providers?.providers?.length;
  const feeBps = feeInfo?.baseFeesBps;
  const freeThresholdUsd = feeInfo?.freeThresholdUsd;
  const distribution = feeInfo?.distribution;

  const feePercent = typeof feeBps === "number" ? (feeBps / 100).toFixed(2) : null;
  const feeLine =
    feePercent && typeof freeThresholdUsd === "number"
      ? `SwapPilot charges <strong>${feePercent}%</strong> on swaps of <strong>$${freeThresholdUsd}</strong> or more. Swaps under $${freeThresholdUsd} are <strong>free</strong>.`
      : "SwapPilot charges a low platform fee on eligible swaps.";

  const distributionLine =
    distribution
      ? `Fee distribution: <strong>${distribution.burnPercent}%</strong> buy & burn PILOT, <strong>${distribution.treasuryPercent}%</strong> treasury, <strong>${distribution.referralPercent}%</strong> referral rewards.`
      : "";

  const providerLine = typeof providersCount === "number"
    ? `SwapPilot compares quotes from <strong>${providersCount}</strong> integrated providers to find you the best execution on BNB Chain.`
    : "SwapPilot compares quotes from multiple integrated providers to find you the best execution on BNB Chain.";

  const items = [
    {
      q: "What is SwapPilot?",
      a: `${providerLine} We rank quotes using our BEQ (Best Execution Quality) scoring.`,
    },
    {
      q: "How does BEQ scoring work?",
      a: `BEQ scores each quote on a 0–100 scale using: <strong>OutputScore × QualityMultiplier × RiskMultiplier</strong>. It prioritizes net output after gas and applies reliability and risk adjustments.`,
    },
    {
      q: "What are the fees?",
      a: `${feeLine} ${distributionLine}`.trim(),
    },
    {
      q: "Is my wallet and funds secure?",
      a: "Yes. SwapPilot is <strong>non-custodial</strong>: swaps are executed from your wallet, and you stay in control of approvals.",
    },
    {
      q: "Which wallets are supported?",
      a: "SwapPilot supports WalletConnect-compatible wallets and major wallets like MetaMask.",
    },
    {
      q: "Which blockchain does SwapPilot support?",
      a: "SwapPilot currently focuses on <strong>BNB Chain</strong> for best reliability and execution quality.",
    },
  ] as const;

  faqList.innerHTML = items
    .map(
      (it) => `
        <div class="faq-item">
          <button class="faq-question" type="button">
            ${it.q}
            <span class="faq-icon">+</span>
          </button>
          <div class="faq-answer">
            <p>${it.a}</p>
          </div>
        </div>
      `.trim(),
    )
    .join("\n");

  // Bind accordion behavior once via event delegation (scripts are stripped from templates).
  if (!faqList.dataset.faqBound) {
    faqList.dataset.faqBound = "1";
    faqList.addEventListener("click", (ev) => {
      const target = ev.target as HTMLElement | null;
      const button = target?.closest?.(".faq-question") as HTMLButtonElement | null;
      if (!button) return;

      const item = button.closest(".faq-item") as HTMLElement | null;
      if (!item) return;

      // close others
      faqList.querySelectorAll<HTMLElement>(".faq-item.open").forEach((el) => {
        if (el !== item) el.classList.remove("open");
      });
      item.classList.toggle("open");
    });
  }
}

async function fetchHealth(baseUrl: string, signal: AbortSignal): Promise<HealthResponse> {
  const res = await fetch(`${baseUrl}/health`, { signal });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

async function fetchProviders(baseUrl: string, signal: AbortSignal): Promise<ProviderStatusResponse> {
  const res = await fetch(`${baseUrl}/v1/providers/status`, { signal });
  if (!res.ok) throw new Error(`Providers status failed: ${res.status}`);
  return res.json();
}

async function fetchLiveQuote(baseUrl: string, signal: AbortSignal): Promise<QuoteResponse> {
  // Fetch a real quote: 1 BNB -> USDT on BSC
  const params = new URLSearchParams({
    chainId: "56",
    sellToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Native BNB
    buyToken: "0x55d398326f99059fF775485246999027B3197955", // USDT on BSC
    sellAmount: "1000000000000000000", // 1 BNB in wei
    slippageBps: "100",
  });
  
  const res = await fetch(`${baseUrl}/v1/quotes?${params}`, { signal });
  if (!res.ok) throw new Error(`Quote fetch failed: ${res.status}`);
  return res.json();
}

function updateProviderCount(data: ProviderStatusResponse): void {
  const countEl = document.getElementById("provider-count");
  if (countEl) {
    countEl.textContent = `${data.providers.length}`;
  }

  // Update hero badge text
  const badgeText = document.getElementById("hero-badge-text");
  if (badgeText) {
    const operational = data.providers.filter((p) => p.status === "ok").length;
    badgeText.textContent = `${operational}/${data.providers.length} PROVIDERS ONLINE`;
  }
}

function updateLiveQuote(data: QuoteResponse): void {
  if (!data.results || data.results.length === 0) return;

  // Find best quote
  const bestQuote = data.results.find((r) => r.providerId === data.bestProviderId) ?? data.results[0];
  if (!bestQuote) return;

  // Update quote display
  const fromUsdEl = document.getElementById("quote-from-usd");
  const toAmountEl = document.getElementById("quote-to-amount");
  const providerEl = document.getElementById("quote-provider");
  const metaEl = document.getElementById("quote-meta");

  if (fromUsdEl && typeof bestQuote.sellAmountUsd === "number") {
    fromUsdEl.textContent = `≈ $${bestQuote.sellAmountUsd.toFixed(2)}`;
  }

  if (toAmountEl) {
    // Convert from wei to readable amount (USDT has 18 decimals on BSC)
    const amount = parseFloat(bestQuote.buyAmount) / 1e18;
    toAmountEl.textContent = amount.toFixed(2);
  }

  if (providerEl) {
    providerEl.textContent = `via ${bestQuote.displayName}`;
  }

  if (metaEl) {
    const gasText = typeof bestQuote.gasCostUsd === "number" ? `Gas: $${bestQuote.gasCostUsd.toFixed(2)}` : "";
    const scoreText = typeof bestQuote.score === "number" ? `BEQ: ${bestQuote.score}` : "";
    metaEl.textContent = [gasText, scoreText].filter(Boolean).join(" • ");
  }
}

function updateBEQDemo(data: QuoteResponse): void {
  if (!data.results || data.results.length === 0) return;

  const bestQuote = data.results.find((r) => r.providerId === data.bestProviderId) ?? data.results[0];
  if (!bestQuote) return;

  // Update BEQ score
  const scoreEl = document.getElementById("beq-score");
  if (scoreEl && typeof bestQuote.score === "number") {
    scoreEl.textContent = bestQuote.score.toString();
  }

  // Update BEQ factors
  const outputEl = document.getElementById("beq-output");
  const gasEl = document.getElementById("beq-gas");
  const slippageEl = document.getElementById("beq-slippage");
  const mevEl = document.getElementById("beq-mev");

  if (outputEl && typeof bestQuote.netOutputUsd === "number") {
    outputEl.textContent = `$${bestQuote.netOutputUsd.toFixed(2)}`;
  }

  if (gasEl && typeof bestQuote.gasCostUsd === "number") {
    gasEl.textContent = `$${bestQuote.gasCostUsd.toFixed(2)}`;
  }

  if (slippageEl) {
    slippageEl.textContent = bestQuote.slippageRisk || "Low";
  }

  if (mevEl) {
    mevEl.textContent = bestQuote.mevRisk || "Protected";
  }
}

function updateIntegrationsSection(data: ProviderStatusResponse): void {
  const statusEl = document.getElementById("integration-status");
  const logosEl = document.getElementById("integration-logos");

  if (!statusEl || !logosEl) return;

  const aggregators = data.providers.filter((p) => p.category === "aggregator");
  const dexes = data.providers.filter((p) => p.category === "dex");
  const operational = data.providers.filter((p) => p.status === "ok").length;

  // Update the status message
  statusEl.textContent = `${aggregators.length} aggregators + ${dexes.length} DEXes connected • ${operational}/${data.providers.length} operational`;

  // Update logos - generate from live providers
  logosEl.innerHTML = "";
  
  // Provider logo URLs (reliable CDN sources and official logos)
  const providerLogos: Record<string, { name: string; logo: string }> = {
    "1inch": {
      name: "1inch",
      logo: "https://cdn.1inch.io/logo.png",
    },
    "zerox": {
      name: "0x",
      logo: "/images/providers/Ox.jpg",
    },
    "0x": {
      name: "0x",
      logo: "/images/providers/Ox.jpg",
    },
    "pancakeswap": {
      name: "PancakeSwap",
      logo: "https://tokens.pancakeswap.finance/images/0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82.png",
    },
    "okx-dex": {
      name: "OKX DEX",
      logo: "/images/providers/OKX.png",
    },
    "okx": {
      name: "OKX DEX",
      logo: "/images/providers/OKX.png",
    },
    "kyberswap": {
      name: "KyberSwap",
      logo: "https://kyberswap.com/favicon.ico",
    },
    "openocean": {
      name: "OpenOcean",
      logo: "/images/providers/openocean.png",
    },
    "paraswap": {
      name: "ParaSwap",
      logo: "/images/providers/Paraswap.png",
    },
    "dodo": {
      name: "DODO",
      logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x43Dfc4159D86F3A37A5A4B3D4580b888ad7d4DDd/logo.png",
    },
    "odos": {
      name: "Odos",
      logo: "/images/providers/Odos.jpg",
    },
    "bebop": {
      name: "Bebop",
      logo: "https://app.bebop.xyz/bebop-logo.svg",
    },
    "rango": {
      name: "Rango",
      logo: "https://raw.githubusercontent.com/rango-exchange/rango-types/main/src/logo.svg",
    },
    "lifi": {
      name: "LI.FI",
      logo: "https://raw.githubusercontent.com/lifinance/types/main/src/assets/lifi.svg",
    },
    "magpie": {
      name: "Magpie",
      logo: "https://www.magpiefi.xyz/logo.svg",
    },
    "binance-wallet": {
      name: "Binance Wallet",
      logo: "https://public.bnbstatic.com/static/images/common/favicon.ico",
    },
    "metamask": {
      name: "MetaMask",
      logo: "https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/SVG_MetaMask_Icon_Color.svg",
    },
    "uniswap": {
      name: "Uniswap",
      logo: "https://raw.githubusercontent.com/Uniswap/brand-assets/main/Uniswap%20Brand%20Assets/Uniswap_icon_pink.svg",
    },
    "uniswap-v2": {
      name: "Uniswap",
      logo: "https://raw.githubusercontent.com/Uniswap/brand-assets/main/Uniswap%20Brand%20Assets/Uniswap_icon_pink.svg",
    },
    "uniswap-v3": {
      name: "Uniswap",
      logo: "https://raw.githubusercontent.com/Uniswap/brand-assets/main/Uniswap%20Brand%20Assets/Uniswap_icon_pink.svg",
    },
    "liquidmesh": {
      name: "LiquidMesh",
      logo: "",
    },
  };

  // Fallback initials for when images fail to load
  const getInitials = (name: string): string => {
    return name.split(/[\s.-]+/).map(word => word[0]?.toUpperCase() || "").join("").slice(0, 2);
  };

  // Track displayed providers to avoid duplicates (e.g., Uniswap V2/V3)
  const displayedNames = new Set<string>();

  data.providers.forEach((provider) => {
    const config = providerLogos[provider.providerId];
    const displayName = config?.name || provider.displayName;
    
    // Skip if we've already displayed this provider (handles Uniswap V2/V3 deduplication)
    if (displayedNames.has(displayName)) {
      return;
    }
    displayedNames.add(displayName);

    const div = document.createElement("div");
    div.className = "integration-logo";
    
    const initials = getInitials(displayName);
    
    // Create image with fallback to initials
    div.innerHTML = `
      <div class="provider-img-wrapper">
        <img 
          src="${config?.logo || ""}" 
          alt="${displayName}" 
          class="provider-img"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div class="provider-initials" style="display: ${config?.logo ? 'none' : 'flex'};">${initials}</div>
      </div>
      <span class="provider-name">${displayName}</span>
    `;
    
    div.title = displayName;
    logosEl.appendChild(div);
  });
}

function updateHealthBadge(health: HealthResponse): void {
  const dot = document.getElementById("hero-status-dot") as HTMLElement;
  if (dot) {
    if (health.status === "ok") {
      dot.style.backgroundColor = "#10b981";
      dot.style.boxShadow = "0 0 10px #10b981";
    } else if (health.status === "degraded") {
      dot.style.backgroundColor = "#f59e0b";
      dot.style.boxShadow = "0 0 10px #f59e0b";
    } else {
      dot.style.backgroundColor = "#ef4444";
      dot.style.boxShadow = "0 0 10px #ef4444";
    }
  }
}

export default LandioHomeController;
