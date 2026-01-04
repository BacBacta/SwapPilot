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
  
  // Provider emoji/name mapping for display
  const providerDisplayNames: Record<string, string> = {
    "1inch": "1inch",
    "zerox": "0x",
    "0x": "0x",
    "pancakeswap": "🥞 PCS",
    "okx": "OKX",
    "kyberswap": "Kyber",
    "openocean": "OpenOcean",
    "paraswap": "ParaSwap",
    "dodo": "DODO",
    "odos": "Odos",
    "bebop": "Bebop",
    "rango": "Rango",
    "lifi": "LI.FI",
    "magpie": "Magpie",
    "oku": "Oku",
    "firebird": "Firebird",
  };

  data.providers.forEach((provider) => {
    const div = document.createElement("div");
    div.className = "integration-logo";
    
    // Add status indicator
    const statusClass = provider.status === "ok" ? "operational" : 
                       provider.status === "degraded" ? "degraded" : "down";
    div.classList.add(`status-${statusClass}`);
    
    const displayName = providerDisplayNames[provider.providerId] || provider.displayName;
    div.textContent = displayName;
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
