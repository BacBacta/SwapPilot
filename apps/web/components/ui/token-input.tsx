"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { TokenImage, TOKEN_ICONS } from "@/components/ui/token-image";

interface TokenInputProps {
  label: "From" | "To" | string;
  token?: string;
  tokenLogoURI?: string | undefined;
  balance?: string | undefined;
  value?: string;
  usdValue?: string;
  onChange?: (value: string) => void;
  onTokenClick?: () => void;
  onMaxClick?: () => void;
  readOnly?: boolean;
  loading?: boolean;
  error?: string | undefined;
  className?: string;
}

export function TokenInput({
  label,
  token = "ETH",
  tokenLogoURI,
  balance,
  value = "",
  usdValue,
  onChange,
  onTokenClick,
  onMaxClick,
  readOnly = false,
  loading = false,
  error,
  className,
}: TokenInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className={cn(
        "group relative rounded-2xl border bg-sp-surface2/80 p-5 transition-all duration-300",
        error
          ? "border-sp-bad/50 bg-sp-bad/5 animate-shake"
          : focused
            ? "border-sp-accent/50 shadow-glow bg-sp-surface2"
            : "border-sp-border/60 hover:border-sp-borderHover hover:bg-sp-surface2",
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-caption font-medium text-sp-muted uppercase tracking-wider">{label}</span>
        {balance && (
          <div className="flex items-center gap-2">
            <span className={cn("text-caption", error ? "text-sp-bad" : "text-sp-muted2")}>
              Balance: <span className="font-semibold text-sp-muted">{balance}</span>
            </span>
            {onMaxClick && !readOnly && (
              <button
                onClick={onMaxClick}
                className="min-h-[32px] rounded-lg bg-sp-accent/15 px-3 py-1 text-caption font-bold text-sp-accent transition-all duration-200 hover:bg-sp-accent/25 hover:scale-105 active:scale-95"
              >
                MAX
              </button>
            )}
          </div>
        )}
      </div>

      {/* Input row */}
      <div className="flex items-center gap-4">
        {/* Token selector button - 48px touch target */}
        <button
          onClick={onTokenClick}
          className="flex items-center gap-3 rounded-2xl border border-sp-border bg-sp-surface3/80 px-4 py-3 min-h-[56px] transition-all duration-200 hover:border-sp-borderHover hover:bg-sp-surface3 hover:scale-[1.02] active:scale-[0.98]"
        >
          <TokenImage symbol={token} src={tokenLogoURI} size="lg" />
          <span className="text-h2 font-bold text-sp-text">{token}</span>
          <ChevronDown className="h-5 w-5 text-sp-muted ml-1" />
        </button>

        {/* Input field */}
        <div className="flex-1 text-right">
          {loading ? (
            <div className="h-10 w-36 ml-auto animate-shimmer rounded-xl bg-gradient-to-r from-sp-surface2 via-sp-surface3 to-sp-surface2 bg-[length:200%_100%]" />
          ) : (
            <>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                readOnly={readOnly}
                className={cn(
                  "w-full bg-transparent text-right text-[28px] font-bold placeholder:text-sp-muted2/50 focus:outline-none transition-colors duration-200",
                  error ? "text-sp-bad" : "text-sp-text",
                  readOnly && "cursor-default"
                )}
              />
              {error ? (
                <div className="mt-2 text-caption font-medium text-sp-bad">{error}</div>
              ) : usdValue ? (
                <div className="mt-2 text-caption text-sp-muted">{usdValue}</div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Swap direction button - Enhanced with animation
export function SwapDirectionButton({ onClick }: { onClick?: () => void }) {
  return (
    <div className="relative z-10 -my-3 flex justify-center">
      <button
        onClick={onClick}
        className="group flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-sp-border bg-sp-surface shadow-xl transition-all duration-300 hover:border-sp-accent hover:shadow-glow hover:rotate-180 active:scale-90"
      >
        <svg
          className="h-6 w-6 text-sp-muted transition-colors duration-300 group-hover:text-sp-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      </button>
    </div>
  );
}

// Chevron icon
function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
