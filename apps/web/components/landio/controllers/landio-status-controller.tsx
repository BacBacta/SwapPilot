"use client";

import { useEffect, useRef } from "react";
import { escapeHtml, setSanitizedHtml } from "@/lib/sanitize";

type ProviderStatus = {
  providerId: string;
  displayName: string;
  category: string;
  capabilities: { quote: boolean; buildTx: boolean; deepLink: boolean };
  successRate: number;
  latencyMs: number;
  observations: number;
  status: "ok" | "degraded" | "down" | "unknown";
  liveCheck?: boolean;
};

type ProviderStatusResponse = {
  providers: ProviderStatus[];
  timestamp: number;
  cached?: boolean;
};

type HealthResponse = {
  status: "ok" | "degraded" | "down";
  uptime?: string;
  uptimeMs?: number;
  version?: string;
  timestamp?: number;
};

type UptimeDay = {
  date: string;
  checksTotal: number;
  checksOk: number;
  checksDegraded: number;
  checksDown: number;
  avgLatencyMs: number;
  status: "ok" | "partial" | "down";
};

type UptimeResponse = {
  uptimePercent: number;
  totalChecks: number;
  successfulChecks: number;
  avgLatencyMs: number;
  currentStatus: "operational" | "degraded" | "down";
  days: UptimeDay[];
  timestamp: number;
};

type IncidentUpdate = {
  timestamp: number;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  message: string;
};

type Incident = {
  id: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  severity: "minor" | "major" | "critical";
  startedAt: number;
  resolvedAt?: number;
  updates: IncidentUpdate[];
};

type IncidentsResponse = {
  incidents: Incident[];
  hasActiveIncidents: boolean;
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

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit | undefined, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...(init ?? {}), signal: controller.signal });
  } finally {
    window.clearTimeout(t);
  }
}

