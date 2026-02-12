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
   BUTTON - Primary actions with 48px touch targets
   ======================================== */
export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "soft" | "destructive";
  size?: "sm" | "md" | "lg" | "xl";
  loading?: boolean;
}) {
  const baseStyles = "relative inline-flex items-center justify-center font-bold transition-[transform,background-color,color,border-color,box-shadow,opacity] duration-base ease-standard disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden";
  
  const variantStyles = {
    primary: "bg-gradient-to-r from-sp-accent to-sp-accent/90 text-black hover:shadow-glow active:scale-[0.97] active:shadow-none",
    secondary: "bg-gradient-to-r from-sp-blue to-sp-blue/90 text-white hover:brightness-110 active:scale-[0.97]",
    soft: "border border-sp-border bg-sp-surface2 text-sp-text hover:bg-sp-surface3 hover:border-sp-borderHover active:scale-[0.98]",
    ghost: "border border-sp-border bg-transparent text-sp-text hover:bg-white/5 active:scale-[0.98]",
    destructive: "bg-sp-bad/20 text-sp-bad border border-sp-bad/40 cursor-not-allowed",
  };

  // Minimum 48px touch target on mobile
  const sizeStyles = {
    sm: "min-h-[40px] px-4 text-caption rounded-xl gap-2",
    md: "min-h-[48px] px-5 text-body rounded-xl gap-2",
    lg: "min-h-[52px] px-6 text-body rounded-2xl gap-2.5",
    xl: "min-h-[56px] px-8 text-h2 rounded-2xl gap-3",
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], props.className)}
    >
      {/* Subtle shine effect on primary */}
      {variant === "primary" && !disabled && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-slow ease-emphasized" />
      )}
      {loading && <Spinner className="h-5 w-5" />}
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
   TOGGLE - On/off switch with 48px touch target
   ======================================== */
export function Toggle({ on, onChange }: { on: boolean; onChange?: (value: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange?.(!on)}
      className={cn(
        "relative h-8 w-14 rounded-full border transition-[background-color,border-color,box-shadow,opacity] duration-base ease-standard",
        on 
          ? "border-sp-ok/40 bg-sp-ok/20" 
          : "border-sp-border bg-sp-surface2 hover:border-sp-borderHover"
      )}
    >
      <div
        className={cn(
          "absolute top-1 h-6 w-6 rounded-full transition-[left,background-color,box-shadow,opacity] duration-base ease-standard",
          on 
            ? "left-7 bg-sp-ok shadow-glowOk" 
            : "left-1 bg-sp-muted"
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
        className={cn("h-full rounded-full transition-[width,background-color,opacity] duration-base ease-standard", toneStyles[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ========================================
   ICON BUTTON - Circular icon actions with 48px touch target
   ======================================== */
export function IconButton({
  children,
  className,
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "sm" | "md" | "lg";
}) {
  const sizeStyles = {
    sm: "h-10 w-10 rounded-xl",
    md: "h-12 w-12 rounded-xl",
    lg: "h-14 w-14 rounded-2xl",
  };

  return (
    <button
      {...props}
      className={cn(
        "flex items-center justify-center border border-sp-border bg-sp-surface2 text-sp-muted transition-[transform,background-color,color,border-color,box-shadow,opacity] duration-fast ease-standard hover:border-sp-borderHover hover:bg-sp-surface3 hover:text-sp-text active:scale-95",
        sizeStyles[size],
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
