import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function CardDark({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(
      "rounded-2xl border border-white/8 bg-sp-surface/70 shadow-2xl backdrop-blur-xl",
      "transition-[transform,background-color,border-color,box-shadow,opacity,backdrop-filter] duration-base ease-standard",
      className
    )}>
      {children}
    </div>
  );
}

export function CardLight({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(
      "rounded-2xl border border-sp-lightBorder bg-sp-lightSurface shadow-xl",
      "transition-[transform,background-color,border-color,box-shadow,opacity] duration-base ease-standard",
      className
    )}>
      {children}
    </div>
  );
}

/* Premium Glass Card with gradient border */
export function GlassCard({ 
  children, 
  className,
  glow = false,
}: { 
  children: ReactNode; 
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={cn(
      "relative rounded-2xl border border-white/10 bg-gradient-to-b from-sp-surface/80 to-sp-surface2/80 backdrop-blur-xl",
      "transition-[transform,background-color,border-color,box-shadow,opacity,backdrop-filter] duration-base ease-standard",
      glow && "shadow-glow",
      className
    )}>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative">{children}</div>
    </div>
  );
}

/* Elevated Card for important content */
export function ElevatedCard({ 
  children, 
  className,
  highlight = false,
}: { 
  children: ReactNode; 
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border bg-sp-surface2 shadow-xl transition-[transform,background-color,border-color,box-shadow,opacity] duration-base ease-standard",
      highlight 
        ? "border-sp-accent/30 shadow-glow" 
        : "border-sp-border/50 hover:border-sp-borderHover",
      className
    )}>
      {children}
    </div>
  );
}

export function AppShellDark({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-dark text-sp-text">
      <div className="mx-auto max-w-6xl px-5 py-6 md:px-6">{children}</div>
    </div>
  );
}

export function AppShellLight({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-light text-sp-lightText">
      <div className="mx-auto max-w-6xl px-5 py-6 md:px-6">{children}</div>
    </div>
  );
}
