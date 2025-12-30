"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string | undefined;
  position?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ content, children, className, position = "bottom" }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full right-0 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div className="relative inline-flex">
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-help"
      >
        {children}
      </div>
      {isOpen && (
        <div
          ref={tooltipRef}
          className={cn(
            "absolute z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-sp-border bg-sp-surface p-3 shadow-xl",
            "animate-fadeIn backdrop-blur-sm",
            positionClasses[position],
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

/* ========================================
   INFO ICON WITH TOOLTIP
   ======================================== */
interface InfoTooltipProps {
  title: string;
  description: string;
  className?: string | undefined;
}

export function InfoTooltip({ title, description, className }: InfoTooltipProps) {
  return (
    <Tooltip
      content={
        <div>
          <div className="font-semibold text-sp-text">{title}</div>
          <div className="mt-1 text-micro text-sp-muted">{description}</div>
        </div>
      }
      className={className}
    >
      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-sp-surface2 text-[10px] text-sp-muted hover:bg-sp-surface3 hover:text-sp-text transition">
        ?
      </div>
    </Tooltip>
  );
}

/* ========================================
   MODE EXPLANATION BADGES
   ======================================== */
export function ModeExplanationBadge({ mode }: { mode: "BEQ" | "RAW" }) {
  const explanations = {
    BEQ: {
      title: "Best Executable Quote",
      description: "Recommends the provider with the best balance between tokens received and success probability. Considers revert risk, liquidity depth, and MEV protection.",
    },
    RAW: {
      title: "Raw Output",
      description: "Ranks providers purely by token output, without considering execution risk. Best for experienced traders familiar with the token.",
    },
  };

  const { title, description } = explanations[mode];

  return (
    <Tooltip
      content={
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span className={cn(
              "inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold uppercase tracking-wide",
              mode === "BEQ" ? "bg-sp-accent/20 text-sp-accent" : "bg-blue-500/20 text-blue-400"
            )}>
              {mode}
            </span>
            <span className="font-semibold text-sp-text">{title}</span>
          </div>
          <p className="mt-2 text-micro leading-relaxed text-sp-muted text-justify">
            {description}
          </p>
          {mode === "BEQ" && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-sp-ok/10 px-2 py-1 text-[10px] font-medium text-sp-ok">
                ✓ Revert Risk
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-sp-ok/10 px-2 py-1 text-[10px] font-medium text-sp-ok">
                ✓ Liquidity
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-sp-ok/10 px-2 py-1 text-[10px] font-medium text-sp-ok">
                ✓ MEV
              </span>
            </div>
          )}
          {mode === "RAW" && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-sp-warn/10 px-2 py-1 text-[10px] font-medium text-sp-warn">
                ⚠ No risk filter
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 text-[10px] font-medium text-blue-400">
                Max output
              </span>
            </div>
          )}
        </div>
      }
      position="bottom"
    >
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sp-surface2 text-[11px] font-medium text-sp-muted hover:bg-sp-accent/20 hover:text-sp-accent transition-all cursor-help">
        ?
      </div>
    </Tooltip>
  );
}
