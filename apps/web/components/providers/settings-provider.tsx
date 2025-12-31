"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type SwapSettings = {
  /** Slippage tolerance in basis points (100 = 1%) */
  slippageBps: number;
  /** Enable auto-slippage based on token risk signals */
  autoSlippage: boolean;
  /** Enable sellability check - affects scoring */
  sellabilityCheck: boolean;
  /** Enable MEV-aware scoring */
  mevAwareScoring: boolean;
  /** Only use canonical/verified pools */
  canonicalPoolsOnly: boolean;
  /** Quote mode */
  mode: 'SAFE' | 'NORMAL' | 'DEGEN';
};

const DEFAULT_SETTINGS: SwapSettings = {
  slippageBps: 100, // 1%
  autoSlippage: true, // Enable by default
  sellabilityCheck: true,
  mevAwareScoring: true,
  canonicalPoolsOnly: true,
  mode: 'NORMAL',
};

type SettingsContextValue = {
  settings: SwapSettings;
  updateSettings: (partial: Partial<SwapSettings>) => void;
  resetSettings: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_KEY = 'swappilot_settings';

function loadSettings(): SwapSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: SwapSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SwapSettings>(() => loadSettings());

  const updateSettings = useCallback((partial: Partial<SwapSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}