export function LandioStatusController() {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const baseUrl = getApiBaseUrl();
    let lastHealthStatus: HealthResponse["status"] | null = null;

    const updateApiCard = (health: HealthResponse, latency: number) => {
      lastHealthStatus = health.status;
      const apiCard = Array.from(document.querySelectorAll<HTMLElement>(".status-card")).find((c) =>
        c.textContent?.includes("API Services")
      );
      if (!apiCard) return;

      const indicator = apiCard.querySelector<HTMLElement>(".status-indicator");
      if (indicator) {
        indicator.classList.remove("operational", "degraded", "down");
        indicator.classList.add(health.status === "ok" ? "operational" : health.status === "degraded" ? "degraded" : "down");
        const dot = indicator.querySelector<HTMLElement>(".status-dot");
        indicator.textContent = health.status === "ok" ? "Operational" : health.status === "degraded" ? "Degraded" : "Down";
        if (dot) {
          indicator.prepend(dot);
          indicator.insertBefore(document.createTextNode(" "), dot.nextSibling);
        }
      }

      const metrics = apiCard.querySelectorAll<HTMLElement>(".status-metric-value");
      if (metrics[0]) {
        metrics[0].textContent = `${Math.round(latency)}ms`;
        metrics[0].classList.remove("ok", "bad");
        metrics[0].classList.add(latency < 200 ? "ok" : "");
      }

      // Uptime from health endpoint
      if (metrics[1]) {
        metrics[1].textContent = health.uptime ?? "—";
      }

      // Version from health endpoint
      if (metrics[2]) {
        metrics[2].textContent = health.version ? `v${health.version}` : "—";
      }
    };

    const apply = (data: ProviderStatusResponse) => {
      const lastUpdated = document.querySelector<HTMLElement>(".last-updated");
      if (lastUpdated) {
        const ts = Number.isFinite(data.timestamp) ? new Date(data.timestamp) : new Date();
        lastUpdated.textContent = `Last updated: ${ts.toLocaleTimeString()} • Auto-refreshes every 30 seconds`;
      }

      const providers = Array.isArray(data.providers) ? data.providers : [];

      // Overall banner: derive from health + providers
      const overall = document.querySelector<HTMLElement>(".overall-status");
      if (overall) {
        const iconEl = overall.querySelector<HTMLElement>(".overall-status-icon");
        const titleEl = overall.querySelector<HTMLElement>("h2");
        const anyDown = providers.some((p) => p.status === "down") || lastHealthStatus === "down";
        const anyDegraded = providers.some((p) => p.status === "degraded") || lastHealthStatus === "degraded";

        if (iconEl) iconEl.textContent = anyDown ? "!" : anyDegraded ? "~" : "✓";
        if (titleEl) titleEl.textContent = anyDown ? "Some Systems Down" : anyDegraded ? "Degraded Performance" : "All Systems Operational";
      }

      // Update provider count in the Quote Engine card (2nd metric inside that card).
      const quoteEngineCard = Array.from(document.querySelectorAll<HTMLElement>(".status-card")).find((c) =>
        c.textContent?.includes("Quote Engine")
      );
      if (quoteEngineCard) {
        const quoteIndicator = quoteEngineCard.querySelector<HTMLElement>(".status-indicator");
        if (quoteIndicator) {
          const quoteProvidersOk = providers.filter((p) => p.capabilities.quote && p.status === "ok").length;
          const quoteProvidersDegraded = providers.filter((p) => p.capabilities.quote && p.status === "degraded").length;
          const quoteProvidersDown = providers.filter((p) => p.capabilities.quote && p.status === "down").length;
          const quoteStatus = quoteProvidersDown > 2 ? "down" : quoteProvidersDegraded > 2 || quoteProvidersDown > 0 ? "degraded" : "operational";
          
          quoteIndicator.classList.remove("operational", "degraded", "down");
          quoteIndicator.classList.add(quoteStatus);
          const quoteDot = quoteIndicator.querySelector<HTMLElement>(".status-dot");
          quoteIndicator.textContent = quoteStatus === "operational" ? "Operational" : quoteStatus === "degraded" ? "Degraded" : "Down";
          if (quoteDot) {
            quoteIndicator.prepend(quoteDot);
            quoteIndicator.insertBefore(document.createTextNode(" "), quoteDot.nextSibling);
          }
        }

        const metrics = quoteEngineCard.querySelectorAll<HTMLElement>(".status-metric-value");
        // Metric 0: avg quote time -> approximate using avg provider latency (only for quote-capable)
        const quoteProviders = providers.filter((p) => p.capabilities.quote && p.latencyMs > 0);
        const avgLatency =
          quoteProviders.length > 0
            ? quoteProviders.reduce((acc, p) => acc + (Number.isFinite(p.latencyMs) ? p.latencyMs : 0), 0) / quoteProviders.length
            : null;
        if (metrics[0]) metrics[0].textContent = avgLatency !== null ? `${Math.round(avgLatency)}ms` : "—";
        if (metrics[1]) metrics[1].textContent = String(providers.filter((p) => p.capabilities.quote).length);
        const avgSuccess =
          quoteProviders.length > 0
            ? quoteProviders.reduce((acc, p) => acc + (Number.isFinite(p.successRate) ? p.successRate : 0), 0) / quoteProviders.length
            : null;
        if (metrics[2]) metrics[2].textContent = avgSuccess !== null ? `${Math.round(avgSuccess)}%` : "—";
      }

      // Update BNB Chain RPC card based on providers that use on-chain quotes
      const updateCardStatus = (title: string, statusValue: "operational" | "degraded" | "down", metricsValues: string[]) => {
        const card = Array.from(document.querySelectorAll<HTMLElement>(".status-card")).find((c) => c.textContent?.includes(title));
        if (!card) return;
        
        const indicator = card.querySelector<HTMLElement>(".status-indicator");
        if (indicator) {
          indicator.classList.remove("operational", "degraded", "down");
          indicator.classList.add(statusValue);
          const dot = indicator.querySelector<HTMLElement>(".status-dot");
          indicator.textContent = statusValue === "operational" ? "Operational" : statusValue === "degraded" ? "Degraded" : "Down";
          if (dot) {
            indicator.prepend(dot);
            indicator.insertBefore(document.createTextNode(" "), dot.nextSibling);
          }
        }
        
        const metrics = card.querySelectorAll<HTMLElement>(".status-metric-value");
        metricsValues.forEach((val, idx) => {
          if (metrics[idx]) metrics[idx].textContent = val;
        });
      };

      // BNB Chain RPC status - based on pancakeswap and uniswap adapters (on-chain)
      const onChainProviders = providers.filter((p) => p.category === "dex" && p.capabilities.quote);
      const rpcOk = onChainProviders.filter((p) => p.status === "ok").length;
      const rpcStatus = rpcOk >= 1 ? "operational" : onChainProviders.some((p) => p.status === "degraded") ? "degraded" : "down";
      const rpcLatency = onChainProviders.length > 0 
        ? Math.round(onChainProviders.reduce((acc, p) => acc + p.latencyMs, 0) / onChainProviders.length)
        : 0;
      updateCardStatus("BNB Chain RPC", rpcStatus, [`${rpcLatency}ms`, "BSC", "Healthy"]);

      // MEV Protection - mark as operational if main aggregators are working
      const mevProviders = providers.filter((p) => p.category === "aggregator" && p.status === "ok");
      const mevStatus = mevProviders.length >= 3 ? "operational" : mevProviders.length >= 1 ? "degraded" : "down";
      updateCardStatus("MEV Protection", mevStatus, ["Flashbots", `${mevProviders.length} routes`, "Active"]);

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
          // Keep template styling (no new colors introduced)
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

    const applyUptime = (data: UptimeResponse) => {
      const uptime = document.querySelector<HTMLElement>(".uptime-section");
      if (!uptime) return;

      const valueEl = uptime.querySelector<HTMLElement>(".uptime-value");
      if (valueEl) {
        valueEl.textContent = data.totalChecks > 0 ? `${data.uptimePercent}%` : "—";
      }

      const chart = uptime.querySelector<HTMLElement>(".uptime-chart");
      if (chart) {
        if (data.days.length === 0 || data.totalChecks === 0) {
          setSanitizedHtml(
            chart,
            `
              <div class="uptime-placeholder">
                <div class="uptime-placeholder-icon">📊</div>
                <div class="uptime-placeholder-text">Building uptime history...</div>
                <div class="uptime-placeholder-subtext">Data will appear as the system is monitored</div>
              </div>
            `,
          );
        } else {
          // Render uptime bars
          const bars = data.days.map((day) => {
            const statusClass = day.status === "ok" ? "ok" : day.status === "partial" ? "partial" : "down";
            const tooltipRaw = `${day.date}: ${day.checksOk}/${day.checksTotal} checks OK`;
            const tooltip = escapeHtml(tooltipRaw);
            return `<div class="uptime-bar ${statusClass}" title="${tooltip}"></div>`;
          }).join("");

          setSanitizedHtml(chart, bars);
        }
      }

      // Update labels
      const labels = uptime.querySelector<HTMLElement>(".uptime-labels");
      if (labels && data.days.length > 0) {
        const left = document.createElement("span");
        left.textContent = `${data.days.length} days ago`;
        const right = document.createElement("span");
        right.textContent = "Today";
        labels.replaceChildren(left, right);
      }
    };

    const applyIncidents = (data: IncidentsResponse) => {
      const incidents = document.querySelector<HTMLElement>(".incidents-section");
      if (!incidents) return;

      const header = incidents.querySelector<HTMLElement>(".incidents-header");
      incidents.replaceChildren();
      if (header) incidents.appendChild(header);

      if (data.incidents.length === 0) {
        const empty = document.createElement("div");
        empty.className = "no-incidents";
        const icon = document.createElement("div");
        icon.className = "no-incidents-icon";
        icon.textContent = "✅";
        const title = document.createElement("h4");
        title.textContent = "No recent incidents";
        const body = document.createElement("p");
        body.textContent = "All systems have been operating normally.";
        empty.append(icon, title, body);
        incidents.appendChild(empty);
        return;
      }

      // Render incidents
      for (const incident of data.incidents.slice(0, 5)) {
        const item = document.createElement("div");
        item.className = "incident-item";
        
        const startDate = new Date(incident.startedAt);
        const startDateText = escapeHtml(
          startDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
        );
        const statusClass = incident.status === "resolved" ? "resolved" : "active";
        const statusText = incident.status.charAt(0).toUpperCase() + incident.status.slice(1);
        const severityIcon = incident.severity === "critical" ? "🔴" : incident.severity === "major" ? "🟠" : "🟡";

        let updatesHtml = "";
        for (const update of incident.updates.slice(0, 3)) {
          const updateTime = new Date(update.timestamp).toLocaleTimeString("en-US", { 
            hour: "2-digit", 
            minute: "2-digit",
            timeZoneName: "short"
          });
          const updateClass = update.status === "resolved" ? "resolved" : "";
          updatesHtml += `
            <div class="incident-update ${updateClass}">
              <div class="incident-update-time">${escapeHtml(updateTime)}</div>
              <div class="incident-update-text">${escapeHtml(update.message)}</div>
            </div>
          `;
        }

        setSanitizedHtml(
          item,
          `
            <div class="incident-header">
              <div>
                <div class="incident-title">${severityIcon} ${escapeHtml(incident.title)}</div>
                <div class="incident-date">${startDateText}</div>
              </div>
              <span class="incident-status ${statusClass}">${escapeHtml(statusText)}</span>
            </div>
            <div class="incident-timeline">
              ${updatesHtml}
            </div>
          `,
        );
        
        incidents.appendChild(item);
      }
    };

    const load = async () => {
      try {
        // Run all requests in parallel so the page fills fast.
        const timeoutMs = 3_000;

        const healthStart = performance.now();
        const healthP = fetchWithTimeout(`${baseUrl}/health`, { cache: "no-store" }, timeoutMs);
        const providersP = fetchWithTimeout(`${baseUrl}/v1/providers/status`, { cache: "no-store" }, timeoutMs);
        const uptimeP = fetchWithTimeout(`${baseUrl}/v1/status/uptime?days=90`, { cache: "no-store" }, timeoutMs);
        const incidentsP = fetchWithTimeout(`${baseUrl}/v1/status/incidents?limit=10`, { cache: "no-store" }, timeoutMs);

        const [healthR, providersR, uptimeR, incidentsR] = await Promise.allSettled([
          healthP,
          providersP,
          uptimeP,
          incidentsP,
        ]);

        if (healthR.status === "fulfilled") {
          const healthLatency = performance.now() - healthStart;
          if (healthR.value.ok) {
            const healthJson = (await healthR.value.json()) as HealthResponse;
            updateApiCard(healthJson, healthLatency);
          } else {
            updateApiCard({ status: "down" }, healthLatency);
          }
        } else {
          updateApiCard({ status: "down" }, 0);
        }

        if (providersR.status === "fulfilled" && providersR.value.ok) {
          const json = (await providersR.value.json()) as ProviderStatusResponse;
          apply(json);
        }

        if (uptimeR.status === "fulfilled" && uptimeR.value.ok) {
          const uptimeJson = (await uptimeR.value.json()) as UptimeResponse;
          applyUptime(uptimeJson);
        }

        if (incidentsR.status === "fulfilled" && incidentsR.value.ok) {
          const incidentsJson = (await incidentsR.value.json()) as IncidentsResponse;
          applyIncidents(incidentsJson);
        }
      } catch {
        // Update API card to show error state
        updateApiCard({ status: "down" }, 0);
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
