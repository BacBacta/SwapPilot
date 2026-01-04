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

    const controller = new AbortController();
    abortRef.current = controller;

    loadDynamicData(controller.signal);

    return () => {
      controller.abort();
    };
  }, []);

  return null;
}

async function loadDynamicData(signal: AbortSignal): Promise<void> {
  const baseUrl = getApiBaseUrl();

  // Load all data in parallel
  const [healthResult, providersResult, quoteResult] = await Promise.allSettled([
    fetchHealth(baseUrl, signal),
    fetchProviders(baseUrl, signal),
    fetchLiveQuote(baseUrl, signal),
  ]);

  // Update provider count in hero
  if (providersResult.status === "fulfilled") {
    updateProviderCount(providersResult.value);
    updateIntegrationsSection(providersResult.value);
  }

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
  
  // Provider logo configuration with brand colors and icons
  const providerLogos: Record<string, { name: string; bg: string; fg: string; icon: string }> = {
    "1inch": {
      name: "1inch",
      bg: "#1B314F",
      fg: "#ED5843",
      icon: `<svg viewBox="0 0 40 40" fill="none"><path d="M20 5L10 12v16l10 7 10-7V12L20 5zm0 4l6 4.2v8.4L20 26l-6-4.4v-8.4L20 9z" fill="currentColor"/></svg>`,
    },
    "zerox": {
      name: "0x",
      bg: "#000000",
      fg: "#FFFFFF",
      icon: `<svg viewBox="0 0 40 40" fill="none"><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="18" font-weight="bold" fill="currentColor">0x</text></svg>`,
    },
    "0x": {
      name: "0x",
      bg: "#000000",
      fg: "#FFFFFF",
      icon: `<svg viewBox="0 0 40 40" fill="none"><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="18" font-weight="bold" fill="currentColor">0x</text></svg>`,
    },
    "pancakeswap": {
      name: "PancakeSwap",
      bg: "#633001",
      fg: "#FEDC90",
      icon: `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="14" r="6" fill="#FEDC90"/><circle cx="20" cy="26" r="8" fill="#D1884F"/><circle cx="16" cy="24" r="2" fill="#633001"/><circle cx="24" cy="24" r="2" fill="#633001"/></svg>`,
    },
    "okx": {
      name: "OKX",
      bg: "#000000",
      fg: "#FFFFFF",
      icon: `<svg viewBox="0 0 40 40" fill="none"><rect x="8" y="8" width="10" height="10" fill="currentColor"/><rect x="22" y="8" width="10" height="10" fill="currentColor"/><rect x="15" y="15" width="10" height="10" fill="currentColor"/><rect x="8" y="22" width="10" height="10" fill="currentColor"/><rect x="22" y="22" width="10" height="10" fill="currentColor"/></svg>`,
    },
    "kyberswap": {
      name: "KyberSwap",
      bg: "#31CB9E",
      fg: "#FFFFFF",
      icon: `<svg viewBox="0 0 40 40" fill="none"><path d="M20 6L8 14v12l12 8 12-8V14L20 6z" fill="currentColor" fill-opacity="0.3"/><path d="M20 12l-6 4v8l6 4 6-4v-8l-6-4z" fill="currentColor"/></svg>`,
    },
    "openocean": {
      name: "OpenOcean",
      bg: "#1B4DFF",
      fg: "#FFFFFF",
      icon: `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="12" stroke="currentColor" stroke-width="3" fill="none"/><circle cx="20" cy="20" r="5" fill="currentColor"/></svg>`,
    },
    "paraswap": {
      name: "ParaSwap",
      bg: "#0058FF",
      fg: "#FFFFFF",
      icon: `<svg viewBox="0 0 40 40" fill="none"><path d="M20 6L6 34h28L20 6z" fill="currentColor"/></svg>`,
    },
    "dodo": {
      name: "DODO",
      bg: "#FFE804",
      fg: "#000000",
      icon: `<svg viewBox="0 0 40 40" fill="none"><ellipse cx="20" cy="22" rx="12" ry="10" fill="#000"/><circle cx="14" cy="18" r="3" fill="#FFF"/><circle cx="26" cy="18" r="3" fill="#FFF"/><circle cx="14" cy="17" r="1.5" fill="#000"/><circle cx="26" cy="17" r="1.5" fill="#000"/><ellipse cx="20" cy="26" rx="4" ry="2" fill="#FF9500"/></svg>`,
    },
    "odos": {
      name: "Odos",
      bg: "#8B5CF6",
      fg: "#FFFFFF",
      icon: `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="14" stroke="currentColor" stroke-width="3" fill="none"/><circle cx="20" cy="20" r="5" fill="currentColor"/></svg>`,
    },
    "bebop": {
      name: "Bebop",
      bg: "#FF6B35",
      fg: "#FFFFFF",
      icon: `<svg viewBox="0 0 40 40" fill="none"><rect x="8" y="8" width="24" height="24" rx="6" fill="currentColor"/><circle cx="15" cy="20" r="3" fill="#000"/><circle cx="25" cy="20" r="3" fill="#000"/></svg>`,
    },
    "rango": {
      name: "Rango",
      bg: "#472B8A",
      fg: "#00D395",
      icon: `<svg viewBox="0 0 40 40" fill="none"><path d="M20 4l-14 10v12l14 10 14-10V14L20 4z" fill="currentColor"/></svg>`,
    },
    "lifi": {
      name: "LI.FI",
      bg: "#EF46FF",
      fg: "#FFFFFF",
      icon: `<svg viewBox="0 0 40 40" fill="none"><path d="M8 20l12-12 12 12-12 12-12-12z" fill="currentColor"/></svg>`,
    },
    "magpie": {
      name: "Magpie",
      bg: "#0A1628",
      fg: "#00C8FF",
      icon: `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="12" stroke="currentColor" stroke-width="3" fill="none"/><circle cx="20" cy="20" r="4" fill="currentColor"/></svg>`,
    },
    "oku": {
      name: "Oku",
      bg: "#6366F1",
      fg: "#FFFFFF",
      icon: `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="12" fill="currentColor"/><text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" font-size="14" font-weight="bold" fill="#6366F1">O</text></svg>`,
    },
    "firebird": {
      name: "Firebird",
      bg: "#FF4500",
      fg: "#FFFFFF",
      icon: `<svg viewBox="0 0 40 40" fill="none"><path d="M20 4c-2 6-8 10-8 16 0 6.6 5.4 12 12 12s12-5.4 12-12c0-6-6-10-8-16-2 4-6 6-8 6s-6-2-8-6z" fill="currentColor"/></svg>`,
    },
  };

  data.providers.forEach((provider) => {
    const div = document.createElement("div");
    div.className = "integration-logo";
    
    const config = providerLogos[provider.providerId];
    
    if (config) {
      // Apply brand colors as background
      div.style.backgroundColor = config.bg;
      div.style.color = config.fg;
      div.innerHTML = `
        <div class="provider-icon">
          ${config.icon}
        </div>
        <span class="provider-name">${config.name}</span>
      `;
    } else {
      // Fallback with gradient background
      div.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
      div.style.color = "#FFFFFF";
      div.innerHTML = `<span class="provider-name">${provider.displayName}</span>`;
    }
    
    div.title = provider.displayName;
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
