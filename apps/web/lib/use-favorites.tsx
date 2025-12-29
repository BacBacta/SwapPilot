"use client";

import { useState, useEffect, useCallback } from "react";

/* ========================================
   FAVORITES HOOK
   Store favorite tokens in localStorage
   ======================================== */

const STORAGE_KEY = "swappilot-favorite-tokens";
const MAX_FAVORITES = 10;

interface UseFavoritesReturn {
  favorites: string[];
  isFavorite: (symbol: string) => boolean;
  toggleFavorite: (symbol: string) => void;
  addFavorite: (symbol: string) => void;
  removeFavorite: (symbol: string) => void;
  clearFavorites: () => void;
}

export function useFavorites(): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFavorites(parsed.slice(0, MAX_FAVORITES));
        }
      }
    } catch {
      console.warn("Failed to load favorites from localStorage");
    }
    setMounted(true);
  }, []);

  // Save favorites to localStorage
  const saveFavorites = useCallback((newFavorites: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
    } catch {
      console.warn("Failed to save favorites to localStorage");
    }
  }, []);

  const isFavorite = useCallback(
    (symbol: string) => favorites.includes(symbol.toUpperCase()),
    [favorites]
  );

  const addFavorite = useCallback(
    (symbol: string) => {
      const upperSymbol = symbol.toUpperCase();
      if (favorites.includes(upperSymbol)) return;
      if (favorites.length >= MAX_FAVORITES) return;

      const newFavorites = [upperSymbol, ...favorites];
      setFavorites(newFavorites);
      saveFavorites(newFavorites);
    },
    [favorites, saveFavorites]
  );

  const removeFavorite = useCallback(
    (symbol: string) => {
      const upperSymbol = symbol.toUpperCase();
      const newFavorites = favorites.filter((f) => f !== upperSymbol);
      setFavorites(newFavorites);
      saveFavorites(newFavorites);
    },
    [favorites, saveFavorites]
  );

  const toggleFavorite = useCallback(
    (symbol: string) => {
      if (isFavorite(symbol)) {
        removeFavorite(symbol);
      } else {
        addFavorite(symbol);
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  const clearFavorites = useCallback(() => {
    setFavorites([]);
    saveFavorites([]);
  }, [saveFavorites]);

  // Don't return anything meaningful until mounted
  if (!mounted) {
    return {
      favorites: [],
      isFavorite: () => false,
      toggleFavorite: () => {},
      addFavorite: () => {},
      removeFavorite: () => {},
      clearFavorites: () => {},
    };
  }

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    clearFavorites,
  };
}

/* ========================================
   FAVORITE STAR BUTTON
   ======================================== */
interface FavoriteButtonProps {
  symbol: string;
  isFavorite: boolean;
  onToggle: (symbol: string) => void;
  className?: string;
  size?: "sm" | "md";
}

export function FavoriteButton({
  symbol,
  isFavorite,
  onToggle,
  className = "",
  size = "md",
}: FavoriteButtonProps) {
  const sizeClasses = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(symbol);
      }}
      className={`
        flex items-center justify-center rounded-lg transition-all duration-200
        ${sizeClasses}
        ${isFavorite
          ? "text-sp-accent hover:text-sp-accentHover"
          : "text-sp-muted2 hover:text-sp-accent"
        }
        ${className}
      `}
      aria-label={isFavorite ? `Remove ${symbol} from favorites` : `Add ${symbol} to favorites`}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <svg
        className={`${iconSize} transition-transform duration-200 ${
          isFavorite ? "scale-110" : "scale-100"
        }`}
        fill={isFavorite ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    </button>
  );
}
