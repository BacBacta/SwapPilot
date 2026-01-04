"use client";

import { useEffect } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useSettings } from "@/components/providers/settings-provider";
import { useTheme } from "@/components/providers/theme-provider";

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function clickRainbowKitConnect() {
  const el = document.querySelector<HTMLElement>("[data-testid='rk-connect-button']");
  el?.click();
}

function findSettingsRowByLabel(label: string): HTMLElement | null {
  const rows = Array.from(document.querySelectorAll<HTMLElement>(".settings-row"));
  for (const row of rows) {
    const labelEl = row.querySelector<HTMLElement>(".settings-label");
    if (labelEl?.textContent?.trim() === label) return row;
  }
  return null;
}

function wireToggle(params: {
  rowLabel: string;
  get: () => boolean;
  set: (next: boolean) => void;
}): () => void {
  const row = findSettingsRowByLabel(params.rowLabel);
  const toggle = row?.querySelector<HTMLElement>(".toggle-switch");
  if (!toggle) return () => {};

  toggle.removeAttribute("onclick");
  toggle.classList.toggle("active", params.get());

  const onClick = () => {
    const next = !params.get();
    params.set(next);
    toggle.classList.toggle("active", next);
  };

  toggle.addEventListener("click", onClick);
  return () => toggle.removeEventListener("click", onClick);
}

function wireNumberInput(params: {
  rowLabel: string;
  get: () => number;
  set: (next: number) => void;
  min?: number;
  max?: number;
}): () => void {
  const row = findSettingsRowByLabel(params.rowLabel);
  const input = row?.querySelector<HTMLInputElement>(".settings-input");
  if (!input) return () => {};

  input.value = String(params.get());

  const onBlur = () => {
    const val = Number.parseFloat(input.value);
    if (!Number.isFinite(val)) {
      input.value = String(params.get());
      return;
    }
    const clamped = Math.max(params.min ?? 0, Math.min(params.max ?? Infinity, val));
    params.set(clamped);
    input.value = String(clamped);
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onBlur();
      input.blur();
    }
  };

  input.addEventListener("blur", onBlur);
  input.addEventListener("keydown", onKeydown);
  return () => {
    input.removeEventListener("blur", onBlur);
    input.removeEventListener("keydown", onKeydown);
  };
}

function wireSelect(params: {
  rowLabel: string;
  get: () => string;
  set: (next: string) => void;
  valueMap?: Record<string, string>; // display text -> stored value
}): () => void {
  const row = findSettingsRowByLabel(params.rowLabel);
  const select = row?.querySelector<HTMLSelectElement>(".settings-select");
  if (!select) return () => {};

  const valueMap = params.valueMap ?? {};
  const reverseMap: Record<string, string> = {};
  for (const [display, stored] of Object.entries(valueMap)) {
    reverseMap[stored] = display;
  }

  // Set initial value
  const currentStored = params.get();
  const displayValue = reverseMap[currentStored] ?? currentStored;
  for (const opt of select.options) {
    if (opt.text === displayValue || opt.value === currentStored) {
      opt.selected = true;
      break;
    }
  }

  const onChange = () => {
    const selectedText = select.options[select.selectedIndex]?.text ?? "";
    const storedValue = valueMap[selectedText] ?? selectedText.toLowerCase().replace(/\s+/g, '-');
    params.set(storedValue);
  };

  select.addEventListener("change", onChange);
  return () => select.removeEventListener("change", onChange);
}

