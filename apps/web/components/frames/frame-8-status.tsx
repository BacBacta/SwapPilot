"use client";

import { useState, useEffect } from "react";
import { CardDark } from "@/components/ui/surfaces";
import { Pill } from "@/components/ui/primitives";

type ProviderStatus = {
  providerId: string;
  displayName: string;
  category: string;
  capabilities: {
    quote: boolean;
    buildTx: boolean;
    deepLink: boolean;
  };
  successRate: number;
  latencyMs: number;
  observations: number;
  status: "ok" | "degraded" | "down" | "unknown";
};

type StatusResponse = {
  providers: ProviderStatus[];
  timestamp: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://swappilot-api.fly.dev";

export function FrameStatusDashboard() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/v1/providers/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const providers = data?.providers ?? [];
  const activeProviders = providers.filter((p) => p.capabilities.quote);
  const deepLinkOnlyProviders = providers.filter((p) => !p.capabilities.quote);

  const avgSuccessRate = activeProviders.length > 0
    ? Math.round(activeProviders.reduce((sum, p) => sum + p.successRate, 0) / activeProviders.length)
    : 0;

  const avgLatency = activeProviders.length > 0
    ? Math.round(activeProviders.reduce((sum, p) => sum + p.latencyMs, 0) / activeProviders.length)
    : 0;

  const healthyCount = providers.filter((p) => p.status === "ok").length;

  return (
    <CardDark className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-sp-border bg-sp-surface/90 px-4 py-3">
        <div className="text-xs font-semibold">SwapPilot Provider Status</div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] text-sp-muted">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="rounded-md bg-sp-surface2 px-2 py-1 text-[10px] font-medium text-sp-muted hover:bg-sp-surface3 hover:text-sp-text transition disabled:opacity-50"
          >
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="p-4 grid gap-3">
        {/* Summary Stats */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-sp-border bg-white/5 p-3">
            <div className="text-[11px] text-sp-muted">Providers</div>
            <div className="mt-2 text-sm font-extrabold">{providers.length}</div>
            <div className="mt-2 text-[11px] text-sp-muted">Total integrated</div>
          </div>
          <div className="rounded-lg border border-sp-border bg-white/5 p-3">
            <div className="text-[11px] text-sp-muted">Quote APIs</div>
            <div className="mt-2 text-sm font-extrabold">{activeProviders.length}</div>
            <div className="mt-2 text-[11px] text-sp-muted">Active quote sources</div>
          </div>
          <div className="rounded-lg border border-sp-border bg-white/5 p-3">
            <div className="text-[11px] text-sp-muted">Success Rate</div>
            <div className={`mt-2 text-sm font-extrabold ${avgSuccessRate >= 70 ? "text-sp-ok" : avgSuccessRate >= 40 ? "text-sp-warn" : "text-red-400"}`}>
              {avgSuccessRate}%
            </div>
            <div className="mt-2 text-[11px] text-sp-muted">Average across APIs</div>
          </div>
          <div className="rounded-lg border border-sp-border bg-white/5 p-3">
            <div className="text-[11px] text-sp-muted">Avg Latency</div>
            <div className="mt-2 text-sm font-extrabold">{avgLatency}ms</div>
            <div className="mt-2 text-[11px] text-sp-muted">Quote response time</div>
          </div>
        </div>

        {/* Active Quote Providers */}
        <div className="rounded-lg border border-sp-border bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold">Quote Providers ({activeProviders.length})</div>
            <Pill tone="accent">Live</Pill>
          </div>
          <div className="mt-3 grid gap-2">
            {loading && !data ? (
              <div className="py-4 text-center text-sm text-sp-muted">Loading...</div>
            ) : activeProviders.length === 0 ? (
              <div className="py-4 text-center text-sm text-sp-muted">No data available</div>
            ) : (
              activeProviders.map((p) => (
                <div 
                  key={p.providerId} 
                  className="flex items-center justify-between rounded-md border border-sp-border bg-sp-surface/60 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className={`h-2.5 w-2.5 rounded-full ${
                        p.status === "ok" ? "bg-sp-ok" : 
                        p.status === "degraded" ? "bg-sp-warn" : 
                        p.status === "down" ? "bg-red-500" : "bg-gray-500"
                      }`} 
                    />
                    <div className="text-xs font-semibold">{p.displayName}</div>
                    <span className="rounded bg-sp-surface2 px-1.5 py-0.5 text-[9px] text-sp-muted">
                      {p.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-sp-muted">
                    <span className={p.successRate >= 70 ? "text-sp-ok" : p.successRate >= 40 ? "text-sp-warn" : "text-red-400"}>
                      {p.successRate}%
                    </span>
                    <span>{p.latencyMs}ms</span>
                    <span className="text-[10px]">{p.observations} obs</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* DeepLink Only Providers */}
        {deepLinkOnlyProviders.length > 0 && (
          <div className="rounded-lg border border-sp-border bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold">DeepLink Only ({deepLinkOnlyProviders.length})</div>
              <Pill>Redirect</Pill>
            </div>
            <div className="mt-3 grid gap-2">
              {deepLinkOnlyProviders.map((p) => (
                <div 
                  key={p.providerId} 
                  className="flex items-center justify-between rounded-md border border-sp-border bg-sp-surface/60 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-gray-500" />
                    <div className="text-xs font-semibold">{p.displayName}</div>
                    <span className="rounded bg-sp-surface2 px-1.5 py-0.5 text-[9px] text-sp-muted">
                      {p.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-sp-muted">
                    No quote API
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* API Health */}
        <div className="rounded-lg border border-sp-border bg-white/5 p-3">
          <div className="text-[11px] font-semibold">System Status</div>
          <div className="mt-2 grid gap-2 text-[11px]">
            <div className="flex items-center justify-between rounded-md border border-sp-border bg-sp-surface/60 px-3 py-2">
              <span className="text-sp-text font-semibold">SwapPilot API</span>
              <span className="text-sp-ok">ok</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-sp-border bg-sp-surface/60 px-3 py-2">
              <span className="text-sp-text font-semibold">BSC RPC</span>
              <span className="text-sp-ok">ok</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-sp-border bg-sp-surface/60 px-3 py-2">
              <span className="text-sp-text font-semibold">Healthy Providers</span>
              <span className={healthyCount >= 8 ? "text-sp-ok" : healthyCount >= 5 ? "text-sp-warn" : "text-red-400"}>
                {healthyCount}/{providers.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </CardDark>
  );
}
