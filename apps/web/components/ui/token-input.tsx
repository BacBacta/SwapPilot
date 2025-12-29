"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { TokenImage, TOKEN_ICONS } from "@/components/ui/token-image";

interface TokenInputProps {
  label: "From" | "To" | string;
  token?: string;
  balance?: string | undefined;
  value?: string;
  usdValue?: string;
  onChange?: (value: string) => void;
  onTokenClick?: () => void;
  onMaxClick?: () => void;
  readOnly?: boolean;
  loading?: boolean;
  className?: string;
}

export function TokenInput({
  label,
  token = "ETH",
  balance,
  value = "",
  usdValue,
  onChange,
  onTokenClick,
  onMaxClick,
  readOnly = false,
  loading = false,
  className,
}: TokenInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-sp-surface2 p-4 transition-all duration-200",
        focused
          ? "border-sp-borderActive shadow-glow"
          : "border-sp-border hover:border-sp-borderHover",
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-caption text-sp-muted">{label}</span>
        {balance && (
          <div className="flex items-center gap-2">
            <span className="text-micro text-sp-muted2">Balance: {balance}</span>
            {onMaxClick && !readOnly && (
              <button
                onClick={onMaxClick}
                className="rounded-md bg-sp-accent/15 px-2 py-0.5 text-micro font-bold text-sp-accent transition hover:bg-sp-accent/25"
              >
                MAX
              </button>
            )}
          </div>
        )}
      </div>

      {/* Input row */}
      <div className="mt-3 flex items-center gap-3">
        {/* Token selector button */}
        <button
          onClick={onTokenClick}
          className="flex items-center gap-2.5 rounded-xl border border-sp-border bg-sp-surface3 px-3 py-2.5 transition hover:border-sp-borderHover hover:bg-sp-surface2"
        >
          <TokenImage symbol={token} size="md" />
          <span className="text-body font-semibold text-sp-text">{token}</span>
          <ChevronDown className="h-4 w-4 text-sp-muted" />
        </button>

        {/* Input field */}
        <div className="flex-1 text-right">
          {loading ? (
            <div className="h-9 w-32 ml-auto animate-shimmer rounded-lg bg-gradient-to-r from-sp-surface2 via-sp-surface3 to-sp-surface2 bg-[length:200%_100%]" />
          ) : (
            <>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                readOnly={readOnly}
                className={cn(
                  "w-full bg-transparent text-right text-h1 font-bold text-sp-text placeholder:text-sp-muted2 focus:outline-none",
                  readOnly && "cursor-default"
                )}
              />
              {usdValue && (
                <div className="mt-1 text-caption text-sp-muted">{usdValue}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Swap direction button
export function SwapDirectionButton({ onClick }: { onClick?: () => void }) {
  return (
    <div className="relative z-10 -my-2 flex justify-center">
      <button
        onClick={onClick}
        className="group flex h-10 w-10 items-center justify-center rounded-xl border border-sp-border bg-sp-surface2 shadow-cardDark transition-all hover:border-sp-accent hover:shadow-glow active:scale-95"
      >
        <svg
          className="h-5 w-5 text-sp-muted transition group-hover:text-sp-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
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