export function LandioSettingsController() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { settings, updateSettings, resetSettings } = useSettings();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // Settings nav -> scroll to relevant section blocks
    const navItems = Array.from(document.querySelectorAll<HTMLButtonElement>(".settings-nav-item"));
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".settings-section"));

    const targets: Record<string, HTMLElement | undefined> = {
      general: sections[0],
      trading: sections[1],
      notifications: sections[3],
      security: sections[4],
    };

    const navCleanup: Array<() => void> = [];
    for (const item of navItems) {
      const sectionKey = item.getAttribute("data-section") ?? "";
      const target = targets[sectionKey];
      const onClick = () => {
        navItems.forEach((x) => x.classList.remove("active"));
        item.classList.add("active");
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      item.addEventListener("click", onClick);
      navCleanup.push(() => item.removeEventListener("click", onClick));
    }

    // Wallet card binding
    const walletLabel = document.querySelector<HTMLElement>(".wallet-card .wallet-label");
    const walletAddress = document.querySelector<HTMLElement>(".wallet-card .wallet-address");
    const copyBtn = document.querySelector<HTMLButtonElement>(".wallet-card .wallet-btn:not(.disconnect)");
    const disconnectBtn = document.querySelector<HTMLButtonElement>(".wallet-card .wallet-btn.disconnect");

    if (walletLabel) walletLabel.textContent = isConnected ? "Wallet" : "Not connected";
    if (walletAddress) walletAddress.textContent = address ? shortAddress(address) : "Connect your wallet";

    const onCopy = async () => {
      if (!address) {
        clickRainbowKitConnect();
        return;
      }
      try {
        await navigator.clipboard.writeText(address);
      } catch {
        // ignore
      }
    };

    const onDisconnect = () => {
      if (!isConnected) {
        clickRainbowKitConnect();
        return;
      }
      disconnect();
    };

    if (copyBtn) {
      copyBtn.removeAttribute("onclick");
      copyBtn.addEventListener("click", onCopy);
    }
    if (disconnectBtn) {
      disconnectBtn.addEventListener("click", onDisconnect);
    }

    // Slippage options (Default Slippage Tolerance)
    const slippageRow = findSettingsRowByLabel("Default Slippage Tolerance");
    const slippageButtons = Array.from(slippageRow?.querySelectorAll<HTMLButtonElement>(".slippage-option") ?? []);
    const slippageCustom = slippageRow?.querySelector<HTMLInputElement>(".settings-input[placeholder='Custom']") ?? null;

    const presets = [10, 50, 100]; // 0.1%, 0.5%, 1.0%
    const applySlippageUI = (bps: number) => {
      slippageButtons.forEach((btn, idx) => btn.classList.toggle("active", presets[idx] === bps));
      if (slippageCustom) {
        if (!presets.includes(bps)) slippageCustom.value = (bps / 100).toString();
        if (presets.includes(bps)) slippageCustom.value = "";
      }
    };

    applySlippageUI(settings.slippageBps);

    const slippageCleanup: Array<() => void> = [];
    slippageButtons.forEach((btn, idx) => {
      const bps = presets[idx] ?? 50;
      const onClick = () => {
        updateSettings({ slippageBps: bps });
        applySlippageUI(bps);
      };
      btn.addEventListener("click", onClick);
      slippageCleanup.push(() => btn.removeEventListener("click", onClick));
    });

    const onCustomCommit = () => {
      if (!slippageCustom) return;
      const raw = slippageCustom.value.trim().replace(",", ".");
      const pct = Number.parseFloat(raw);
      if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
        applySlippageUI(settings.slippageBps);
        return;
      }
      const bps = Math.round(pct * 100);
      updateSettings({ slippageBps: bps });
      applySlippageUI(bps);
    };

    if (slippageCustom) {
      slippageCustom.addEventListener("blur", onCustomCommit);
      slippageCustom.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCustomCommit();
          slippageCustom.blur();
        }
      });
      slippageCleanup.push(() => slippageCustom.removeEventListener("blur", onCustomCommit));
    }

    // Persisted toggles
    const cleanupToggles: Array<() => void> = [];
    
    // Trading toggles
    cleanupToggles.push(
      wireToggle({
        rowLabel: "MEV Protection",
        get: () => settings.mevAwareScoring,
        set: (next) => updateSettings({ mevAwareScoring: next }),
      })
    );
    cleanupToggles.push(
      wireToggle({
        rowLabel: "Auto Route Optimization",
        get: () => settings.autoRouteOptimization,
        set: (next) => updateSettings({ autoRouteOptimization: next }),
      })
    );
    
    // Notification toggles
    cleanupToggles.push(
      wireToggle({
        rowLabel: "Transaction Confirmations",
        get: () => settings.notifyTransactionConfirmations,
        set: (next) => updateSettings({ notifyTransactionConfirmations: next }),
      })
    );
    cleanupToggles.push(
      wireToggle({
        rowLabel: "Price Alerts",
        get: () => settings.notifyPriceAlerts,
        set: (next) => updateSettings({ notifyPriceAlerts: next }),
      })
    );
    cleanupToggles.push(
      wireToggle({
        rowLabel: "Reward Notifications",
        get: () => settings.notifyRewards,
        set: (next) => updateSettings({ notifyRewards: next }),
      })
    );
    cleanupToggles.push(
      wireToggle({
        rowLabel: "Email Updates",
        get: () => settings.notifyEmailUpdates,
        set: (next) => updateSettings({ notifyEmailUpdates: next }),
      })
    );
    cleanupToggles.push(
      wireToggle({
        rowLabel: "Browser Notifications",
        get: () => settings.notifyBrowser,
        set: (next) => updateSettings({ notifyBrowser: next }),
      })
    );
    
    // Security toggles
    cleanupToggles.push(
      wireToggle({
        rowLabel: "Require Confirmation",
        get: () => settings.requireConfirmation,
        set: (next) => updateSettings({ requireConfirmation: next }),
      })
    );

    // Number inputs
    const cleanupInputs: Array<() => void> = [];
    cleanupInputs.push(
      wireNumberInput({
        rowLabel: "Transaction Deadline",
        get: () => settings.transactionDeadlineMinutes,
        set: (next) => updateSettings({ transactionDeadlineMinutes: next }),
        min: 1,
        max: 60,
      })
    );
    cleanupInputs.push(
      wireNumberInput({
        rowLabel: "Spending Limit",
        get: () => settings.spendingLimitUsd,
        set: (next) => updateSettings({ spendingLimitUsd: next }),
        min: 0,
        max: 1000000,
      })
    );

    // Select dropdowns
    const cleanupSelects: Array<() => void> = [];
    cleanupSelects.push(
      wireSelect({
        rowLabel: "Gas Price Strategy",
        get: () => settings.gasPriceStrategy,
        set: (next) => updateSettings({ gasPriceStrategy: next as 'standard' | 'fast' | 'instant' | 'custom' }),
        valueMap: {
          "Standard": "standard",
          "Fast": "fast",
          "Instant": "instant",
          "Custom": "custom",
        },
      })
    );
    cleanupSelects.push(
      wireSelect({
        rowLabel: "Quote Refresh Interval",
        get: () => String(settings.quoteRefreshIntervalSeconds),
        set: (next) => {
          const seconds = parseInt(next.replace(/\D/g, ''), 10);
          if (Number.isFinite(seconds)) {
            updateSettings({ quoteRefreshIntervalSeconds: seconds });
          }
        },
        valueMap: {
          "5 seconds": "5",
          "10 seconds": "10",
          "15 seconds": "15",
          "30 seconds": "30",
        },
      })
    );

    // Theme selector
    const themeOptions = Array.from(document.querySelectorAll<HTMLElement>(".theme-option"));
    const applyThemeUI = (next: "dark" | "light") => {
      themeOptions.forEach((el) => el.classList.remove("active"));
      const match = themeOptions.find((el) => el.textContent?.includes(next === "dark" ? "Dark" : "Light"));
      match?.classList.add("active");
    };

    applyThemeUI(theme);

    const themeCleanup: Array<() => void> = [];
    for (const option of themeOptions) {
      const onClick = () => {
        const text = option.textContent ?? "";
        if (text.includes("Dark")) {
          setTheme("dark");
          applyThemeUI("dark");
        } else if (text.includes("Light")) {
          setTheme("light");
          applyThemeUI("light");
        } else if (text.includes("System")) {
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          setTheme(prefersDark ? "dark" : "light");
          applyThemeUI(prefersDark ? "dark" : "light");
        }
      };
      option.addEventListener("click", onClick);
      themeCleanup.push(() => option.removeEventListener("click", onClick));
    }

    // Language selector (persisted)
    const langOptions = Array.from(document.querySelectorAll<HTMLElement>(".language-option"));
    const langMap: Record<string, string> = {
      "English": "en",
      "Français": "fr",
      "Español": "es",
      "Deutsch": "de",
      "中文": "zh",
      "日本語": "ja",
      "한국어": "ko",
      "Русский": "ru",
    };
    const reverseLangMap: Record<string, string> = {};
    for (const [name, code] of Object.entries(langMap)) {
      reverseLangMap[code] = name;
    }

    // Apply current language
    const currentLangName = reverseLangMap[settings.language] ?? "English";
    langOptions.forEach((el) => {
      const langName = el.querySelector<HTMLElement>(".language-name")?.textContent ?? "";
      el.classList.toggle("active", langName === currentLangName);
    });

    const langCleanup: Array<() => void> = [];
    for (const option of langOptions) {
      const onClick = () => {
        langOptions.forEach((el) => el.classList.remove("active"));
        option.classList.add("active");
        const langName = option.querySelector<HTMLElement>(".language-name")?.textContent ?? "";
        const langCode = langMap[langName] ?? "en";
        updateSettings({ language: langCode });
      };
      option.addEventListener("click", onClick);
      langCleanup.push(() => option.removeEventListener("click", onClick));
    }

    // Danger zone
    const dangerButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".danger-section .danger-btn"));
    const onReset = () => {
      resetSettings();
      // Keep theme in dark to match template default.
      setTheme("dark");
      applySlippageUI(100);
    };
    const onClear = () => {
      try {
        localStorage.removeItem("swappilot_settings");
        localStorage.removeItem("swappilot-theme");
      } catch {
        // ignore
      }
      window.location.reload();
    };

    if (dangerButtons[0]) dangerButtons[0].addEventListener("click", onReset);
    if (dangerButtons[1]) dangerButtons[1].addEventListener("click", onClear);

    // Save/Cancel (no-op; settings persist immediately)
    const saveSection = document.querySelector<HTMLElement>(".save-section");
    const saveButtons = Array.from(saveSection?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const onSave = (e: Event) => {
      e.preventDefault();
    };
    saveButtons.forEach((b) => b.addEventListener("click", onSave));

    return () => {
      navCleanup.forEach((fn) => fn());
      slippageCleanup.forEach((fn) => fn());
      cleanupToggles.forEach((fn) => fn());
      cleanupInputs.forEach((fn) => fn());
      cleanupSelects.forEach((fn) => fn());
      themeCleanup.forEach((fn) => fn());
      langCleanup.forEach((fn) => fn());

      if (copyBtn) copyBtn.removeEventListener("click", onCopy);
      if (disconnectBtn) disconnectBtn.removeEventListener("click", onDisconnect);

      if (dangerButtons[0]) dangerButtons[0].removeEventListener("click", onReset);
      if (dangerButtons[1]) dangerButtons[1].removeEventListener("click", onClear);

      saveButtons.forEach((b) => b.removeEventListener("click", onSave));
    };
  }, [
    address,
    disconnect,
    isConnected,
    resetSettings,
    setTheme,
    settings,
    theme,
    updateSettings,
  ]);

  return null;
}
