"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ========================================
   Types
   ======================================== */
export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string | undefined;
  duration?: number | undefined;
  action?: {
    label: string;
    onClick: () => void;
  } | undefined;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Toast>) => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  loading: (title: string, message?: string) => string;
}

/* ========================================
   Context
   ======================================== */
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

/* ========================================
   Provider
   ======================================== */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const duration = toast.duration ?? (toast.type === "loading" ? Infinity : 5000);

    setToasts((prev) => [...prev, { ...toast, id }]);

    if (duration !== Infinity) {
      setTimeout(() => removeToast(id), duration);
    }

    return id;
  }, [removeToast]);

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );

    // If updating to non-loading, schedule removal
    if (updates.type && updates.type !== "loading") {
      const duration = updates.duration ?? 5000;
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  const success = useCallback((title: string, message?: string) => {
    return addToast({ type: "success", title, message });
  }, [addToast]);

  const error = useCallback((title: string, message?: string) => {
    return addToast({ type: "error", title, message, duration: 8000 });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string) => {
    return addToast({ type: "warning", title, message });
  }, [addToast]);

  const info = useCallback((title: string, message?: string) => {
    return addToast({ type: "info", title, message });
  }, [addToast]);

  const loading = useCallback((title: string, message?: string) => {
    return addToast({ type: "loading", title, message });
  }, [addToast]);

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, updateToast, success, error, warning, info, loading }}
    >
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

/* ========================================
   Toast Container
   ======================================== */
function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 sm:bottom-6 sm:right-6">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => onRemove(toast.id)} />
      ))}
    </div>
  );
}

/* ========================================
   Toast Item
   ======================================== */
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const icons: Record<ToastType, ReactNode> = {
    success: <CheckIcon className="h-5 w-5" />,
    error: <XCircleIcon className="h-5 w-5" />,
    warning: <WarningIcon className="h-5 w-5" />,
    info: <InfoIcon className="h-5 w-5" />,
    loading: <SpinnerIcon className="h-5 w-5 animate-spin" />,
  };

  const styles: Record<ToastType, string> = {
    success: "border-sp-ok/30 bg-sp-ok/10 text-sp-ok",
    error: "border-sp-bad/30 bg-sp-bad/10 text-sp-bad",
    warning: "border-sp-warn/30 bg-sp-warn/10 text-sp-warn",
    info: "border-sp-blue/30 bg-sp-blue/10 text-sp-blue",
    loading: "border-sp-accent/30 bg-sp-accent/10 text-sp-accent",
  };

  return (
    <div
      className={cn(
        "animate-slideIn flex w-80 items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-sm",
        "bg-sp-surface/95",
        styles[toast.type]
      )}
      role="alert"
    >
      <div className="flex-shrink-0">{icons[toast.type]}</div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sp-text text-caption">{toast.title}</div>
        {toast.message && (
          <div className="mt-1 text-micro text-sp-muted line-clamp-2">{toast.message}</div>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="mt-2 text-micro font-semibold text-sp-accent hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {toast.type !== "loading" && (
        <button
          onClick={onRemove}
          className="flex-shrink-0 text-sp-muted hover:text-sp-text transition"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ========================================
   Icons
   ======================================== */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
