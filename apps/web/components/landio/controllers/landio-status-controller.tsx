"use client";

import { useEffect, useRef } from "react";

type ProviderStatus = {
  providerId: string;
  displayName: string;
  category: string;
  capabilities: { quote: boolean; buildTx: boolean; deepLink: boolean };
  successRate: number;
  latencyMs: number;
  observations: number;
  status: "ok" | "degraded" | "down" | "unknown";
};

type ProviderStatusResponse = {
  providers: ProviderStatus[];
  timestamp: number;
};

function getApiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    (process.env.NODE_ENV === "production" ? "https://swappilot-api.fly.dev" : "http://localhost:3001");
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function pickLatencyClass(latencyMs: number): "fast" | "medium" | "slow" {
  if (!Number.isFinite(latencyMs)) return "medium";
  if (latencyMs <= 120) return "fast";
  if (latencyMs <= 450) return "medium";
  return "slow";
}

function statusToIndicatorClass(status: ProviderStatus["status"]): "operational" | "degraded" | "down" {
  if (status === "down") return "down";
  if (status === "degraded") return "degraded";
  return "operational";
}

function statusToText(status: ProviderStatus["status"]): string {
  if (status === "down") return "Down";
  if (status === "degraded") return "Degraded";
  if (status === "unknown") return "Unknown";
  return "Online";
}

function formatLatency(latencyMs: number): string {
  if (!Number.isFinite(latencyMs)) return "—";
  return `${Math.round(latencyMs)}ms`;
}

export function LandioStatusController() {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const baseUrl = getApiBaseUrl();

    const apply = (data: ProviderStatusResponse) => {
      const lastUpdated = document.querySelector<HTMLElement>(".last-updated");
      if (lastUpdated) {
        const ts = Number.isFinite(data.timestamp) ? new Date(data.timestamp) : new Date();
        lastUpdated.textContent = `Last updated: ${ts.toLocaleTimeString()} • Auto-refreshes every 30 seconds`;
      }

      const providers = Array.isArray(data.providers) ? data.providers : [];

      // Update provider count in the Quote Engine card (2nd metric inside that card).
      const quoteEngineCard = Array.from(document.querySelectorAll<HTMLElement>(".status-card")).find((c) =>
        c.textContent?.includes("Quote Engine")
      );
      if (quoteEngineCard) {
        const metrics = quoteEngineCard.querySelectorAll<HTMLElement>(".status-metric-value");
        if (metrics[1]) metrics[1].textContent = String(providers.length);
        const avgSuccess =
          providers.length > 0
            ? providers.reduce((acc, p) => acc + (Number.isFinite(p.successRate) ? p.successRate : 0), 0) / providers.length
            : null;
        if (metrics[2] && avgSuccess !== null) metrics[2].textContent = `${Math.round(avgSuccess)}%`;
      }

      const providersSection = document.querySelector<HTMLElement>(".providers-section");
      if (!providersSection) return;

      const headerIndicator = providersSection.querySelector<HTMLElement>(".providers-header .status-indicator");
      const anyDown = providers.some((p) => p.status === "down");
      const anyDegraded = providers.some((p) => p.status === "degraded");
      if (headerIndicator) {
        headerIndicator.classList.remove("operational", "degraded", "down");
        headerIndicator.classList.add(anyDown ? "down" : anyDegraded ? "degraded" : "operational");
        const label = headerIndicator.childNodes[2] as ChildNode | undefined;
        // Keep the dot span; update trailing text by setting textContent on the indicator and re-adding dot.
        const dot = headerIndicator.querySelector<HTMLElement>(".status-dot");
        headerIndicator.textContent = anyDown
          ? "Some Providers Down"
          : anyDegraded
          ? "Some Providers Degraded"
          : "All Providers Online";
        if (dot) {
          headerIndicator.prepend(dot);
          headerIndicator.insertBefore(document.createTextNode(" "), dot.nextSibling);
        } else {
          // Recreate dot if needed
          const newDot = document.createElement("span");
          newDot.className = "status-dot";
          headerIndicator.prepend(newDot);
          headerIndicator.insertBefore(document.createTextNode(" "), newDot.nextSibling);
        }
        void label;
      }

      const allRows = Array.from(providersSection.querySelectorAll<HTMLElement>(".provider-status-row"));
      const headerRow = allRows.find((r) => r.classList.contains("header")) ?? null;
      const existing = allRows.filter((r) => !r.classList.contains("header"));
      const templateRow = existing[0] ?? null;

      // Remove all existing data rows; we will rebuild deterministically.
      for (const row of existing) row.remove();

      if (!templateRow) return;

      const frag = document.createDocumentFragment();
      for (const p of providers) {
        const row = templateRow.cloneNode(true) as HTMLElement;

        const nameEl = row.querySelector<HTMLElement>(".provider-name");
        if (nameEl) nameEl.textContent = p.displayName || p.providerId;

        const typeEl = row.querySelector<HTMLElement>(".provider-type");
        if (typeEl) typeEl.textContent = p.category;

        const logoEl = row.querySelector<HTMLElement>(".provider-logo");
        if (logoEl) {
          const initial = (p.displayName || p.providerId || "?").trim().slice(0, 2).toUpperCase();
          logoEl.textContent = initial;
          // Keep existing inline background for the first template row; don’t invent new colors.
        }

        const latencyFill = row.querySelector<HTMLElement>(".latency-fill");
        if (latencyFill) {
          latencyFill.classList.remove("fast", "medium", "slow");
          latencyFill.classList.add(pickLatencyClass(p.latencyMs));
          const pct = Math.max(5, Math.min(95, Math.round((p.latencyMs / 800) * 100)));
          latencyFill.style.width = `${pct}%`;
        }

        const latencyValue = row.querySelector<HTMLElement>(".latency-value");
        if (latencyValue) latencyValue.textContent = formatLatency(p.latencyMs);

        const statusIndicator = row.querySelector<HTMLElement>(".status-indicator");
        if (statusIndicator) {
          statusIndicator.classList.remove("operational", "degraded", "down");
          statusIndicator.classList.add(statusToIndicatorClass(p.status));

          const dot = statusIndicator.querySelector<HTMLElement>(".status-dot");
          statusIndicator.textContent = statusToText(p.status);
          if (dot) {
            statusIndicator.prepend(dot);
            statusIndicator.insertBefore(document.createTextNode(" "), dot.nextSibling);
          } else {
            const newDot = document.createElement("span");
            newDot.className = "status-dot";
            statusIndicator.prepend(newDot);
            statusIndicator.insertBefore(document.createTextNode(" "), newDot.nextSibling);
          }
        }

        frag.appendChild(row);
      }

      if (headerRow && headerRow.parentElement) {
        headerRow.parentElement.appendChild(frag);
      } else {
        providersSection.appendChild(frag);
      }
    };

    const load = async () => {
      try {
        const res = await fetch(`${baseUrl}/v1/providers/status`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as ProviderStatusResponse;
        apply(json);
      } catch {
        // ignore; keep the template placeholders
      }
    };

    void load();
    timerRef.current = window.setInterval(load, 30_000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  return null;
}
