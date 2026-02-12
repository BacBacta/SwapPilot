"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/* ========================================
   SUCCESS CELEBRATION - Confetti & feedback
   ======================================== */
interface SuccessCelebrationProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Amount received */
  amount?: string;
  /** Token symbol */
  token?: string;
  /** Auto-close delay in ms. Default: 3000 */
  autoCloseDelay?: number;
}

export function SuccessCelebration({
  open,
  onClose,
  title = "Swap Successful!",
  subtitle = "Your transaction has been confirmed",
  amount,
  token,
  autoCloseDelay = 3000,
}: SuccessCelebrationProps) {
  const [mounted, setMounted] = useState(false);
  const [confetti, setConfetti] = useState<{ id: number; x: number; color: string; delay: number }[]>([]);

  // Mount check
  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate confetti on open
  useEffect(() => {
    if (open) {
      const colors = ["#00E676", "#00B8D4", "#FFD740", "#FF6E40", "#E040FB", "#40C4FF"];
      const particles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)] ?? "#00E676",
        delay: Math.random() * 0.5,
      }));
      setConfetti(particles);

      // Haptic feedback
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([50, 50, 100]);
      }
    }
  }, [open]);

  // Auto-close
  useEffect(() => {
    if (open && autoCloseDelay > 0) {
      const timer = setTimeout(onClose, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [open, autoCloseDelay, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fadeIn motion-reduce:animate-none" />

      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((particle) => (
          <div
            key={particle.id}
            className="confetti-particle absolute motion-reduce:hidden"
            style={{
              left: `${particle.x}%`,
              backgroundColor: particle.color,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 mx-4 max-w-sm animate-success-pop motion-reduce:animate-none rounded-3xl border border-sp-accent/30 bg-sp-surface p-8 text-center shadow-2xl transition-[transform,opacity,box-shadow,border-color] duration-base ease-standard">
        {/* Success icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-sp-accent/20 to-sp-accent/5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sp-accent to-sp-accent2">
            <CheckIcon className="h-8 w-8 text-white" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-h1 font-bold text-sp-text">{title}</h2>
        <p className="mt-2 text-caption text-sp-muted">{subtitle}</p>

        {/* Amount */}
        {amount && token && (
          <div className="mt-6 rounded-2xl border border-sp-accent/20 bg-sp-accent/5 p-4">
            <div className="text-micro text-sp-muted">You received</div>
            <div className="mt-1 text-h1 font-bold text-sp-accent">
              +{amount} {token}
            </div>
          </div>
        )}

        {/* Dismiss hint */}
        <p className="mt-6 text-micro text-sp-muted2">
          Tap anywhere to dismiss
        </p>
      </div>
    </div>,
    document.body
  );
}

/* ========================================
   INLINE SUCCESS TOAST - Less intrusive
   ======================================== */
interface SuccessToastProps {
  message: string;
  txHash?: string;
  onViewTx?: () => void;
}

export function SuccessToast({ message, txHash, onViewTx }: SuccessToastProps) {
  return (
    <div className="flex items-center gap-3 animate-slideIn motion-reduce:animate-none transition-[transform,opacity] duration-base ease-standard">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sp-ok/20">
        <CheckIcon className="h-5 w-5 text-sp-ok" />
      </div>
      <div className="flex-1">
        <div className="text-body font-semibold text-sp-text">{message}</div>
        {txHash && (
          <button
            onClick={onViewTx}
            className="mt-0.5 text-caption text-sp-accent hover:underline"
          >
            View on explorer →
          </button>
        )}
      </div>
    </div>
  );
}

/* ========================================
   HOOK - Success celebration state
   ======================================== */
interface CelebrationData {
  amount?: string;
  token?: string;
  txHash?: string;
}

export function useSuccessCelebration() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<CelebrationData>({});

  const celebrate = useCallback((celebrationData: CelebrationData) => {
    setData(celebrationData);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    data,
    celebrate,
    close,
  };
}

/* ========================================
   ICONS
   ======================================== */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
