"use client";

import { useEffect, useMemo, useState } from "react";

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

export function VolumeDashboard() {
  const [summary, setSummary] = useState<VolumeSummary | null>(null);
  const [daily, setDaily] = useState<DailyVolume[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - 30);
    return { from, to };
  }, []);

  useEffect(() => {
    const baseUrl = getApiBaseUrl();
    const params = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });

    const fetchData = async () => {
      setLoading(true);
      try {
        const [summaryRes, dailyRes] = await Promise.all([
          fetch(`${baseUrl}/v1/analytics/volume?${params}`, { cache: "no-store" }),
          fetch(`${baseUrl}/v1/analytics/volume/daily?${params}`, { cache: "no-store" }),
        ]);

        const summaryJson = (await summaryRes.json()) as VolumeSummary;
        const dailyJson = (await dailyRes.json()) as DailyVolume[];
        setSummary(summaryJson);
        setDaily(dailyJson);
      } catch {
        setSummary(null);
        setDaily([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [range]);

  const maxVolume = daily.reduce((max, day) => Math.max(max, day.volumeUsd), 0);

  return (
    <section className="px-6 py-10 md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-micro uppercase tracking-widest text-sp-muted">Analytics</p>
          <h1 className="text-h1 font-bold text-sp-text">Swap Volume</h1>
          <p className="mt-2 text-body text-sp-muted">
            Last 30 days — on-chain confirmed swaps logged via SwapPilot.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-sp-border bg-sp-surface2 p-5">
            <p className="text-micro uppercase text-sp-muted">Total Volume</p>
            <p className="mt-2 text-h2 font-bold text-sp-text">
              {loading ? "—" : formatUsd(summary?.volumeUsd ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-sp-border bg-sp-surface2 p-5">
            <p className="text-micro uppercase text-sp-muted">Total Swaps</p>
            <p className="mt-2 text-h2 font-bold text-sp-text">
              {loading ? "—" : (summary?.swaps ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-sp-border bg-sp-surface2 p-5">
            <p className="text-micro uppercase text-sp-muted">Avg. Daily Volume</p>
            <p className="mt-2 text-h2 font-bold text-sp-text">
              {loading ? "—" : formatUsd((summary?.volumeUsd ?? 0) / Math.max(daily.length, 1))}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-sp-border bg-sp-surface2 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-body font-semibold text-sp-text">Daily Volume</h2>
            <span className="text-micro text-sp-muted">{daily.length} days</span>
          </div>

          <div className="space-y-3">
            {loading && <div className="text-caption text-sp-muted">Loading volume data…</div>}
            {!loading && daily.length === 0 && (
              <div className="text-caption text-sp-muted">No volume data available yet.</div>
            )}
            {!loading &&
              daily.map((day) => {
                const width = maxVolume ? Math.max((day.volumeUsd / maxVolume) * 100, 4) : 4;
                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <div className="w-24 text-micro text-sp-muted">{day.date}</div>
                    <div className="flex-1 rounded-full bg-sp-surface3">
                      <div
                        className="h-2 rounded-full bg-sp-accent"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className="w-28 text-right text-micro text-sp-text">
                      {formatUsd(day.volumeUsd)}
                    </div>
                    <div className="w-14 text-right text-micro text-sp-muted">
                      {day.swaps}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </section>
  );
}
