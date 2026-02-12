"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/* ========================================
   BOTTOM SHEET - Native mobile feel
   ======================================== */
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /** Height snap points as percentage (0-100). Default: [50, 90] */
  snapPoints?: number[];
  /** Initial snap point index. Default: 1 (90%) */
  initialSnap?: number;
  /** Show drag handle. Default: true */
  showHandle?: boolean;
  /** Allow closing by dragging down. Default: true */
  dismissible?: boolean;
  /** Full height on desktop. Default: false */
  fullHeightDesktop?: boolean;
  className?: string;
}

export function BottomSheet({
  open,
  onClose,
  children,
  title,
  snapPoints = [50, 90],
  initialSnap = 1,
  showHandle = true,
  dismissible = true,
  fullHeightDesktop = false,
  className,
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [currentSnap, setCurrentSnap] = useState(initialSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset snap on open
  useEffect(() => {
    if (open) {
      setCurrentSnap(initialSnap);
      setDragOffset(0);
    }
  }, [open, initialSnap]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose, dismissible]);

  // Haptic feedback helper
  const haptic = useCallback((type: "light" | "medium" | "heavy" = "light") => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      const durations = { light: 10, medium: 25, heavy: 50 };
      navigator.vibrate(durations[type]);
    }
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartHeight.current = snapPoints[currentSnap] ?? 90;
  }, [currentSnap, snapPoints]);

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    const delta = clientY - dragStartY.current;
    const deltaPercent = (delta / window.innerHeight) * 100;
    setDragOffset(deltaPercent);
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const currentHeight = (snapPoints[currentSnap] ?? 90) - dragOffset;
    
    // Find closest snap point
    let closestSnap = 0;
    let minDiff = Infinity;
    
    // Check if should dismiss
    if (dismissible && currentHeight < 20) {
      haptic("medium");
      onClose();
      setDragOffset(0);
      return;
    }

    for (let index = 0; index < snapPoints.length; index++) {
      const snap = snapPoints[index]!;
      const diff = Math.abs(snap - currentHeight);
      if (diff < minDiff) {
        minDiff = diff;
        closestSnap = index;
      }
    }

    if (closestSnap !== currentSnap) {
      haptic("light");
    }
    
    setCurrentSnap(closestSnap);
    setDragOffset(0);
  }, [isDragging, currentSnap, snapPoints, dragOffset, dismissible, onClose, haptic]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) handleDragStart(touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) handleDragMove(touch.clientY);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Mouse handlers (for desktop testing)
  const handleMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientY);
    document.addEventListener("mousemove", handleMouseMoveDoc);
    document.addEventListener("mouseup", handleMouseUpDoc);
  };

  const handleMouseMoveDoc = useCallback((e: MouseEvent) => {
    handleDragMove(e.clientY);
  }, [handleDragMove]);

  const handleMouseUpDoc = useCallback(() => {
    handleDragEnd();
    document.removeEventListener("mousemove", handleMouseMoveDoc);
    document.removeEventListener("mouseup", handleMouseUpDoc);
  }, [handleDragEnd, handleMouseMoveDoc]);

  if (!mounted) return null;

  const sheetHeight = Math.max(0, (snapPoints[currentSnap] ?? 90) - dragOffset);

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity duration-base ease-standard",
        open ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-base ease-standard",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={dismissible ? onClose : undefined}
        style={{
          opacity: open ? Math.min(1, sheetHeight / 50) * 0.6 : 0,
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 flex flex-col rounded-t-3xl border-t border-white/10 bg-sp-surface shadow-2xl transition-transform",
          isDragging ? "duration-0" : "duration-base ease-standard",
          !open && "translate-y-full",
          fullHeightDesktop && "md:left-auto md:right-4 md:bottom-4 md:top-4 md:w-[420px] md:rounded-2xl md:border",
          className
        )}
        style={{
          height: `${sheetHeight}vh`,
          maxHeight: "95vh",
          transform: open ? `translateY(0)` : `translateY(100%)`,
        }}
      >
        {/* Drag Handle */}
        {showHandle && (
          <div
            className="flex h-8 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
          >
            <div className="h-1.5 w-12 rounded-full bg-white/20" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 pb-4">
            <h2 className="text-h2 font-bold text-sp-text">{title}</h2>
            {dismissible && (
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-sp-muted transition-colors hover:bg-white/10 hover:text-sp-text active:scale-95"
              >
                <XIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ========================================
   BOTTOM SHEET HEADER - For custom headers
   ======================================== */
export function BottomSheetHeader({
  children,
  onClose,
  className,
}: {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center justify-between border-b border-white/10 px-5 pb-4", className)}>
      {children}
      {onClose && (
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-sp-muted transition-colors hover:bg-white/10 hover:text-sp-text active:scale-95"
        >
          <XIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

/* ========================================
   BOTTOM SHEET FOOTER - Sticky actions
   ======================================== */
export function BottomSheetFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      "shrink-0 border-t border-white/10 bg-sp-surface p-5 safe-bottom",
      className
    )}>
      {children}
    </div>
  );
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
