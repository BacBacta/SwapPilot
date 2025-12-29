"use client";

import { useMemo } from "react";
import { deepLinkBuilder } from "@swappilot/deeplinks";
import type { QuoteRequest } from "@swappilot/shared";

/* ========================================
   WALLET APP CONFIGURATION
   ======================================== */

export interface WalletApp {
  id: string;
  name: string;
  icon: string;
  color: string;
  deepLinkSupport: boolean;
  mobileOnly: boolean;
}

export const WALLET_APPS: WalletApp[] = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    color: "#E2761B",
    deepLinkSupport: true,
    mobileOnly: false,
  },
  {
    id: "trustwallet",
    name: "Trust Wallet",
    icon: "🛡️",
    color: "#3375BB",
    deepLinkSupport: true,
    mobileOnly: true,
  },
  {
    id: "binance-wallet",
    name: "Binance Wallet",
    icon: "💛",
    color: "#F3BA2F",
    deepLinkSupport: true,
    mobileOnly: false,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    icon: "🔵",
    color: "#0052FF",
    deepLinkSupport: true,
    mobileOnly: false,
  },
];

/* ========================================
   DEX APP CONFIGURATION
   ======================================== */

export interface DexApp {
  id: string;
  name: string;
  logo: string;
  color: string;
}

export const DEX_APPS: DexApp[] = [
  { id: "pancakeswap", name: "PancakeSwap", logo: "🥞", color: "#633001" },
  { id: "1inch", name: "1inch", logo: "🦄", color: "#1B314F" },
  { id: "kyberswap", name: "KyberSwap", logo: "💎", color: "#31CB9E" },
  { id: "okx-dex", name: "OKX DEX", logo: "⚫", color: "#000000" },
];

/* ========================================
   DEEPLINK HOOK
   ======================================== */

interface UseDeepLinksProps {
  quoteRequest: QuoteRequest | null;
  providerId?: string;
}

interface UseDeepLinksReturn {
  deepLink: string | null;
  fallbackUrl: string | null;
  confidence: number;
  openInApp: () => void;
  openInBrowser: () => void;
  canOpenInApp: boolean;
}

export function useDeepLinks({ quoteRequest, providerId = "pancakeswap" }: UseDeepLinksProps): UseDeepLinksReturn {
  const result = useMemo(() => {
    if (!quoteRequest) {
      return { url: null, fallbackUrl: null, confidence: 0 };
    }
    
    try {
      const link = deepLinkBuilder(providerId, quoteRequest);
      return link;
    } catch (error) {
      console.error("Failed to build deep link:", error);
      return { url: null, fallbackUrl: null, confidence: 0 };
    }
  }, [quoteRequest, providerId]);

  const isMobile = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const openInApp = () => {
    if (result.url) {
      // On mobile, try to open native app
      if (isMobile) {
        window.location.href = result.url;
      } else {
        window.open(result.url, "_blank");
      }
    }
  };

  const openInBrowser = () => {
    if (result.fallbackUrl) {
      window.open(result.fallbackUrl, "_blank");
    }
  };

  return {
    deepLink: result.url,
    fallbackUrl: result.fallbackUrl,
    confidence: result.confidence,
    openInApp,
    openInBrowser,
    canOpenInApp: !!result.url && isMobile,
  };
}

/* ========================================
   OPEN IN APP BUTTON
   ======================================== */

interface OpenInAppButtonProps {
  quoteRequest: QuoteRequest | null;
  providerId: string;
  providerName: string;
  className?: string;
}

export function OpenInAppButton({
  quoteRequest,
  providerId,
  providerName,
  className = "",
}: OpenInAppButtonProps) {
  const { deepLink, openInApp, confidence } = useDeepLinks({
    quoteRequest,
    providerId,
  });

  if (!deepLink) return null;

  const dex = DEX_APPS.find((d) => d.id === providerId);

  return (
    <button
      onClick={openInApp}
      className={`
        flex items-center gap-2 rounded-xl border border-sp-border bg-sp-surface2 
        px-4 py-2.5 text-body font-medium text-sp-text transition-all duration-200
        hover:border-sp-borderHover hover:bg-sp-surface3
        ${className}
      `}
    >
      <span className="text-lg">{dex?.logo ?? "🔗"}</span>
      <span>Open in {providerName}</span>
      {confidence < 0.7 && (
        <span className="rounded-full bg-sp-warn/20 px-1.5 py-0.5 text-micro text-sp-warn">
          Beta
        </span>
      )}
      <ExternalLinkIcon className="h-4 w-4 text-sp-muted" />
    </button>
  );
}

/* ========================================
   DEX LINKS LIST
   ======================================== */

interface DexLinksListProps {
  quoteRequest: QuoteRequest | null;
  selectedProvider?: string;
  onSelect?: (providerId: string) => void;
}

export function DexLinksList({ quoteRequest, selectedProvider, onSelect }: DexLinksListProps) {
  if (!quoteRequest) return null;

  return (
    <div className="space-y-2">
      <div className="text-micro font-medium text-sp-muted">
        Open in DEX app
      </div>
      <div className="grid grid-cols-2 gap-2">
        {DEX_APPS.map((dex) => {
          const result = deepLinkBuilder(dex.id, quoteRequest);
          const isSelected = selectedProvider === dex.id;

          return (
            <button
              key={dex.id}
              onClick={() => {
                if (onSelect) onSelect(dex.id);
                window.open(result.url, "_blank");
              }}
              className={`
                flex items-center gap-2 rounded-xl border px-3 py-2 transition-all duration-200
                ${isSelected
                  ? "border-sp-accent bg-sp-accent/10"
                  : "border-sp-border bg-sp-surface hover:border-sp-borderHover hover:bg-sp-surface2"
                }
              `}
            >
              <span className="text-lg">{dex.logo}</span>
              <div className="flex-1 text-left">
                <div className="text-body font-medium text-sp-text">{dex.name}</div>
                <div className="text-micro text-sp-muted">
                  {result.confidence >= 0.7 ? "Direct link" : "Web link"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ========================================
   ICONS
   ======================================== */

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}
