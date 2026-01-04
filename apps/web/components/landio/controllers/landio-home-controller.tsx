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

  // Load health status and provider status in parallel
  const [healthResult, providersResult] = await Promise.allSettled([
    fetchHealth(baseUrl, signal),
    fetchProviders(baseUrl, signal),
  ]);

  // Update integrations section with live data
  if (providersResult.status === "fulfilled") {
    updateIntegrationsSection(providersResult.value);
  }

  // Update status indicator if health is available
  if (healthResult.status === "fulfilled") {
    updateHealthBadge(healthResult.value);
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

function updateIntegrationsSection(data: ProviderStatusResponse): void {
  const statusEl = document.getElementById("integration-status");
  const logosEl = document.getElementById("integration-logos");

  if (!statusEl || !logosEl) return;

  const aggregators = data.providers.filter((p) => p.category === "aggregator");
  const dexes = data.providers.filter((p) => p.category === "dex");
  const operational = data.providers.filter((p) => p.status === "ok").length;

  // Update the status message
  statusEl.textContent = `${aggregators.length} aggregators + ${dexes.length} DEXes connected • ${operational}/${data.providers.length} operational`;

  // Update logos with status indicators
  logosEl.innerHTML = "";
  
  // Provider name mapping for display
  const providerDisplayNames: Record<string, string> = {
    "1inch": "1inch",
    "0x": "0x",
    "pancakeswap": "🥞",
    "okx": "OKX",
    "kyberswap": "KyberSwap",
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
  // Find hero badge and update with live status
  const heroBadge = document.querySelector(".hero-badge");
  if (!heroBadge) return;

  const dot = heroBadge.querySelector(".hero-badge-dot") as HTMLElement;
  if (dot) {
    // Update the dot color based on health status
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
