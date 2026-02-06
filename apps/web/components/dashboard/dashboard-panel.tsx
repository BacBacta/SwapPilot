"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────
type SuccessRate = { total: number; success: number; failed: number; rate: number };
type UniqueWallets = {
  totalUniqueWallets: number;
  daily: { date: string; uniqueWallets: number }[];
};
type QuoteAccuracy = {
  samplesCount: number;
  avgSlippagePct: number;
  medianSlippagePct: number;
  maxSlippagePct: number;
};
type BeqWinRate = { total: number; matches: number; winRate: number };
type Revenue = {
  totalRevenueUsd: number;
  avgRevenuePerSwap: number;
  swapCount: number;
  feeBps: number;
};
type Latency = {
  quotesP50Ms: number;
  quotesP95Ms: number;
  quotesP99Ms: number;
  totalRequests: number;
};
type VolumeSummary = { volumeUsd: number; swaps: number };
type DailyVolume = { date: string; volumeUsd: number; swaps: number };
type LeaderboardEntry = {
  rank: number;
  wallet: string;
  volumeUsd: number;
  swapCount: number;
  score: number;
};
type Leaderboard = { participants: number; leaderboard: LeaderboardEntry[] };

// ─── API helpers ──────────────────────────────────────────────────────
function getApiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://swappilot-api.fly.dev"
      : "http://localhost:3001");
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

