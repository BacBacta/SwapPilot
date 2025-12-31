"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/cn";
import { Button, Pill } from "@/components/ui/primitives";

/* ========================================
   Types
   ======================================== */
export type TransactionStatus = "pending" | "success" | "failed";

export interface Transaction {
  id: string;
  hash?: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  provider: string;
  status: TransactionStatus;
  timestamp: number;
  chainId: number;
  gasUsed?: string;
  error?: string;
}

/* ========================================
   Local Storage Hook
   ======================================== */
const STORAGE_KEY = "swappilot_tx_history";
const MAX_TRANSACTIONS = 50;

function getStoredTransactions(): Transaction[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveTransactions(transactions: Transaction[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions.slice(0, MAX_TRANSACTIONS)));
  } catch {
    // Storage full or unavailable
  }
}

export function useTransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setTransactions(getStoredTransactions());
    setIsLoaded(true);
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (isLoaded) {
      saveTransactions(transactions);
    }
  }, [transactions, isLoaded]);

  const addTransaction = useCallback((tx: Omit<Transaction, "id" | "timestamp">) => {
    const newTx: Transaction = {
      ...tx,
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
    };
    setTransactions((prev) => [newTx, ...prev]);
    return newTx.id;
  }, []);

  const updateTransaction = useCallback((id: string, updates: Partial<Transaction>) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, ...updates } : tx))
    );
  }, []);

  const clearHistory = useCallback(() => {
    setTransactions([]);
  }, []);

  const pendingCount = transactions.filter((tx) => tx.status === "pending").length;

  return {
    transactions,
    pendingCount,
    addTransaction,
    updateTransaction,
    clearHistory,
    isLoaded,
  };
}

/* ========================================
   Transaction History Panel
   ======================================== */
