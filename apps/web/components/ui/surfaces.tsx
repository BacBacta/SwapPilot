import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function CardDark({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-sp-border bg-sp-surface/70 shadow-softDark backdrop-blur", className)}>
      {children}
    </div>
  );
}

export function CardLight({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-sp-lightBorder bg-sp-lightSurface shadow-soft", className)}>
      {children}
    </div>
  );
}

export function AppShellDark({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-dark text-sp-text">
      <div className="mx-auto max-w-6xl px-6 py-6">{children}</div>
    </div>
  );
}

export function AppShellLight({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-light text-sp-lightText">
      <div className="mx-auto max-w-6xl px-6 py-6">{children}</div>
    </div>
  );
}
