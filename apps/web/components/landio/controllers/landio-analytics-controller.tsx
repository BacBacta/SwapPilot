"use client";

import { useEffect } from "react";
import { escapeHtml, setSanitizedHtml } from "@/lib/sanitize";

type VolumeSummary = {
  volumeUsd: number;
  swaps: number;
};

type DailyVolume = {
  date: string;
  volumeUsd: number;
  swaps: number;
};

function getApiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    (process.env.NODE_ENV === "production" ? "https://swappilot-api.fly.dev" : "http://localhost:3001");
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
}

function setHtml(id: string, html: string) {
  const el = document.getElementById(id);
  if (!el) return;
  setSanitizedHtml(el, html);
}

export function LandioAnalyticsController() {
  useEffect(() => {
    const from = new Date();
    const to = new Date();
    from.setUTCDate(from.getUTCDate() - 30);

    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });

    const fetchData = async () => {
      setText("analyticsStatus", "Loading volume data…");
      try {
        const baseUrl = getApiBaseUrl();
        const [summaryRes, dailyRes] = await Promise.all([
          fetch(`${baseUrl}/v1/analytics/volume?${params}`, { cache: "no-store" }),
          fetch(`${baseUrl}/v1/analytics/volume/daily?${params}`, { cache: "no-store" }),
        ]);

        if (!summaryRes.ok || !dailyRes.ok) {
          throw new Error("Analytics API unavailable");
        }

        const summaryJson = (await summaryRes.json()) as VolumeSummary;
        const dailyJsonRaw = await dailyRes.json();
        const dailyJson = Array.isArray(dailyJsonRaw) ? (dailyJsonRaw as DailyVolume[]) : [];

        setText("analyticsTotalVolume", formatUsd(summaryJson.volumeUsd ?? 0));
        setText("analyticsTotalSwaps", (summaryJson.swaps ?? 0).toLocaleString());
        const avgDaily = summaryJson.volumeUsd / Math.max(dailyJson.length, 1);
        setText("analyticsAvgDaily", formatUsd(avgDaily));

        setText("analyticsDailyCount", `${dailyJson.length} days`);

        if (!dailyJson.length) {
          setText("analyticsStatus", "No volume data available yet.");
          setHtml("analyticsDailyList", "");
          return;
        }

        setText("analyticsStatus", "");
        const maxVolume = dailyJson.reduce((max, day) => Math.max(max, day.volumeUsd), 0);
        const rows = dailyJson
          .map((day) => {
            const widthRaw = maxVolume ? Math.max((day.volumeUsd / maxVolume) * 100, 4) : 4;
            const width = Math.max(0, Math.min(100, Number.isFinite(widthRaw) ? widthRaw : 4));
            const safeDate = escapeHtml(String(day.date ?? ""));
            const safeValue = escapeHtml(formatUsd(day.volumeUsd ?? 0));
            const safeSwaps = escapeHtml(String(day.swaps ?? 0));
            return `
              <div class="analytics-row">
                <div class="analytics-muted">${safeDate}</div>
                <div class="analytics-bar"><div class="analytics-bar-fill" style="width:${width}%"></div></div>
                <div class="analytics-value">${safeValue}</div>
                <div class="analytics-count">${safeSwaps}</div>
              </div>
            `;
          })
          .join("");

        setHtml("analyticsDailyList", rows);
      } catch {
        setText("analyticsTotalVolume", "—");
        setText("analyticsTotalSwaps", "—");
        setText("analyticsAvgDaily", "—");
        setText("analyticsDailyCount", "0 days");
        setText("analyticsStatus", "Analytics API unavailable");
        setHtml("analyticsDailyList", "");
      }
    };

    fetchData();
  }, []);

  return null;
}
