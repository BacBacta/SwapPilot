"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { SearchInput } from "@/components/ui/inputs";
import { Button, Pill } from "@/components/ui/primitives";
import { TokenImage, TOKEN_ICONS } from "@/components/ui/token-image";
import { useTokenBalances } from "@/lib/use-token-balances";
import { useTokenPrices } from "@/lib/use-token-prices";
import { useFavorites, FavoriteButton } from "@/lib/use-favorites";
import { BottomSheet, BottomSheetFooter } from "@/components/ui/bottom-sheet";

import type { TokenInfo } from "@/lib/tokens";
import { isAddress, normalizeAddress } from "@/lib/tokens";
import { useTokenRegistry } from "@/components/providers/token-registry-provider";
import { resolveTokenMetadata } from "@/lib/api";

/* Detect mobile viewport */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

const RECENT_TOKENS = ["ETH", "BNB", "USDT", "USDC"];

/* ========================================
   TOKEN PICKER MODAL
   Uses BottomSheet on mobile, centered modal on desktop
   ======================================== */
interface TokenPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (token: string) => void;
  selectedToken?: string;
}

export function TokenPickerModal({ open, onClose, onSelect, selectedToken }: TokenPickerModalProps) {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const { tokens: registryTokens, loading: registryLoading, upsertCustomToken } = useTokenRegistry();

  // Hooks for balances, prices, and favorites
  const balancesQueryTokens = useMemo(() => {
    // Balance calls are expensive; only query for top visible results.
    const list = registryTokens;
    return list.slice(0, 30);
  }, [registryTokens]);

  const { balances, getBalanceFormatted, isConnected } = useTokenBalances(balancesQueryTokens);
  const { getPrice, formatUsd } = useTokenPrices();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();

  // Try to get token logo from Trust Wallet assets
  const getTrustWalletLogoUrl = useCallback((address: string): string => {
    // Trust Wallet uses checksummed addresses
    return `https://assets-cdn.trustwallet.com/blockchains/smartchain/assets/${address}/logo.png`;
  }, []);

  // Fetch token info from blockchain when address is entered
  const fetchTokenByAddress = useCallback(async (address: string) => {
    setIsLoadingToken(true);
    setTokenError(null);
    
    try {
      // Check if already exists
      const existing = registryTokens.find((t) => normalizeAddress(t.address) === normalizeAddress(address));
      if (existing) {
        setIsLoadingToken(false);
        return existing;
      }

      // Resolve via backend (RPC-based)
      const meta = await resolveTokenMetadata({ address: address as `0x${string}` });
      
      // Try to get logo from Trust Wallet assets
      const logoURI = getTrustWalletLogoUrl(meta.address);
      
      const newToken: TokenInfo = {
        symbol: (meta.symbol ?? address.slice(0, 6) + "...").toUpperCase(),
        name: meta.name ?? "Unknown Token",
        address: meta.address,
        decimals: meta.decimals ?? 18,
        logoURI, // Add logo URL for custom tokens
        isCustom: true,
      };

      upsertCustomToken(newToken);
      setIsLoadingToken(false);
      return newToken;
    } catch (err) {
      setIsLoadingToken(false);
      setTokenError("Failed to fetch token info. Check your connection.");
      return null;
    }
  }, [registryTokens, upsertCustomToken, getTrustWalletLogoUrl]);

  // Handle address search
  useEffect(() => {
    if (isAddress(search)) {
      fetchTokenByAddress(search);
    } else {
      setTokenError(null);
    }
  }, [search, fetchTokenByAddress]);

  // Enrich tokens with balances and USD values
  const enrichedTokens = useMemo(() => {
    return registryTokens.map((token) => {
      const balance = balances[token.address]?.balanceFormatted ?? "—";
      const price = getPrice(token.symbol);
      const balanceNum = parseFloat(balance);
      const usdValue = price && balanceNum > 0 
        ? `$${(balanceNum * price).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        : "—";
      return {
        ...token,
        balance: isConnected ? balance : "—",
        usd: isConnected ? usdValue : "—",
      };
    });
  }, [registryTokens, balances, getPrice, isConnected]);

  // Filter tokens
  const filteredTokens = useMemo(() => {
    const searchLower = search.toLowerCase();
    const filtered = enrichedTokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(searchLower) ||
        t.name.toLowerCase().includes(searchLower) ||
        (t.address && t.address.toLowerCase().includes(searchLower))
    );
    // Sort: favorites first, then by symbol
    return filtered.sort((a, b) => {
      const aFav = isFavorite(a.symbol);
      const bFav = isFavorite(b.symbol);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [enrichedTokens, search, isFavorite]);

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Reset search on open
  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  if (!mounted || !open) return null;

  // Shared content for both mobile bottom sheet and desktop modal
  const tokenListContent = (
    <>
      {/* Search */}
      <div className="border-b border-sp-lightBorder px-5 py-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, symbol, or paste address..."
          autoFocus
          className="border-sp-lightBorder bg-sp-lightSurface2 text-sp-lightText placeholder:text-sp-lightMuted"
        />
        {isAddress(search) && (
          <div className="mt-2 flex items-center gap-2 text-micro">
            {isLoadingToken ? (
              <span className="flex items-center gap-2 text-sp-lightMuted">
                <LoadingSpinner className="h-3 w-3" />
                Looking up token...
              </span>
            ) : tokenError ? (
              <span className="text-amber-600">{tokenError}</span>
            ) : (
              <span className="text-sp-ok">✓ Token address detected</span>
            )}
          </div>
        )}
      </div>

      {/* Recent tokens */}
      <div className="border-b border-sp-lightBorder px-5 py-3">
        <div className="text-micro font-medium text-sp-lightMuted">Recent</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {RECENT_TOKENS.map((symbol) => {
            const token = registryTokens.find((t) => t.symbol === symbol);
            if (!token) return null;
            return (
              <button
                key={symbol}
                onClick={() => onSelect(symbol)}
                className={cn(
                  "flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 transition active:scale-95",
                  selectedToken === symbol
                    ? "border-sp-accent bg-sp-accent/10"
                    : "border-sp-lightBorder bg-sp-lightSurface hover:border-sp-lightBorderHover hover:bg-sp-lightSurface2"
                )}
              >
                <TokenImage symbol={symbol} src={token.logoURI} size="sm" />
                <span className="text-caption font-semibold text-sp-lightText">{symbol}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Favorites */}
      {favorites.length > 0 && (
        <div className="border-b border-sp-lightBorder px-5 py-3">
          <div className="flex items-center gap-2 text-micro font-medium text-sp-accent">
            <StarIcon className="h-3.5 w-3.5" />
            Favorites
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {favorites.map((symbol) => {
              const token = registryTokens.find((t) => t.symbol === symbol);
              if (!token) return null;
              return (
                <button
                  key={symbol}
                  onClick={() => onSelect(symbol)}
                  className={cn(
                    "flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 transition active:scale-95",
                    selectedToken === symbol
                      ? "border-sp-accent bg-sp-accent/10"
                      : "border-sp-accent/30 bg-sp-accent/5 hover:border-sp-accent hover:bg-sp-accent/10"
                  )}
                >
                  <TokenImage symbol={symbol} src={token.logoURI} size="sm" />
                  <span className="text-caption font-semibold text-sp-lightText">{symbol}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Token list */}
      <div className="flex-1 overflow-y-auto p-2">
        {registryLoading ? (
          <div className="flex items-center justify-center gap-3 py-8">
            <LoadingSpinner className="h-5 w-5 text-sp-accent" />
            <span className="text-caption text-sp-lightMuted">Loading token list...</span>
          </div>
        ) : isLoadingToken && isAddress(search) ? (
          <div className="flex items-center justify-center gap-3 py-8">
            <LoadingSpinner className="h-5 w-5 text-sp-accent" />
            <span className="text-caption text-sp-lightMuted">Loading token info...</span>
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-caption text-sp-lightMuted">
              No tokens found for &ldquo;{search}&rdquo;
            </div>
            {isAddress(search) && (
              <div className="mt-2 text-micro text-sp-lightMuted2">
                Tip: Make sure the address is valid on BSC
              </div>
            )}
          </div>
        ) : (
          filteredTokens.map((token) => (
            <div
              key={token.address}
              className={cn(
                "flex w-full min-h-[56px] items-center justify-between rounded-xl px-3 py-3 transition active:scale-[0.98]",
                selectedToken === token.symbol
                  ? "bg-sp-accent/10"
                  : "hover:bg-sp-lightSurface2"
              )}
            >
              <button
                onClick={() => onSelect(token.isCustom ? token.address : token.symbol)}
                className="flex flex-1 items-center gap-3"
              >
                <TokenImage symbol={token.symbol} src={token.logoURI} size="xl" />
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-body font-semibold text-sp-lightText">{token.symbol}</span>
                    {token.isCustom && (
                      <Pill tone="blue" size="sm">Custom</Pill>
                    )}
                    {isFavorite(token.symbol) && (
                      <Pill tone="accent" size="sm">⭐</Pill>
                    )}
                    {selectedToken === token.symbol && (
                      <Pill tone="accent" size="sm">Selected</Pill>
                    )}
                  </div>
                  <div className="text-caption text-sp-lightMuted">{token.name}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-sp-lightMuted2">
                    {token.address.slice(0, 6)}...{token.address.slice(-4)}
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-body font-semibold text-sp-lightText">{token.balance}</div>
                  <div className="text-caption text-sp-lightMuted">{token.usd}</div>
                </div>
                <FavoriteButton
                  symbol={token.symbol}
                  isFavorite={isFavorite(token.symbol)}
                  onToggle={toggleFavorite}
                  size="sm"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  // Mobile: Use BottomSheet
  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title="Select Token"
        snapPoints={[50, 90]}
        initialSnap={1}
        className="bg-sp-lightSurface"
      >
        <div className="flex flex-col h-full">
          {tokenListContent}
          <BottomSheetFooter className="bg-sp-lightSurface border-sp-lightBorder">
            <Button variant="ghost" className="w-full border-sp-lightBorder text-sp-lightText hover:bg-sp-lightSurface2">
              Manage Token Lists
            </Button>
          </BottomSheetFooter>
        </div>
      </BottomSheet>
    );
  }

  // Desktop: Centered modal
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative flex w-full max-w-md flex-col animate-scaleIn rounded-2xl border border-sp-lightBorder bg-sp-lightSurface shadow-soft max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-sp-lightBorder px-5 py-4">
          <h2 className="text-h2 font-semibold text-sp-lightText">Select Token</h2>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-sp-lightMuted transition hover:bg-sp-lightSurface2 hover:text-sp-lightText"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Shared content */}
        {tokenListContent}

        {/* Footer */}
        <div className="shrink-0 border-t border-sp-lightBorder px-5 py-3">
          <Button variant="ghost" className="w-full border-sp-lightBorder text-sp-lightText hover:bg-sp-lightSurface2">
            Manage Token Lists
          </Button>
        </div>
      </div>
    </div>,
    document.body
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

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
