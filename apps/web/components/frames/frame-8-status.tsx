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

// Helper to get status color classes
const getStatusColor = (status: string) => {
  switch (status) {
    case "ok": return "text-green-400";
    case "degraded": return "text-yellow-400";
    case "down": return "text-red-400";
    default: return "text-gray-400";
  }
};

const getStatusDot = (status: string) => {
  switch (status) {
    case "ok": return "bg-green-400";
    case "degraded": return "bg-yellow-400";
    case "down": return "bg-red-500";
    default: return "bg-gray-500";
  }
};

const getRateColor = (rate: number) => {
  if (rate >= 70) return "text-green-400";
  if (rate >= 40) return "text-yellow-400";
  return "text-red-400";
};

export function FrameStatusDashboard() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [apiHealth, setApiHealth] = useState<"ok" | "degraded" | "down">("ok");

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/v1/providers/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
      setError(null);
      setApiHealth("ok");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch status");
      setApiHealth("down");
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
  const degradedCount = providers.filter((p) => p.status === "degraded").length;

  return (
    <CardDark className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-sp-border bg-sp-surface/90 px-4 py-3">
        <div className="text-xs font-semibold text-white">SwapPilot Provider Status</div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] text-gray-400">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="rounded-md bg-white/10 px-2 py-1 text-[10px] font-medium text-gray-300 hover:bg-white/20 hover:text-white transition disabled:opacity-50"
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
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] text-gray-400">Providers</div>
            <div className="mt-2 text-lg font-extrabold text-white">{providers.length}</div>
            <div className="mt-1 text-[10px] text-gray-500">Total integrated</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] text-gray-400">Quote APIs</div>
            <div className="mt-2 text-lg font-extrabold text-white">{activeProviders.length}</div>
            <div className="mt-1 text-[10px] text-gray-500">Active quote sources</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] text-gray-400">Success Rate</div>
            <div className={`mt-2 text-lg font-extrabold ${getRateColor(avgSuccessRate)}`}>
              {avgSuccessRate}%
            </div>
            <div className="mt-1 text-[10px] text-gray-500">Average across APIs</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] text-gray-400">Avg Latency</div>
            <div className="mt-2 text-lg font-extrabold text-white">{avgLatency}ms</div>
            <div className="mt-1 text-[10px] text-gray-500">Quote response time</div>
          </div>
        </div>

        {/* Active Quote Providers */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-white">Quote Providers ({activeProviders.length})</div>
            <Pill tone="accent">Live</Pill>
          </div>
          <div className="grid gap-2">
            {loading && !data ? (
              <div className="py-4 text-center text-sm text-gray-400">Loading...</div>
            ) : activeProviders.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-400">No data available</div>
            ) : (
              activeProviders.map((p) => (
                <div 
                  key={p.providerId} 
                  className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${getStatusDot(p.status)}`} />
                    <div className="text-xs font-semibold text-white">{p.displayName}</div>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-gray-400">
                      {p.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className={getRateColor(p.successRate)}>
                      {p.successRate}%
                    </span>
                    <span className="text-gray-400">{p.latencyMs}ms</span>
                    <span className="text-[10px] text-gray-500">{p.observations} obs</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* DeepLink Only Providers */}
        {deepLinkOnlyProviders.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-white">DeepLink Only ({deepLinkOnlyProviders.length})</div>
              <Pill>Redirect</Pill>
            </div>
            <div className="grid gap-2">
              {deepLinkOnlyProviders.map((p) => (
                <div 
                  key={p.providerId} 
                  className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-gray-500" />
                    <div className="text-xs font-semibold text-white">{p.displayName}</div>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-gray-400">
                      {p.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    No quote API
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System Health */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-xs font-semibold text-white mb-3">System Health</div>
          <div className="grid gap-2 text-[11px]">
            <div className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${getStatusDot(apiHealth)}`} />
                <span className="text-white font-semibold">SwapPilot API</span>
              </div>
              <span className={getStatusColor(apiHealth)}>{apiHealth}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${healthyCount > 0 ? "bg-green-400" : "bg-red-500"}`} />
                <span className="text-white font-semibold">Healthy Providers</span>
              </div>
              <span className={healthyCount >= 8 ? "text-green-400" : healthyCount >= 5 ? "text-yellow-400" : "text-red-400"}>
                {healthyCount}/{providers.length}
              </span>
            </div>
            {degradedCount > 0 && (
              <div className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-400" />
                  <span className="text-white font-semibold">Degraded Providers</span>
                </div>
                <span className="text-yellow-400">{degradedCount}</span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400" />
                <span className="text-white font-semibold">BSC RPC</span>
              </div>
              <span className="text-green-400">ok</span>
            </div>
          </div>
        </div>
      </div>
    </CardDark>
  );
}
