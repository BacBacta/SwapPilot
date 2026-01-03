"use client";

import { useCallback, useMemo } from "react";
import { cn } from "@/lib/cn";
import { useTokenRegistry } from "@/lib/use-token-registry";
import type { RankedQuote } from "@swappilot/shared";

/* ========================================
   Route Step Component
   ======================================== */
function RouteStep({
  token,
  protocol,
  isFirst,
  isLast,
}: {
  token: string;
  protocol?: string;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Token icon */}
      <div
        className={cn(
          "relative grid h-9 w-9 place-items-center rounded-full border text-micro font-bold",
          isFirst
            ? "border-sp-accent/40 bg-sp-accent/20 text-sp-accent"
            : isLast
              ? "border-sp-ok/40 bg-sp-ok/20 text-sp-ok"
              : "border-sp-border bg-sp-surface3 text-sp-text"
        )}
      >
        {token.slice(0, 3)}
        {(isFirst || isLast) && (
          <div
            className={cn(
              "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-sp-surface",
              isFirst ? "bg-sp-accent" : "bg-sp-ok"
            )}
          />
        )}
      </div>

      {/* Token label */}
      <div className="hidden sm:block">
        <div className="text-micro font-semibold text-sp-text">{token}</div>
        {protocol && (
          <div className="text-[10px] text-sp-muted2">{protocol}</div>
        )}
      </div>
    </div>
  );
}

/* ========================================
   Arrow Connector
   ======================================== */
function RouteArrow({ percentage }: { percentage?: number | undefined }) {
  return (
    <div className="flex flex-1 items-center px-1">
      <div className="relative h-px flex-1 bg-gradient-to-r from-sp-accent/50 via-sp-border to-sp-ok/50">
        {/* Animated dot */}
        <div className="absolute -top-[3px] left-0 h-[7px] w-[7px] animate-pulse rounded-full bg-sp-accent shadow-glow" />
        
        {/* Percentage badge */}
        {percentage !== undefined && (
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-sp-surface3 px-1.5 py-0.5 text-[9px] font-medium text-sp-muted">
            {percentage}%
          </div>
        )}
      </div>
      <svg className="h-3 w-3 -ml-1 text-sp-ok/50" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}

/* ========================================
   Protocol Badge
   ======================================== */
function ProtocolBadge({ name, share }: { name: string; share?: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-sp-border bg-sp-surface2 px-2 py-1">
      <div className="h-4 w-4 rounded bg-sp-surface3 text-center text-[8px] font-bold leading-4 text-sp-muted">
        {name.slice(0, 2).toUpperCase()}
      </div>
      <span className="text-micro font-medium text-sp-text">{name}</span>
      {share !== undefined && (
        <span className="text-[10px] text-sp-muted">{share}%</span>
      )}
    </div>
  );
}

/* ========================================
   Main Route Visualization Component
   ======================================== */
export function RouteVisualization({
  quote,
  fromToken,
  toToken,
  className,
}: {
  quote?: RankedQuote | null;
  fromToken: string;
  toToken: string;
  className?: string;
}) {
  const { resolveToken } = useTokenRegistry();

  // Resolve token address to symbol
  const getTokenSymbol = useCallback((tokenOrAddress: string): string => {
    const resolved = resolveToken(tokenOrAddress);
    return resolved?.symbol ?? tokenOrAddress.slice(0, 6);
  }, [resolveToken]);

  const fromSymbol = getTokenSymbol(fromToken);
  const toSymbol = getTokenSymbol(toToken);

  // Parse route from quote if available
  const routeData = useMemo(() => {
    if (!quote) {
      // Default single hop route
      return {
        steps: [fromSymbol, toSymbol],
        protocols: ["Direct"],
        percentages: [100],
      };
    }

    // Check if quote has route info in raw data
    const routeSteps = quote.raw.route;

    if (routeSteps && routeSteps.length > 2) {
      // Multi-hop route - resolve all token addresses to symbols
      const resolvedSteps = routeSteps.map((step) => getTokenSymbol(step));
      return {
        steps: resolvedSteps,
        protocols: [quote.providerId],
        percentages: [100],
      };
    }

    // Single route through provider
    return {
      steps: [fromSymbol, toSymbol],
      protocols: [quote.providerId],
      percentages: [100],
    };
  }, [quote, fromSymbol, toSymbol, getTokenSymbol]);

  const hasMultiplePaths = routeData.protocols.length > 1;

  return (
    <div className={cn("rounded-xl border border-sp-border bg-sp-surface2 p-4", className)}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RouteIcon className="h-4 w-4 text-sp-accent" />
          <span className="text-caption font-semibold text-sp-text">Route</span>
        </div>
        {hasMultiplePaths && (
          <span className="rounded bg-sp-accent/15 px-2 py-0.5 text-[10px] font-semibold text-sp-accent">
            SPLIT
          </span>
        )}
      </div>

      {/* Route visualization */}
      {hasMultiplePaths ? (
        // Multi-path visualization
        <div className="space-y-2">
          {routeData.protocols.map((protocol, idx) => (
            <div key={protocol} className="flex items-center gap-2">
              <RouteStep token={fromSymbol} isFirst />
              <RouteArrow percentage={routeData.percentages[idx]} />
              <ProtocolBadge name={protocol} />
              <RouteArrow />
              <RouteStep token={toSymbol} isLast />
            </div>
          ))}
        </div>
      ) : (
        // Single path visualization
        <div className="flex items-center justify-between gap-2">
          <RouteStep token={fromSymbol} isFirst />
          <RouteArrow />
          <ProtocolBadge name={routeData.protocols[0] ?? "Direct"} share={100} />
          <RouteArrow />
          <RouteStep token={toSymbol} isLast />
        </div>
      )}

      {/* Route stats */}
      {quote && (
        <div className="mt-3 flex items-center justify-between border-t border-sp-border pt-3">
          <div className="text-micro text-sp-muted">
            via <span className="font-medium text-sp-text">{quote.providerId}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-micro text-sp-muted">
              Gas: <span className="font-medium text-sp-text">~$0.36</span>
            </span>
            <span className="text-micro text-sp-muted">
              Time: <span className="font-medium text-sp-text">~12s</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================
   Compact Route Preview
   ======================================== */
export function RoutePreview({
  fromToken,
  toToken,
  provider,
  className,
}: {
  fromToken: string;
  toToken: string;
  provider?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 text-micro", className)}>
      <span className="font-medium text-sp-text">{fromToken}</span>
      <svg className="h-3 w-3 text-sp-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      {provider && (
        <>
          <span className="rounded bg-sp-surface3 px-1.5 py-0.5 text-[10px] text-sp-muted">
            {provider}
          </span>
          <svg className="h-3 w-3 text-sp-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </>
      )}
      <span className="font-medium text-sp-ok">{toToken}</span>
    </div>
  );
}

/* ========================================
   Icon
   ======================================== */
function RouteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  );
}
