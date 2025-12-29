"use client";

import { useState } from "react";
import { CardDark } from "@/components/ui/surfaces";
import { Button, Pill, Badge, Skeleton } from "@/components/ui/primitives";
import { TokenInput, SwapDirectionButton } from "@/components/ui/token-input";
import { Tabs, PresetButtons } from "@/components/ui/inputs";
import { Table, Row } from "@/components/ui/table";
import { bestExecutable, type QuoteRow } from "@/lib/mock";

/* ========================================
   PROVIDER ROW - Individual quote display
   ======================================== */
function ProviderRow({
  quote,
  isWinner = false,
  rank,
}: {
  quote: QuoteRow;
  isWinner?: boolean;
  rank: number;
}) {
  return (
    <div
      className={`group flex items-center justify-between rounded-xl border p-3.5 transition-all duration-200 ${
        isWinner
          ? "border-sp-accent/40 bg-sp-accent/10 shadow-glow"
          : "border-sp-border bg-sp-surface2 hover:border-sp-borderHover hover:bg-sp-surface3"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Rank badge */}
        <div
          className={`grid h-7 w-7 place-items-center rounded-lg text-micro font-bold ${
            isWinner ? "bg-sp-accent text-black" : "bg-sp-surface3 text-sp-muted"
          }`}
        >
          {rank}
        </div>

        {/* Provider icon */}
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-sp-border bg-sp-surface text-caption font-bold text-sp-text">
          {quote.provider.slice(0, 2).toUpperCase()}
        </div>

        {/* Provider info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-body font-semibold text-sp-text">{quote.provider}</span>
            {isWinner && <Pill tone="accent" size="sm">BEST</Pill>}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge dot tone={quote.confidence >= 90 ? "ok" : quote.confidence >= 80 ? "warn" : "bad"}>
              {quote.confidence}% conf.
            </Badge>
            {quote.flags.includes("MEV") && (
              <Pill tone="warn" size="sm">MEV Risk</Pill>
            )}
            {quote.flags.includes("SELL_OK") && (
              <Pill tone="ok" size="sm">Verified</Pill>
            )}
          </div>
        </div>
      </div>

      {/* Output value */}
      <div className="text-right">
        <div className={`text-h2 font-bold ${isWinner ? "text-sp-accent" : "text-sp-text"}`}>
          ${quote.outUsd.toLocaleString()}
        </div>
        {quote.deltaPct !== undefined && quote.deltaPct !== 0 && (
          <div
            className={`mt-0.5 text-caption font-medium ${
              quote.deltaPct > 0 ? "text-sp-ok" : "text-sp-bad"
            }`}
          >
            {quote.deltaPct > 0 ? "+" : ""}
            {quote.deltaPct.toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================
   STAT CARD - Compact info display
   ======================================== */
function StatCard({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="rounded-xl border border-sp-border bg-sp-surface2 p-3 text-center transition hover:border-sp-borderHover">
      <div className="text-micro text-sp-muted">{label}</div>
      <div className="mt-1 text-body font-bold text-sp-text">{value}</div>
      {subValue && <div className="mt-0.5 text-micro text-sp-muted2">{subValue}</div>}
    </div>
  );
}

/* ========================================
   MAIN SWAP FRAME - Improved version
   ======================================== */
export function FrameSwapImproved() {
  const [mode, setMode] = useState<"BEQ" | "RAW">("BEQ");
  const [fromToken, setFromToken] = useState("BNB");
  const [toToken, setToToken] = useState("ETH");
  const [fromValue, setFromValue] = useState("8,500");
  const [loading, setLoading] = useState(false);

  const handleSwapDirection = () => {
    const tmp = fromToken;
    setFromToken(toToken);
    setToToken(tmp);
  };

  return (
    <CardDark className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-sp-border bg-sp-surface/80 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-sp-accent font-bold text-black shadow-glow">
            SP
          </div>
          <div>
            <div className="text-body font-semibold text-sp-text">SwapPilot</div>
            <div className="text-micro text-sp-muted">Smart execution • BNB Chain</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Tabs
            tabs={[
              { value: "BEQ", label: "Best Exec" },
              { value: "RAW", label: "Raw Output" },
            ]}
            value={mode}
            onChange={setMode}
            size="sm"
          />
          <Button variant="soft" size="sm">
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Left: Swap form */}
          <div className="space-y-1">
            <TokenInput
              label="From"
              token={fromToken}
              balance="12.45"
              value={fromValue}
              usdValue="≈ $8,500.00"
              onChange={setFromValue}
              onMaxClick={() => setFromValue("12.45")}
            />

            <SwapDirectionButton onClick={handleSwapDirection} />

            <TokenInput
              label="To"
              token={toToken}
              value="2.85"
              usdValue="≈ $8,478.50"
              loading={loading}
              readOnly
            />

            {/* Mode selector */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-caption text-sp-muted">Execution mode</span>
              <PresetButtons
                options={[
                  { value: "safe", label: "Safe" },
                  { value: "balanced", label: "Balanced" },
                  { value: "turbo", label: "Turbo" },
                ]}
                value="balanced"
              />
            </div>

            {/* Stats row */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatCard label="Network" value="$0.36" subValue="~12s" />
              <StatCard label="Slippage" value="0.5%" />
              <StatCard label="Impact" value="-0.02%" />
            </div>

            {/* CTA */}
            <Button className="mt-5 h-12 w-full text-body" size="lg">
              Execute Best Quote
            </Button>

            <p className="mt-3 text-center text-micro text-sp-muted2">
              BEQ-first routing with sellability + MEV protection
            </p>
          </div>

          {/* Right: Provider quotes */}
          <div className="rounded-xl border border-sp-border bg-sp-surface p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-body font-semibold text-sp-text">Provider Quotes</h3>
                <p className="mt-0.5 text-micro text-sp-muted">5 providers compared</p>
              </div>
              <Pill tone={mode === "BEQ" ? "accent" : "blue"}>{mode}</Pill>
            </div>

            <div className="space-y-2">
              {bestExecutable.map((quote, i) => (
                <ProviderRow
                  key={quote.provider}
                  quote={quote}
                  rank={i + 1}
                  isWinner={i === 0}
                />
              ))}
            </div>

            <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sp-border py-3 text-caption text-sp-muted transition hover:border-sp-borderHover hover:text-sp-text">
              <span>Show more providers</span>
              <ChevronDownIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </CardDark>
  );
}

/* ========================================
   ICONS
   ======================================== */
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
