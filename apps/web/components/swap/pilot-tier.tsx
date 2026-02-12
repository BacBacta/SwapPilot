"use client";

import { usePilotTier, getTierDisplay, formatPilotBalance } from "@/lib/hooks/use-fees";
import { Pill } from "@/components/ui/primitives";

/**
 * Compact PILOT tier badge for header/nav
 */
export function PilotTierBadge() {
  const { data: tierInfo, isLoading } = usePilotTier();

  if (isLoading || !tierInfo || tierInfo.tier === "none") {
    return null;
  }

  const display = getTierDisplay(tierInfo.tier);

  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-sp-surface2 px-2.5 py-1.5 border border-sp-border">
      <span className="text-sm">{display.emoji}</span>
      <span className={`text-micro font-semibold ${display.color}`}>
        {display.name}
      </span>
      <span className="text-micro text-sp-muted">
        -{tierInfo.discountPercent}%
      </span>
    </div>
  );
}

/**
 * Detailed PILOT tier card for settings/profile
 */
export function PilotTierCard() {
  const { data: tierInfo, isLoading, error } = usePilotTier();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-sp-border bg-sp-surface2 p-4 animate-pulse">
        <div className="h-6 w-32 bg-sp-surface3 rounded mb-2" />
        <div className="h-4 w-24 bg-sp-surface3 rounded" />
      </div>
    );
  }

  if (error || !tierInfo) {
    return (
      <div className="rounded-xl border border-sp-border bg-sp-surface2 p-4">
        <div className="text-sm font-semibold text-sp-text">PILOT Token</div>
        <div className="text-micro text-sp-muted mt-1">
          Connect wallet to see your tier
        </div>
      </div>
    );
  }

  const display = getTierDisplay(tierInfo.tier);
  const balanceFormatted = formatPilotBalance(tierInfo.balance);

  return (
    <div className="rounded-xl border border-sp-border bg-sp-surface2 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{display.emoji || "🪙"}</span>
          <div>
            <div className="text-sm font-semibold text-sp-text">
              {tierInfo.tier === "none" ? "PILOT Token" : `${display.name} Tier`}
            </div>
            <div className="text-micro text-sp-muted">
              {balanceFormatted} PILOT
            </div>
          </div>
        </div>
        
        {tierInfo.discountPercent > 0 && (
          <Pill tone="accent" size="sm">
            -{tierInfo.discountPercent}% fees
          </Pill>
        )}
      </div>

      {/* Progress to next tier */}
      {tierInfo.nextTier && (
        <div className="mt-4 pt-3 border-t border-sp-border">
          <div className="flex items-center justify-between text-micro">
            <span className="text-sp-muted">Next tier: {tierInfo.nextTier.name}</span>
            <span className="text-sp-accent font-medium">
              -{tierInfo.nextTier.discountPercent}% fees
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-sp-surface3 rounded-full overflow-hidden">
            <div 
              className="h-full bg-sp-accent rounded-full transition-[width,background-color,opacity] duration-base ease-standard"
              style={{
                width: `${Math.min(100, (Number(BigInt(tierInfo.balance)) / Number(BigInt(tierInfo.nextTier.requiredBalance))) * 100)}%`
              }}
            />
          </div>
          
          <div className="mt-1 text-micro text-sp-muted">
            Need {formatPilotBalance(tierInfo.nextTier.additionalNeeded)} more PILOT
          </div>
        </div>
      )}

      {/* No holdings message */}
      {tierInfo.tier === "none" && !tierInfo.nextTier && (
        <div className="mt-3 text-micro text-sp-muted">
          Hold PILOT tokens to get up to 20% off swap fees
        </div>
      )}
    </div>
  );
}

/**
 * Fee breakdown display for swap interface
 */
export function FeeBreakdown({ 
  swapValueUsd, 
  feeBps,
  discountPercent,
  pilotTier,
}: { 
  swapValueUsd: number;
  feeBps: number;
  discountPercent: number;
  pilotTier: string;
}) {
  const feeAmountUsd = (swapValueUsd * feeBps) / 10_000;
  const display = getTierDisplay(pilotTier as any);

  if (feeBps === 0) {
    return (
      <div className="flex items-center justify-between text-micro">
        <span className="text-sp-muted">Platform fee</span>
        <span className="text-sp-ok font-medium">Free</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-micro">
        <span className="text-sp-muted">Platform fee</span>
        <div className="flex items-center gap-2">
          {discountPercent > 0 && (
            <span className="text-sp-muted line-through">
              {(10 / 100).toFixed(2)}%
            </span>
          )}
          <span className="text-sp-text font-medium">
            {(feeBps / 100).toFixed(2)}%
          </span>
        </div>
      </div>
      
      {discountPercent > 0 && (
        <div className="flex items-center justify-between text-micro">
          <span className="text-sp-muted">
            {display.emoji} {display.name} discount
          </span>
          <span className="text-sp-ok font-medium">-{discountPercent}%</span>
        </div>
      )}
      
      <div className="flex items-center justify-between text-micro pt-1 border-t border-sp-border">
        <span className="text-sp-muted">Fee amount</span>
        <span className="text-sp-text font-medium">
          ~${feeAmountUsd.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
