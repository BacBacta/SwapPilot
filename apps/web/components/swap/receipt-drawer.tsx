"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Button, Pill, Divider, Skeleton } from "@/components/ui/primitives";
import type { DecisionReceipt, RankedQuote } from "@swappilot/shared";

/* ========================================
   RECEIPT DRAWER
   ======================================== */
interface ReceiptDrawerProps {
  open: boolean;
  onClose: () => void;
  receipt?: DecisionReceipt | null;
  selectedQuote?: RankedQuote | null;
  loading?: boolean;
  onConfirm?: (() => void) | undefined;
}

export function ReceiptDrawer({ open, onClose, receipt, selectedQuote, loading, onConfirm }: ReceiptDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-full max-w-lg transform overflow-y-auto border-l border-sp-lightBorder bg-sp-lightSurface shadow-soft transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-sp-lightBorder bg-sp-lightSurface px-6 py-4">
          <div>
            <h2 className="text-h2 font-semibold text-sp-lightText">Decision Receipt</h2>
            <p className="mt-0.5 text-caption text-sp-lightMuted">
              Why this quote was selected
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sp-lightMuted transition hover:bg-sp-lightSurface2 hover:text-sp-lightText"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <LoadingState />
          ) : receipt ? (
            <ReceiptContent receipt={receipt} selectedQuote={selectedQuote ?? undefined} />
          ) : (
            <EmptyState />
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-sp-lightBorder bg-sp-lightSurface px-6 py-4">
          <div className="flex gap-3">
            <Button 
              variant="ghost" 
              className="flex-1 border-sp-lightBorder text-sp-lightText hover:bg-sp-lightSurface2"
              onClick={() => {
                if (receipt) {
                  navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
                }
              }}
            >
              Copy JSON
            </Button>
            {onConfirm ? (
              <Button className="flex-1" onClick={onConfirm}>
                Confirm Swap
              </Button>
            ) : (
              <Button className="flex-1" onClick={onClose}>
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

/* ========================================
   RECEIPT CONTENT
   ======================================== */
function ReceiptContent({ receipt, selectedQuote }: { receipt: DecisionReceipt; selectedQuote: RankedQuote | null | undefined }) {
  const buyTokenDecimals = receipt.request.buyTokenDecimals ?? 18;

  return (
    <>
      {/* Winner */}
      <section>
        <div className="flex items-center justify-between">
          <span className="text-caption text-sp-lightMuted">Best Executable Provider</span>
          <Pill tone="accent">{receipt.bestExecutableQuoteProviderId ?? "N/A"}</Pill>
        </div>
        
        {selectedQuote && (
          <div className="mt-3 rounded-xl border border-sp-lightBorder bg-sp-lightSurface2 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-sp-lightBorder bg-sp-lightSurface text-caption font-bold text-sp-lightText">
                  {selectedQuote.providerId.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-body font-semibold text-sp-lightText">
                    {selectedQuote.providerId}
                  </div>
                  <div className="text-caption text-sp-lightMuted">
                    {selectedQuote.sourceType}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-h2 font-bold text-sp-lightText">
                  {formatBuyAmount(selectedQuote.normalized.buyAmount, buyTokenDecimals)}
                </div>
                <div className="text-caption text-sp-ok font-medium">
                  BEQ Score: {selectedQuote.score.beqScore.toFixed(1)}/100
                </div>
              </div>
            </div>

            {/* BEQ v2 Score Breakdown */}
            {selectedQuote.score.v2Details && (
              <div className="mt-4 pt-4 border-t border-sp-lightBorder">
                <div className="text-caption font-semibold text-sp-lightText mb-2">Score Breakdown</div>
                <BeqScoreBreakdown details={selectedQuote.score.v2Details} />
              </div>
            )}
          </div>
        )}
      </section>

      <Divider />

      {/* Why this quote won */}
      <section>
        <h3 className="text-body font-semibold text-sp-lightText">Why This Quote Won</h3>
        <ul className="mt-3 space-y-2">
          {selectedQuote?.signals.sellability.status === "OK" && (
            <ReasonItem tone="ok" text="Sellability check passed" />
          )}
          {selectedQuote?.signals.revertRisk.level !== "HIGH" && (
            <ReasonItem tone="ok" text="Low revert probability" />
          )}
          {selectedQuote?.signals.mevExposure.level !== "HIGH" && (
            <ReasonItem tone="ok" text="Low MEV exposure" />
          )}
          <ReasonItem tone="neutral" text="Ranked by BEQ (risk-adjusted output)" />
        </ul>
      </section>

      <Divider />

      {/* Risk Signals */}
      {selectedQuote && (
        <section>
          <h3 className="text-body font-semibold text-sp-lightText">Risk Signals</h3>
          <div className="mt-3 grid gap-2">
            <RiskRow
              label="Sellability"
              status={selectedQuote.signals.sellability.status}
              confidence={selectedQuote.signals.sellability.confidence}
            />
            <RiskRow
              label="Revert Risk"
              level={selectedQuote.signals.revertRisk.level}
            />
            <RiskRow
              label="MEV Exposure"
              level={selectedQuote.signals.mevExposure.level}
            />
          </div>
        </section>
      )}

      <Divider />

      {/* Compared Providers */}
      <section>
        <h3 className="text-body font-semibold text-sp-lightText">All Compared Providers</h3>
        <div className="mt-3 space-y-2">
          {receipt.rankedQuotes?.slice(0, 5).map((q, i) => (
            <div
              key={q.providerId}
              className={cn(
                "flex items-center justify-between rounded-xl border px-4 py-3",
                q.providerId === receipt.bestExecutableQuoteProviderId
                  ? "border-sp-accent/30 bg-sp-accent/5"
                  : "border-sp-lightBorder bg-sp-lightSurface"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-micro font-bold text-sp-lightMuted">#{i + 1}</span>
                <span className="text-body font-medium text-sp-lightText">{q.providerId}</span>
              </div>
              <div className="text-body font-semibold text-sp-lightText">
                {formatBuyAmount(q.normalized.buyAmount, buyTokenDecimals)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* Metadata */}
      <section className="text-caption text-sp-lightMuted">
        <div className="flex justify-between">
          <span>Receipt ID</span>
          <span className="font-mono">{receipt.id.slice(0, 12)}...</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>Created</span>
          <span>{new Date(receipt.createdAt).toLocaleString()}</span>
        </div>
      </section>
    </>
  );
}

/* ========================================
   HELPER COMPONENTS
   ======================================== */
function ReasonItem({ tone, text }: { tone: "ok" | "warn" | "neutral"; text: string }) {
  const iconCls = tone === "ok" ? "text-sp-ok" : tone === "warn" ? "text-sp-warn" : "text-sp-lightMuted";
  return (
    <li className="flex items-center gap-2 text-caption text-sp-lightText">
      <span className={cn("text-body", iconCls)}>
        {tone === "ok" ? "✓" : tone === "warn" ? "!" : "•"}
      </span>
      {text}
    </li>
  );
}

function RiskRow({
  label,
  status,
  level,
  confidence,
}: {
  label: string;
  status?: "OK" | "UNCERTAIN" | "FAIL";
  level?: "LOW" | "MEDIUM" | "HIGH";
  confidence?: number;
}) {
  const value = status ?? level ?? "N/A";
  const tone =
    value === "OK" || value === "LOW"
      ? "ok"
      : value === "UNCERTAIN" || value === "MEDIUM"
      ? "warn"
      : "bad";

  return (
    <div className="flex items-center justify-between rounded-lg border border-sp-lightBorder bg-sp-lightSurface px-3 py-2">
      <span className="text-caption text-sp-lightMuted">{label}</span>
      <div className="flex items-center gap-2">
        <Pill tone={tone} size="sm">{value}</Pill>
        {confidence !== undefined && (
          <span className="text-micro text-sp-lightMuted">{(confidence * 100).toFixed(0)}%</span>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48 bg-sp-lightSurface2" />
      <Skeleton className="h-20 w-full bg-sp-lightSurface2" />
      <Skeleton className="h-4 w-32 bg-sp-lightSurface2" />
      <Skeleton className="h-16 w-full bg-sp-lightSurface2" />
      <Skeleton className="h-16 w-full bg-sp-lightSurface2" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-12 text-center">
      <div className="text-4xl">📋</div>
      <div className="mt-3 text-body font-medium text-sp-lightText">No Receipt Available</div>
      <div className="mt-1 text-caption text-sp-lightMuted">
        Execute a swap to see the decision receipt
      </div>
    </div>
  );
}

/* ========================================
   BEQ V2 SCORE BREAKDOWN
   ======================================== */
interface BeqV2DetailsType {
  beqScore: number;
  disqualified: boolean;
  disqualifiedReason?: string | undefined;
  components: {
    outputScore: number;
    reliabilityFactor: number;
    sellabilityFactor: number;
    riskFactor: number;
    preflightFactor: number;
    qualityMultiplier?: number | undefined;
    riskMultiplier?: number | undefined;
  };
  explanation: string[];
  rawData: {
    buyAmount: string;
    maxBuyAmount: string;
    feeBps: number | null;
    integrationConfidence: number;
    netBuyAmount?: string | undefined;
  };
}

function BeqScoreBreakdown({ details }: { details: BeqV2DetailsType }) {
  const { components, explanation } = details;
  
  return (
    <div className="space-y-3">
      {/* Visual score bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-micro text-sp-lightMuted">
          <span>Output Score</span>
          <span className="font-medium text-sp-lightText">{components.outputScore.toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full bg-sp-lightBorder overflow-hidden">
          <div 
            className="h-full bg-sp-primary rounded-full transition-all" 
            style={{ width: `${Math.min(components.outputScore, 100)}%` }}
          />
        </div>
      </div>

      {/* Factor breakdown */}
      <div className="grid grid-cols-2 gap-2">
        <ScoreFactorPill 
          label="Reliability" 
          value={components.reliabilityFactor} 
          tooltip="Integration confidence with this provider"
        />
        <ScoreFactorPill 
          label="Sellability" 
          value={components.sellabilityFactor}
          tooltip="Ability to sell the output token"
        />
        <ScoreFactorPill 
          label="Risk" 
          value={components.riskFactor}
          tooltip="Risk assessment (revert, MEV, churn)"
        />
        {components.liquidityFactor !== undefined && (
          <ScoreFactorPill
            label="Liquidity"
            value={components.liquidityFactor}
            tooltip="Liquidity depth risk factor"
          />
        )}
        {components.slippageFactor !== undefined && (
          <ScoreFactorPill
            label="Slippage"
            value={components.slippageFactor}
            tooltip="Estimated slippage risk factor"
          />
        )}
        {components.protocolFactor !== undefined && (
          <ScoreFactorPill
            label="Protocol"
            value={components.protocolFactor}
            tooltip="Protocol risk (security, compliance, ops)"
          />
        )}
        <ScoreFactorPill 
          label="Preflight" 
          value={components.preflightFactor}
          tooltip="Simulation result confidence"
        />
      </div>

      {/* Formula explanation */}
      <div className="text-micro text-sp-lightMuted bg-sp-lightSurface rounded-lg px-3 py-2">
        <div className="font-medium text-sp-lightText mb-1">Formula:</div>
        <code className="text-micro">
          BEQ = Output × Quality × Risk
        </code>
        <div className="mt-1">
          = {components.outputScore.toFixed(1)} × {(components.qualityMultiplier ?? (components.reliabilityFactor * components.sellabilityFactor)).toFixed(3)} × {(components.riskMultiplier ?? (components.riskFactor * components.preflightFactor)).toFixed(3)}
        </div>
        <div className="mt-1 font-semibold text-sp-ok">
          = {details.beqScore.toFixed(1)}/100
        </div>
      </div>

      {/* Explanation list */}
      {explanation.length > 0 && (
        <div className="space-y-1">
          <div className="text-micro font-medium text-sp-lightText">Details:</div>
          <ul className="text-micro text-sp-lightMuted space-y-0.5">
            {explanation.map((exp, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-sp-lightMuted">•</span>
                <span>{exp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScoreFactorPill({ label, value, tooltip }: { label: string; value: number; tooltip: string }) {
  const percentage = (value * 100).toFixed(0);
  const tone = value >= 0.8 ? 'ok' : value >= 0.5 ? 'warn' : 'bad';
  const colorClass = tone === 'ok' 
    ? 'text-sp-ok bg-sp-ok/10' 
    : tone === 'warn' 
    ? 'text-sp-warn bg-sp-warn/10' 
    : 'text-sp-bad bg-sp-bad/10';
  
  return (
    <div 
      className={cn(
        "flex items-center justify-between rounded-lg px-2 py-1.5 text-micro",
        colorClass
      )}
      title={tooltip}
    >
      <span>{label}</span>
      <span className="font-semibold">{percentage}%</span>
    </div>
  );
}

/* ========================================
   UTILS
   ======================================== */
function formatBuyAmount(amount: string, decimals: number): string {
  const value = Number(BigInt(amount)) / 10 ** decimals;
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/* ========================================
   ICONS
   ======================================== */
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