async function fetchJson<T>(path: string, params?: Record<string, string>): Promise<T | null> {
  try {
    const url = new URL(path, getApiBaseUrl());
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v) url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── UI helpers ───────────────────────────────────────────────────────
function formatUsd(v: number) {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function formatPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}
function truncateWallet(w: string) {
  return `${w.slice(0, 6)}...${w.slice(-4)}`;
}

function KpiCard({
  label,
  value,
  sub,
  color = "text-white",
}: {
  label: string;
  value: string;
  sub?: string | undefined;
  color?: string | undefined;
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
      <div className="text-xs text-white/50 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-white/40 mt-1">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mt-8 mb-3">{children}</h2>;
}

// ─── Main component ───────────────────────────────────────────────────
export function DashboardPanel() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    successRate: SuccessRate | null;
    wallets: UniqueWallets | null;
    accuracy: QuoteAccuracy | null;
    beqWinRate: BeqWinRate | null;
    revenue: Revenue | null;
    latency: Latency | null;
    volume: VolumeSummary | null;
    daily: DailyVolume[] | null;
    leaderboard: Leaderboard | null;
  }>({
    successRate: null,
    wallets: null,
    accuracy: null,
    beqWinRate: null,
    revenue: null,
    latency: null,
    volume: null,
    daily: null,
    leaderboard: null,
  });
  const [budgetInput, setBudgetInput] = useState("800");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  const params = {
    from: thirtyDaysAgo.toISOString(),
    to: new Date().toISOString(),
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    const [successRate, wallets, accuracy, beqWinRate, revenue, latency, volume, daily, leaderboard] =
      await Promise.all([
        fetchJson<SuccessRate>("/v1/analytics/success-rate", params),
        fetchJson<UniqueWallets>("/v1/analytics/unique-wallets", params),
        fetchJson<QuoteAccuracy>("/v1/analytics/quote-accuracy", params),
        fetchJson<BeqWinRate>("/v1/analytics/beq-winrate"),
        fetchJson<Revenue>("/v1/analytics/revenue", params),
        fetchJson<Latency>("/v1/analytics/latency"),
        fetchJson<VolumeSummary>("/v1/analytics/volume", params),
        fetchJson<DailyVolume[]>("/v1/analytics/volume/daily", params),
        fetchJson<Leaderboard>("/v1/analytics/leaderboard", { ...params, limit: "10" }),
      ]);
    setData({ successRate, wallets, accuracy, beqWinRate, revenue, latency, volume, daily, leaderboard });
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000); // Refresh every 5 min
    return () => clearInterval(interval);
  }, [refresh]);

  const cac =
    data.wallets && data.wallets.totalUniqueWallets > 0 && budgetInput
      ? Number(budgetInput) / data.wallets.totalUniqueWallets
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">SwapPilot KPI Dashboard</h1>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 transition"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* ─── Couche 1: Produit ─────────────────────────────────── */}
      <SectionTitle>Couche 1 — Produit (fiabilit&eacute; technique)</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Taux de succ&egrave;s TX"
          value={data.successRate ? formatPct(data.successRate.rate) : "—"}
          sub={data.successRate ? `${data.successRate.success}/${data.successRate.total}` : undefined}
          color={data.successRate && data.successRate.rate >= 0.95 ? "text-green-400" : "text-red-400"}
        />
        <KpiCard
          label="Latence quotes p95"
          value={data.latency ? `${data.latency.quotesP95Ms}ms` : "—"}
          sub={data.latency ? `p50: ${data.latency.quotesP50Ms}ms | p99: ${data.latency.quotesP99Ms}ms` : undefined}
          color={data.latency && data.latency.quotesP95Ms <= 500 ? "text-green-400" : "text-yellow-400"}
        />
        <KpiCard
          label="Quote accuracy"
          value={data.accuracy ? `${data.accuracy.avgSlippagePct.toFixed(3)}%` : "—"}
          sub={data.accuracy ? `${data.accuracy.samplesCount} samples | max: ${data.accuracy.maxSlippagePct.toFixed(3)}%` : undefined}
          color={data.accuracy && data.accuracy.avgSlippagePct < 0.5 ? "text-green-400" : "text-yellow-400"}
        />
        <KpiCard
          label="BEQ win rate"
          value={data.beqWinRate ? formatPct(data.beqWinRate.winRate) : "—"}
          sub={data.beqWinRate ? `${data.beqWinRate.matches}/${data.beqWinRate.total} quotes` : undefined}
          color={data.beqWinRate && data.beqWinRate.winRate >= 0.65 ? "text-green-400" : "text-yellow-400"}
        />
      </div>

      {/* ─── Couche 2: Adoption ────────────────────────────────── */}
      <SectionTitle>Couche 2 — Adoption (funnel utilisateur)</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Wallets uniques (30j)"
          value={data.wallets ? data.wallets.totalUniqueWallets.toString() : "—"}
        />
        <KpiCard
          label="Swaps (30j)"
          value={data.volume ? data.volume.swaps.toLocaleString() : "—"}
        />
        <KpiCard
          label="Volume (30j)"
          value={data.volume ? formatUsd(data.volume.volumeUsd) : "—"}
        />
        <KpiCard
          label="Vol. quotidien moyen"
          value={
            data.volume && data.daily
              ? formatUsd(data.volume.volumeUsd / Math.max(data.daily.length, 1))
              : "—"
          }
        />
      </div>

      {/* Daily chart */}
      {data.daily && data.daily.length > 0 && (
        <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-xs text-white/50 mb-3">Volume quotidien (30 jours)</div>
          <div className="space-y-1">
            {data.daily.slice(-14).map((day) => {
              const maxVol = Math.max(...(data.daily ?? []).map((d) => d.volumeUsd));
              const width = maxVol > 0 ? Math.max((day.volumeUsd / maxVol) * 100, 2) : 2;
              return (
                <div key={day.date} className="flex items-center gap-2 text-xs">
                  <span className="text-white/40 w-20 shrink-0">{day.date.slice(5)}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-3">
                    <div
                      className="bg-amber-500/60 h-3 rounded-full"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="text-white/60 w-20 text-right">{formatUsd(day.volumeUsd)}</span>
                  <span className="text-white/40 w-10 text-right">{day.swaps}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Couche 3: Économie ────────────────────────────────── */}
      <SectionTitle>Couche 3 — &Eacute;conomie (viabilit&eacute;)</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Revenu total (30j)"
          value={data.revenue ? formatUsd(data.revenue.totalRevenueUsd) : "—"}
          sub={data.revenue ? `${data.revenue.swapCount} swaps au-dessus de $50` : undefined}
        />
        <KpiCard
          label="Revenu moyen / swap"
          value={data.revenue ? formatUsd(data.revenue.avgRevenuePerSwap) : "—"}
          sub={data.revenue ? `Fee: ${data.revenue.feeBps} bps (0.1%)` : undefined}
        />
        <KpiCard
          label="CAC (co&ucirc;t / trader actif)"
          value={cac !== null ? formatUsd(cac) : "—"}
          sub={`Budget: $${budgetInput}`}
        />
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-xs text-white/50 mb-1">Budget marketing ($)</div>
          <input
            type="number"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            className="w-full bg-white/10 rounded-lg px-3 py-2 text-white text-sm border border-white/20 focus:border-amber-400 focus:outline-none"
          />
        </div>
      </div>

      {/* ─── Leaderboard ───────────────────────────────────────── */}
      <SectionTitle>Leaderboard — Top traders (30j)</SectionTitle>
      {data.leaderboard && data.leaderboard.leaderboard.length > 0 ? (
        <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/50 text-xs border-b border-white/10">
                <th className="text-left py-2 px-3">#</th>
                <th className="text-left py-2 px-3">Wallet</th>
                <th className="text-right py-2 px-3">Volume</th>
                <th className="text-right py-2 px-3">Swaps</th>
                <th className="text-right py-2 px-3">Score</th>
              </tr>
            </thead>
            <tbody>
              {data.leaderboard.leaderboard.map((entry) => (
                <tr key={entry.wallet} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 px-3 font-mono text-amber-400">{entry.rank}</td>
                  <td className="py-2 px-3 font-mono text-white/80">{truncateWallet(entry.wallet)}</td>
                  <td className="py-2 px-3 text-right">{formatUsd(entry.volumeUsd)}</td>
                  <td className="py-2 px-3 text-right text-white/60">{entry.swapCount}</td>
                  <td className="py-2 px-3 text-right font-semibold">{entry.score.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-xs text-white/40 px-3 py-2">
            {data.leaderboard.participants} participants | Score = 60% volume + 40% swaps (normalis&eacute;)
          </div>
        </div>
      ) : (
        <div className="text-white/40 text-sm">Aucune donn&eacute;e de leaderboard disponible.</div>
      )}

      {/* ─── Unique wallets daily ──────────────────────────────── */}
      {data.wallets && data.wallets.daily.length > 0 && (
        <>
          <SectionTitle>Wallets uniques par jour</SectionTitle>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="space-y-1">
              {data.wallets.daily.slice(-14).map((day) => {
                const maxW = Math.max(...(data.wallets?.daily ?? []).map((d) => d.uniqueWallets));
                const width = maxW > 0 ? Math.max((day.uniqueWallets / maxW) * 100, 4) : 4;
                return (
                  <div key={day.date} className="flex items-center gap-2 text-xs">
                    <span className="text-white/40 w-20 shrink-0">{day.date.slice(5)}</span>
                    <div className="flex-1 bg-white/5 rounded-full h-3">
                      <div
                        className="bg-blue-500/60 h-3 rounded-full"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="text-white/60 w-10 text-right">{day.uniqueWallets}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="mt-8 text-xs text-white/30 text-center">
        Derni&egrave;re mise &agrave; jour: {new Date().toLocaleTimeString()} | Auto-refresh: 5 min
      </div>
    </div>
  );
}