export function TransactionHistoryPanel({
  transactions,
  onClear,
  className,
}: {
  transactions: Transaction[];
  onClear?: (() => void) | undefined;
  className?: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (transactions.length === 0) {
    return (
      <div className={cn("rounded-xl border border-sp-border bg-sp-surface2 p-6 text-center", className)}>
        <HistoryIcon className="mx-auto h-10 w-10 text-sp-muted2" />
        <div className="mt-3 text-caption font-medium text-sp-text">No transactions yet</div>
        <div className="mt-1 text-micro text-sp-muted">
          Your swap history will appear here
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-sp-border bg-sp-surface2 overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-sp-border bg-sp-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <HistoryIcon className="h-4 w-4 text-sp-accent" />
          <span className="text-caption font-semibold text-sp-text">Transaction History</span>
          <Pill tone="neutral" size="sm">{transactions.length}</Pill>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="text-micro text-sp-muted hover:text-sp-bad transition"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Transactions list */}
      <div className="max-h-80 overflow-y-auto divide-y divide-sp-border">
        {transactions.map((tx) => (
          <TransactionRow
            key={tx.id}
            transaction={tx}
            expanded={expanded === tx.id}
            onToggle={() => setExpanded(expanded === tx.id ? null : tx.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ========================================
   Transaction Row
   ======================================== */
function TransactionRow({
  transaction,
  expanded,
  onToggle,
}: {
  transaction: Transaction;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusConfig: Record<TransactionStatus, { icon: React.ReactNode; color: string; label: string }> = {
    pending: {
      icon: <SpinnerIcon className="h-4 w-4 animate-spin" />,
      color: "text-sp-warn",
      label: "Pending",
    },
    success: {
      icon: <CheckIcon className="h-4 w-4" />,
      color: "text-sp-ok",
      label: "Success",
    },
    failed: {
      icon: <XCircleIcon className="h-4 w-4" />,
      color: "text-sp-bad",
      label: "Failed",
    },
  };

  const status = statusConfig[transaction.status];
  const timeAgo = formatTimeAgo(transaction.timestamp);

  return (
    <div className="bg-sp-surface2 hover:bg-sp-surface3 transition">
      <div className="flex w-full items-center gap-3 px-4 py-3">
        {/* Status icon */}
        <div className={cn("flex-shrink-0", status.color)}>
          {status.icon}
        </div>

        {/* Swap info */}
        <button
          onClick={onToggle}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-sp-text text-caption">
              {transaction.fromAmount} {transaction.fromToken}
            </span>
            <ArrowIcon className="h-3 w-3 text-sp-muted" />
            <span className="font-medium text-sp-ok text-caption">
              {transaction.toAmount} {transaction.toToken}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-micro text-sp-muted">
            <span>via {transaction.provider}</span>
            <span>•</span>
            <span>{timeAgo}</span>
          </div>
        </button>

        {/* Explorer link - always visible for completed transactions */}
        {transaction.hash && (
          <a
            href={getExplorerLink(transaction.chainId, transaction.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-lg bg-sp-accent/10 px-2 py-1 text-micro font-medium text-sp-accent hover:bg-sp-accent/20 transition"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLinkIcon className="h-3 w-3" />
            <span className="hidden sm:inline">View</span>
          </a>
        )}

        {/* Expand icon */}
        <button onClick={onToggle} className="p-1">
          <ChevronIcon
            className={cn(
              "h-4 w-4 text-sp-muted transition",
              expanded && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-sp-border bg-sp-surface px-4 py-3 space-y-3">
          <div className="flex items-center justify-between text-micro">
            <span className="text-sp-muted">Status</span>
            <span className={status.color}>{status.label}</span>
          </div>
          <div className="flex items-center justify-between text-micro">
            <span className="text-sp-muted">Chain</span>
            <span className="text-sp-text">{getChainName(transaction.chainId)}</span>
          </div>
          {transaction.hash && (
            <>
              <div className="flex items-center justify-between text-micro">
                <span className="text-sp-muted">Tx Hash</span>
                <span className="font-mono text-sp-text">
                  {transaction.hash.slice(0, 10)}...{transaction.hash.slice(-8)}
                </span>
              </div>
              <a
                href={getExplorerLink(transaction.chainId, transaction.hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-sp-accent py-2 text-caption font-semibold text-black hover:bg-sp-accent/90 transition"
              >
                <ExternalLinkIcon className="h-4 w-4" />
                View on {getExplorerName(transaction.chainId)}
              </a>
            </>
          )}
          {transaction.gasUsed && (
            <div className="flex items-center justify-between text-micro">
              <span className="text-sp-muted">Gas used</span>
              <span className="text-sp-text">{transaction.gasUsed}</span>
            </div>
          )}
          {transaction.error && (
            <div className="mt-2 rounded bg-sp-bad/10 px-2 py-1.5 text-micro text-sp-bad">
              {transaction.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ========================================
   Floating History Button
   ======================================== */
export function TransactionHistoryButton({
  pendingCount,
  onClick,
}: {
  pendingCount: number;
  onClick: () => void;
}) {
  return (
    <Button
      variant="soft"
      size="sm"
      onClick={onClick}
      className="relative"
    >
      <HistoryIcon className="h-4 w-4" />
      <span className="hidden sm:inline">History</span>
      {pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-sp-warn text-[10px] font-bold text-black animate-pulse">
          {pendingCount}
        </span>
      )}
    </Button>
  );
}

/* ========================================
   History Drawer
   ======================================== */
export function TransactionHistoryDrawer({
  open,
  onClose,
  transactions,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onClear?: () => void;
}) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md animate-slideInRight">
        <div className="flex h-full flex-col bg-sp-surface border-l border-sp-border">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-sp-border px-5 py-4">
            <div className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5 text-sp-accent" />
              <h2 className="text-h3 font-bold text-sp-text">Transaction History</h2>
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-sp-muted hover:bg-sp-surface3 hover:text-sp-text transition"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <TransactionHistoryPanel
              transactions={transactions}
              onClear={onClear}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ========================================
   Helpers
   ======================================== */
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

function getExplorerLink(chainId: number, hash: string): string {
  const explorers: Record<number, string> = {
    1: "https://etherscan.io/tx/",
    56: "https://bscscan.com/tx/",
    137: "https://polygonscan.com/tx/",
    42161: "https://arbiscan.io/tx/",
    10: "https://optimistic.etherscan.io/tx/",
    8453: "https://basescan.org/tx/",
  };
  return `${explorers[chainId] ?? "https://bscscan.com/tx/"}${hash}`;
}

function getExplorerName(chainId: number): string {
  const names: Record<number, string> = {
    1: "Etherscan",
    56: "BscScan",
    137: "Polygonscan",
    42161: "Arbiscan",
    10: "Optimism Explorer",
    8453: "Basescan",
  };
  return names[chainId] ?? "Explorer";
}

function getChainName(chainId: number): string {
  const names: Record<number, string> = {
    1: "Ethereum",
    56: "BNB Chain",
    137: "Polygon",
    42161: "Arbitrum",
    10: "Optimism",
    8453: "Base",
  };
  return names[chainId] ?? `Chain ${chainId}`;
}

/* ========================================
   Icons
   ======================================== */
function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
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

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}
