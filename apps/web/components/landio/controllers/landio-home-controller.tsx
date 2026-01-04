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

  // Update logos with status indicators - generate from live providers
  logosEl.innerHTML = "";
  
  // Provider logo configuration with colors and SVG icons
  const providerLogos: Record<string, { name: string; color: string; icon: string }> = {
    "1inch": {
      name: "1inch",
      color: "#1B314F",
      icon: `<svg viewBox="0 0 200 200" fill="none"><path d="M100 20C55.8 20 20 55.8 20 100s35.8 80 80 80 80-35.8 80-80S144.2 20 100 20zm25.5 115.8c-1.2 1.6-3 2.5-4.9 2.5H79.4c-1.9 0-3.7-.9-4.9-2.5-1.2-1.6-1.5-3.6-.9-5.5l8.8-26.3-16.7 8.4c-2.4 1.2-5.3.6-7-1.4-1.7-2-2-4.9-.6-7.2l35-57.5c1.6-2.7 5-3.5 7.7-1.9 2.7 1.6 3.5 5 1.9 7.7L87.5 78l17.7-8.8c2.4-1.2 5.3-.6 7 1.4 1.7 2 2 4.9.6 7.2l-15.2 25h23.2c2.5 0 4.7 1.5 5.7 3.8l5 12.5c.9 2.3.4 4.9-1.3 6.7-.9 1-17.7 10-17.7 10z" fill="currentColor"/></svg>`,
    },
    "zerox": {
      name: "0x",
      color: "#000000",
      icon: `<svg viewBox="0 0 200 200" fill="none"><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="80" font-weight="bold" fill="currentColor">0x</text></svg>`,
    },
    "0x": {
      name: "0x",
      color: "#000000",
      icon: `<svg viewBox="0 0 200 200" fill="none"><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="80" font-weight="bold" fill="currentColor">0x</text></svg>`,
    },
    "pancakeswap": {
      name: "PancakeSwap",
      color: "#633001",
      icon: `<svg viewBox="0 0 200 200" fill="none"><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="60" fill="currentColor">🥞</text></svg>`,
    },
    "okx": {
      name: "OKX",
      color: "#000000",
      icon: `<svg viewBox="0 0 200 200" fill="none"><rect x="40" y="40" width="50" height="50" fill="currentColor"/><rect x="110" y="40" width="50" height="50" fill="currentColor"/><rect x="75" y="75" width="50" height="50" fill="currentColor"/><rect x="40" y="110" width="50" height="50" fill="currentColor"/><rect x="110" y="110" width="50" height="50" fill="currentColor"/></svg>`,
    },
    "kyberswap": {
      name: "KyberSwap",
      color: "#31CB9E",
      icon: `<svg viewBox="0 0 200 200" fill="none"><path d="M100 20L40 60v80l60 40 60-40V60L100 20zm0 20l40 26.7v53.3L100 146.7 60 120V66.7L100 40z" fill="currentColor"/><path d="M100 60L70 80v40l30 20 30-20V80l-30-20z" fill="currentColor"/></svg>`,
    },
    "openocean": {
      name: "OpenOcean",
      color: "#1B4DFF",
      icon: `<svg viewBox="0 0 200 200" fill="none"><circle cx="100" cy="100" r="60" stroke="currentColor" stroke-width="12" fill="none"/><circle cx="100" cy="100" r="30" fill="currentColor"/></svg>`,
    },
    "paraswap": {
      name: "ParaSwap",
      color: "#0058FF",
      icon: `<svg viewBox="0 0 200 200" fill="none"><polygon points="100,30 30,170 170,170" fill="currentColor"/></svg>`,
    },
    "dodo": {
      name: "DODO",
      color: "#FFE804",
      icon: `<svg viewBox="0 0 200 200" fill="none"><ellipse cx="100" cy="110" rx="60" ry="50" fill="currentColor"/><circle cx="70" cy="90" r="15" fill="#000"/><circle cx="130" cy="90" r="15" fill="#000"/><circle cx="70" cy="88" r="6" fill="#fff"/><circle cx="130" cy="88" r="6" fill="#fff"/><ellipse cx="100" cy="130" rx="20" ry="10" fill="#FF9500"/></svg>`,
    },
    "odos": {
      name: "Odos",
      color: "#8B5CF6",
      icon: `<svg viewBox="0 0 200 200" fill="none"><circle cx="100" cy="100" r="70" stroke="currentColor" stroke-width="15" fill="none"/><circle cx="100" cy="100" r="25" fill="currentColor"/></svg>`,
    },
    "bebop": {
      name: "Bebop",
      color: "#FF6B35",
      icon: `<svg viewBox="0 0 200 200" fill="none"><rect x="50" y="50" width="100" height="100" rx="20" fill="currentColor"/><circle cx="85" cy="100" r="15" fill="#000"/><circle cx="115" cy="100" r="15" fill="#000"/></svg>`,
    },
    "rango": {
      name: "Rango",
      color: "#00D395",
      icon: `<svg viewBox="0 0 200 200" fill="none"><path d="M100 30L40 80v40l60 50 60-50V80L100 30z" fill="currentColor"/></svg>`,
    },
    "lifi": {
      name: "LI.FI",
      color: "#EF46FF",
      icon: `<svg viewBox="0 0 200 200" fill="none"><path d="M40 100L100 40l60 60-60 60-60-60z" fill="currentColor"/></svg>`,
    },
    "magpie": {
      name: "Magpie",
      color: "#00C8FF",
      icon: `<svg viewBox="0 0 200 200" fill="none"><path d="M100 30c-38.7 0-70 31.3-70 70s31.3 70 70 70 70-31.3 70-70-31.3-70-70-70zm0 120c-27.6 0-50-22.4-50-50s22.4-50 50-50 50 22.4 50 50-22.4 50-50 50z" fill="currentColor"/><circle cx="100" cy="100" r="20" fill="currentColor"/></svg>`,
    },
    "oku": {
      name: "Oku",
      color: "#6366F1",
      icon: `<svg viewBox="0 0 200 200" fill="none"><circle cx="100" cy="100" r="60" fill="currentColor"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="50" font-weight="bold" fill="#fff">O</text></svg>`,
    },
    "firebird": {
      name: "Firebird",
      color: "#FF4500",
      icon: `<svg viewBox="0 0 200 200" fill="none"><path d="M100 20c-10 30-40 50-40 80 0 33.1 26.9 60 60 60s60-26.9 60-60c0-30-30-50-40-80-10 20-30 30-40 30s-30-10-40-30z" fill="currentColor"/></svg>`,
    },
  };

  data.providers.forEach((provider) => {
    const div = document.createElement("div");
    div.className = "integration-logo";
    
    // Add status indicator
    const statusClass = provider.status === "ok" ? "operational" : 
                       provider.status === "degraded" ? "degraded" : "down";
    div.classList.add(`status-${statusClass}`);
    
    const config = providerLogos[provider.providerId];
    
    if (config) {
      // Create logo with icon
      div.innerHTML = `
        <div class="provider-icon" style="color: ${config.color}">
          ${config.icon}
        </div>
        <span class="provider-name">${config.name}</span>
      `;
    } else {
      // Fallback to text only
      div.innerHTML = `<span class="provider-name">${provider.displayName}</span>`;
    }
    
    div.title = `${provider.displayName} - ${provider.status}`;
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
