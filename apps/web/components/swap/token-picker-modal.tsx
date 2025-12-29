"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { SearchInput } from "@/components/ui/inputs";
import { Button, Pill } from "@/components/ui/primitives";
import { TokenImage, TOKEN_ICONS } from "@/components/ui/token-image";
import { useTokenBalances } from "@/lib/use-token-balances";
import { useTokenPrices } from "@/lib/use-token-prices";
import { useFavorites, FavoriteButton } from "@/lib/use-favorites";

/* ========================================
   TOKEN DATA
   ======================================== */
const TOKENS = [
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "BNB", name: "BNB" },
  { symbol: "USDT", name: "Tether USD" },
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "BTCB", name: "Bitcoin BEP20" },
  { symbol: "CAKE", name: "PancakeSwap" },
  { symbol: "BUSD", name: "Binance USD" },
  { symbol: "DAI", name: "Dai Stablecoin" },
];

const RECENT_TOKENS = ["ETH", "BNB", "USDT", "USDC"];

/* ========================================
   TOKEN PICKER MODAL
   ======================================== */
interface TokenPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (token: string) => void;
  selectedToken?: string;
}

export function TokenPickerModal({ open, onClose, onSelect, selectedToken }: TokenPickerModalProps) {
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Hooks for balances, prices, and favorites
  const { getBalanceFormatted, isConnected } = useTokenBalances();
  const { getPrice, formatUsd } = useTokenPrices();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();

  // Enrich tokens with balances and USD values
  const enrichedTokens = useMemo(() => {
    return TOKENS.map((token) => {
      const balance = getBalanceFormatted(token.symbol);
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
  }, [getBalanceFormatted, getPrice, isConnected]);

  // Filter tokens
  const filteredTokens = useMemo(() => {
    const filtered = enrichedTokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(search.toLowerCase()) ||
        t.name.toLowerCase().includes(search.toLowerCase())
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
        className="relative w-full max-w-md animate-scaleIn rounded-2xl border border-sp-lightBorder bg-sp-lightSurface shadow-soft"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sp-lightBorder px-5 py-4">
          <h2 className="text-h2 font-semibold text-sp-lightText">Select Token</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sp-lightMuted transition hover:bg-sp-lightSurface2 hover:text-sp-lightText"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-sp-lightBorder px-5 py-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or symbol..."
            autoFocus
            className="border-sp-lightBorder bg-sp-lightSurface2 text-sp-lightText placeholder:text-sp-lightMuted"
          />
        </div>

        {/* Recent tokens */}
        <div className="border-b border-sp-lightBorder px-5 py-3">
          <div className="text-micro font-medium text-sp-lightMuted">Recent</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {RECENT_TOKENS.map((symbol) => {
              const token = TOKENS.find((t) => t.symbol === symbol);
              if (!token) return null;
              return (
                <button
                  key={symbol}
                  onClick={() => onSelect(symbol)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 transition",
                    selectedToken === symbol
                      ? "border-sp-accent bg-sp-accent/10"
                      : "border-sp-lightBorder bg-sp-lightSurface hover:border-sp-lightBorderHover hover:bg-sp-lightSurface2"
                  )}
                >
                  <TokenImage symbol={symbol} size="sm" />
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
                const token = TOKENS.find((t) => t.symbol === symbol);
                if (!token) return null;
                return (
                  <button
                    key={symbol}
                    onClick={() => onSelect(symbol)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2 transition",
                      selectedToken === symbol
                        ? "border-sp-accent bg-sp-accent/10"
                        : "border-sp-accent/30 bg-sp-accent/5 hover:border-sp-accent hover:bg-sp-accent/10"
                    )}
                  >
                    <TokenImage symbol={symbol} size="sm" />
                    <span className="text-caption font-semibold text-sp-lightText">{symbol}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Token list */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredTokens.length === 0 ? (
            <div className="py-8 text-center text-caption text-sp-lightMuted">
              No tokens found for &ldquo;{search}&rdquo;
            </div>
          ) : (
            filteredTokens.map((token) => (
              <div
                key={token.symbol}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-3 transition",
                  selectedToken === token.symbol
                    ? "bg-sp-accent/10"
                    : "hover:bg-sp-lightSurface2"
                )}
              >
                <button
                  onClick={() => onSelect(token.symbol)}
                  className="flex flex-1 items-center gap-3"
                >
                  <TokenImage symbol={token.symbol} size="xl" />
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-body font-semibold text-sp-lightText">{token.symbol}</span>
                      {isFavorite(token.symbol) && (
                        <Pill tone="accent" size="sm">⭐</Pill>
                      )}
                      {selectedToken === token.symbol && (
                        <Pill tone="accent" size="sm">Selected</Pill>
                      )}
                    </div>
                    <div className="text-caption text-sp-lightMuted">{token.name}</div>
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

        {/* Footer */}
        <div className="border-t border-sp-lightBorder px-5 py-3">
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
