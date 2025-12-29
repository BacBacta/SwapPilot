"use client";

import { cn } from "@/lib/cn";

/* ========================================
   ERROR TYPES
   ======================================== */

export type ErrorType = 
  | "network" 
  | "timeout" 
  | "api" 
  | "validation" 
  | "not_found" 
  | "rate_limit"
  | "unknown";

export interface ApiError {
  type: ErrorType;
  message: string;
  statusCode?: number;
  retryable: boolean;
}

export function parseError(error: Error | unknown): ApiError {
  if (!(error instanceof Error)) {
    return {
      type: "unknown",
      message: "An unknown error occurred",
      retryable: true,
    };
  }

  const message = error.message.toLowerCase();

  // Network errors
  if (message.includes("network") || message.includes("fetch")) {
    return {
      type: "network",
      message: "Unable to connect to the server. Check your internet connection.",
      retryable: true,
    };
  }

  // Timeout
  if (message.includes("timeout") || message.includes("aborted")) {
    return {
      type: "timeout",
      message: "Request timed out. Please try again.",
      retryable: true,
    };
  }

  // Rate limiting
  if (message.includes("429") || message.includes("rate limit")) {
    return {
      type: "rate_limit",
      message: "Too many requests. Please wait a moment.",
      statusCode: 429,
      retryable: true,
    };
  }

  // Not found
  if (message.includes("404") || message.includes("not found")) {
    return {
      type: "not_found",
      message: "The requested resource was not found.",
      statusCode: 404,
      retryable: false,
    };
  }

  // API errors with status codes
  const statusMatch = message.match(/api error (\d+)/i);
  if (statusMatch && statusMatch[1]) {
    const statusCode = parseInt(statusMatch[1], 10);
    return {
      type: "api",
      message: `Server error (${statusCode}). Please try again later.`,
      statusCode,
      retryable: statusCode >= 500,
    };
  }

  // Default
  return {
    type: "unknown",
    message: error.message || "An error occurred",
    retryable: true,
  };
}

/* ========================================
   ERROR DISPLAY COMPONENT
   ======================================== */

interface ErrorDisplayProps {
  error: Error | ApiError | null;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function ErrorDisplay({ error, onRetry, className, compact = false }: ErrorDisplayProps) {
  if (!error) return null;

  const apiError = error instanceof Error ? parseError(error) : error;

  const icons: Record<ErrorType, string> = {
    network: "🌐",
    timeout: "⏱️",
    api: "⚠️",
    validation: "📝",
    not_found: "🔍",
    rate_limit: "🚫",
    unknown: "❌",
  };

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-xl bg-sp-bad/10 px-3 py-2 text-caption text-sp-bad",
        className
      )}>
        <span>{icons[apiError.type]}</span>
        <span className="flex-1">{apiError.message}</span>
        {apiError.retryable && onRetry && (
          <button
            onClick={onRetry}
            className="font-medium underline hover:no-underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-2xl border border-sp-bad/30 bg-sp-bad/5 p-6 text-center",
      className
    )}>
      <div className="mb-3 text-4xl">{icons[apiError.type]}</div>
      <h3 className="mb-2 text-h2 font-semibold text-sp-text">
        {apiError.type === "network" && "Connection Error"}
        {apiError.type === "timeout" && "Request Timeout"}
        {apiError.type === "api" && "Server Error"}
        {apiError.type === "rate_limit" && "Too Many Requests"}
        {apiError.type === "not_found" && "Not Found"}
        {apiError.type === "validation" && "Invalid Input"}
        {apiError.type === "unknown" && "Error"}
      </h3>
      <p className="mb-4 text-body text-sp-muted">{apiError.message}</p>
      {apiError.retryable && onRetry && (
        <button
          onClick={onRetry}
          className="rounded-xl bg-sp-accent px-6 py-2.5 text-body font-semibold text-black transition hover:bg-sp-accentHover"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

/* ========================================
   INLINE ERROR MESSAGE
   ======================================== */

interface ErrorMessageProps {
  message: string;
  className?: string;
}

export function ErrorMessage({ message, className }: ErrorMessageProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 text-caption text-sp-bad",
      className
    )}>
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <span>{message}</span>
    </div>
  );
}

/* ========================================
   LOADING SPINNER
   ======================================== */

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <svg
      className={cn("animate-spin text-sp-accent", sizeClasses[size], className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/* ========================================
   EMPTY STATE
   ======================================== */

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon = "📭", title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      "rounded-2xl border border-sp-border bg-sp-surface p-8 text-center",
      className
    )}>
      <div className="mb-3 text-4xl">{icon}</div>
      <h3 className="mb-2 text-h2 font-semibold text-sp-text">{title}</h3>
      {description && (
        <p className="mb-4 text-body text-sp-muted">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-xl bg-sp-surface2 px-6 py-2.5 text-body font-medium text-sp-text transition hover:bg-sp-surface3"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
