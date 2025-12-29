"use client";

import { useState, useEffect, useCallback } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { SUPPORTED_CHAINS, getEnabledChains, getChainConfig, DEFAULT_CHAIN_ID, type ChainConfig } from "@/lib/chains";

/* ========================================
   CHAIN SELECTOR HOOK
   ======================================== */

interface UseChainSelectorReturn {
  currentChainId: number;
  currentChain: ChainConfig | undefined;
  enabledChains: ChainConfig[];
  switchToChain: (chainId: number) => Promise<void>;
  isSwitching: boolean;
  error: string | null;
}

export function useChainSelector(): UseChainSelectorReturn {
  const chainId = useChainId();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [error, setError] = useState<string | null>(null);

  const currentChain = getChainConfig(chainId ?? DEFAULT_CHAIN_ID);
  const enabledChains = getEnabledChains();

  const switchToChain = useCallback(
    async (newChainId: number) => {
      if (newChainId === chainId) return;
      
      setError(null);
      try {
        await switchChainAsync({ chainId: newChainId });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to switch chain";
        setError(message);
        console.error("Chain switch error:", err);
      }
    },
    [chainId, switchChainAsync]
  );

  return {
    currentChainId: chainId ?? DEFAULT_CHAIN_ID,
    currentChain,
    enabledChains,
    switchToChain,
    isSwitching: isPending,
    error,
  };
}

/* ========================================
   CHAIN SELECTOR COMPONENT
   ======================================== */
interface ChainSelectorProps {
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}

export function ChainSelector({ className = "", showLabel = true, compact = false }: ChainSelectorProps) {
  const { currentChain, enabledChains, switchToChain, isSwitching } = useChainSelector();
  const [isOpen, setIsOpen] = useState(false);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (isOpen && !(e.target as Element).closest(".chain-selector")) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [isOpen]);

  if (!currentChain) return null;

  return (
    <div className={`chain-selector relative ${className}`}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className={`
          flex items-center gap-2 rounded-xl border transition-all duration-200
          ${compact ? "px-2 py-1.5" : "px-3 py-2"}
          border-sp-border bg-sp-surface2 hover:border-sp-borderHover hover:bg-sp-surface3
          disabled:cursor-not-allowed disabled:opacity-50
        `}
      >
        {/* Chain icon */}
        <div
          className="h-5 w-5 rounded-full"
          style={{ backgroundColor: currentChain.color }}
        >
          <span className="flex h-full w-full items-center justify-center text-micro font-bold text-white">
            {currentChain.shortName.charAt(0)}
          </span>
        </div>

        {showLabel && !compact && (
          <span className="text-body font-medium text-sp-text">
            {currentChain.shortName}
          </span>
        )}

        {/* Chevron */}
        <svg
          className={`h-4 w-4 text-sp-muted transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-scaleIn rounded-xl border border-sp-border bg-sp-surface shadow-soft">
          <div className="p-2">
            <div className="mb-2 px-2 text-micro font-medium text-sp-muted">
              Select Network
            </div>
            {enabledChains.map((chain) => (
              <button
                key={chain.chain.id}
                onClick={() => {
                  switchToChain(chain.chain.id);
                  setIsOpen(false);
                }}
                disabled={isSwitching}
                className={`
                  flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150
                  ${chain.chain.id === currentChain.chain.id
                    ? "bg-sp-accent/10 text-sp-accent"
                    : "text-sp-text hover:bg-sp-surface2"
                  }
                  disabled:cursor-not-allowed disabled:opacity-50
                `}
              >
                {/* Chain icon */}
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: chain.color }}
                >
                  <span className="text-caption font-bold text-white">
                    {chain.shortName.charAt(0)}
                  </span>
                </div>

                {/* Chain info */}
                <div className="flex-1 text-left">
                  <div className="text-body font-medium">{chain.name}</div>
                  <div className="text-micro text-sp-muted">{chain.nativeCurrency}</div>
                </div>

                {/* Selected indicator */}
                {chain.chain.id === currentChain.chain.id && (
                  <svg
                    className="h-5 w-5 text-sp-accent"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Coming soon chains */}
          {SUPPORTED_CHAINS.filter((c) => !c.enabled).length > 0 && (
            <div className="border-t border-sp-border p-2">
              <div className="px-2 py-1 text-micro text-sp-muted2">Coming Soon</div>
              {SUPPORTED_CHAINS.filter((c) => !c.enabled).map((chain) => (
                <div
                  key={chain.chain.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 opacity-50"
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: chain.color }}
                  >
                    <span className="text-caption font-bold text-white">
                      {chain.shortName.charAt(0)}
                    </span>
                  </div>
                  <span className="text-body text-sp-muted">{chain.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
