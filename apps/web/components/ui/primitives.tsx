import type { ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/* ========================================
   PILL - Status badges & tags
   ======================================== */
export function Pill({
  children,
  tone = "neutral",
  size = "sm",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad" | "accent" | "blue";
  size?: "sm" | "md";
}) {
  const toneStyles = {
    ok: "border-sp-ok/30 bg-sp-ok/12 text-sp-ok",
    warn: "border-sp-warn/30 bg-sp-warn/12 text-sp-warn",
    bad: "border-sp-bad/30 bg-sp-bad/12 text-sp-bad",
    accent: "border-sp-accent/35 bg-sp-accent/15 text-sp-accent",
    blue: "border-sp-blue/30 bg-sp-blue/12 text-sp-blue",
    neutral: "border-sp-border bg-white/5 text-sp-muted",
  };
  
  const sizeStyles = {
    sm: "px-2.5 py-1 text-micro",
    md: "px-3 py-1.5 text-caption",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold transition-colors",
        toneStyles[tone],
        sizeStyles[size]
      )}
    >
      {children}
    </span>
  );
}

/* ========================================
   BUTTON - Primary actions
   ======================================== */
export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "soft";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const baseStyles = "inline-flex items-center justify-center font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantStyles = {
    primary: "bg-sp-accent text-black hover:bg-sp-accentHover hover:shadow-glow active:scale-[0.98]",
    secondary: "bg-sp-blue text-white hover:brightness-110 active:scale-[0.98]",
    soft: "border border-sp-border bg-sp-surface2 text-sp-text hover:bg-sp-surface3 hover:border-sp-borderHover",
    ghost: "border border-sp-border bg-transparent text-sp-text hover:bg-white/5",
  };

  const sizeStyles = {
    sm: "h-8 px-3 text-micro rounded-lg gap-1.5",
    md: "h-10 px-4 text-caption rounded-xl gap-2",
    lg: "h-12 px-6 text-body rounded-xl gap-2",
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], props.className)}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

/* ========================================
   SPINNER - Loading indicator
   ======================================== */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ========================================
   DIVIDER
   ======================================== */
export function Divider() {
  return <div className="h-px w-full bg-sp-border" />;
}

/* ========================================
   SKELETON - Loading placeholder with shimmer
   ======================================== */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-lg bg-gradient-to-r from-sp-surface2 via-sp-surface3 to-sp-surface2 bg-[length:200%_100%]",
        className
      )}
    />
  );
}

/* ========================================
   TOGGLE - On/off switch
   ======================================== */
export function Toggle({ on, onChange }: { on: boolean; onChange?: (value: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange?.(!on)}
      className={cn(
        "relative h-6 w-11 rounded-full border transition-all duration-200",
        on ? "border-sp-ok/40 bg-sp-ok/20" : "border-sp-border bg-sp-surface2 hover:border-sp-borderHover"
      )}
    >
      <div
        className={cn(
          "absolute top-1 h-4 w-4 rounded-full transition-all duration-200",
          on ? "left-6 bg-sp-ok shadow-glowOk" : "left-1 bg-sp-muted"
        )}
      />
    </button>
  );
}

/* ========================================
   PROGRESS - Progress bar
   ======================================== */
export function Progress({ value, tone = "ok" }: { value: number; tone?: "ok" | "accent" | "blue" }) {
  const toneStyles = {
    ok: "bg-sp-ok",
    accent: "bg-sp-accent",
    blue: "bg-sp-blue",
  };
  
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-sp-surface3">
      <div
        className={cn("h-full rounded-full transition-all duration-300", toneStyles[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ========================================
   ICON BUTTON - Circular icon actions
   ======================================== */
export function IconButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl border border-sp-border bg-sp-surface2 text-sp-muted transition-all hover:border-sp-borderHover hover:bg-sp-surface3 hover:text-sp-text active:scale-95",
        className
      )}
    >
      {children}
    </button>
  );
}

/* ========================================
   BADGE - Compact status indicator
   ======================================== */
export function Badge({
  children,
  dot,
  tone = "neutral",
}: {
  children: ReactNode;
  dot?: boolean;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const dotColors = {
    ok: "bg-sp-ok",
    warn: "bg-sp-warn",
    bad: "bg-sp-bad",
    neutral: "bg-sp-muted",
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-micro font-medium text-sp-muted">
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[tone])} />}
      {children}
    </span>
  );
}
