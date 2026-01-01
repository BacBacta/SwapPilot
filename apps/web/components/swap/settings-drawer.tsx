"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Button, Toggle, Divider } from "@/components/ui/primitives";
import { Slider, PresetButtons } from "@/components/ui/inputs";
import { useSettings } from "@/components/providers/settings-provider";
import { PilotTierCard } from "@/components/swap/pilot-tier";
import { BottomSheet, BottomSheetFooter } from "@/components/ui/bottom-sheet";

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

/* ========================================
   SETTINGS DRAWER
   ======================================== */
interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const { settings, updateSettings, resetSettings } = useSettings();
  
  // Derive slippage percentage from bps (100 bps = 1%)
  const slippage = settings.slippageBps / 100;
  const setSlippage = (pct: number) => updateSettings({ slippageBps: Math.round(pct * 100) });
  
  // Local UI state
  const [customSlippage, setCustomSlippage] = useState(false);
  const [deadline, setDeadline] = useState(20);
  
  // Map settings to toggles
  const mevProtection = settings.mevAwareScoring;
  const setMevProtection = (v: boolean) => updateSettings({ mevAwareScoring: v });
  const autoRouter = settings.sellabilityCheck;
  const setAutoRouter = (v: boolean) => updateSettings({ sellabilityCheck: v });
  const expertMode = settings.mode === "DEGEN";
  const setExpertMode = (v: boolean) => updateSettings({ mode: v ? "DEGEN" : "NORMAL" });

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

  if (!mounted) return null;

  // Shared settings content
  const settingsContent = (
    <div className="p-6 space-y-6">
      {/* Slippage Tolerance */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-body font-semibold text-sp-lightText">Slippage Tolerance</h3>
            <p className="mt-0.5 text-caption text-sp-lightMuted">
              Your transaction will revert if the price changes unfavorably
            </p>
          </div>
          <span className="text-h2 font-bold text-sp-lightText">
            {settings.autoSlippage ? (
              <span className="text-sp-accent">Auto</span>
            ) : (
              `${slippage}%`
            )}
          </span>
        </div>

        {/* Auto-slippage toggle */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-sp-lightBorder bg-sp-lightSurface2 px-4 py-3 min-h-[56px]">
          <div className="flex items-center gap-2">
            <span className="text-body font-medium text-sp-lightText">⚡ Auto-Slippage</span>
            <span className="text-caption text-sp-lightMuted">
              Ajusté selon le risque
            </span>
          </div>
          <Toggle
            on={settings.autoSlippage}
            onChange={(on) => updateSettings({ autoSlippage: on })}
          />
        </div>

        {/* Manual slippage controls */}
        <div className={settings.autoSlippage ? "mt-4 opacity-50 pointer-events-none" : "mt-4"}>
          <div className="text-caption text-sp-lightMuted mb-2">
            {settings.autoSlippage ? "Slippage minimum (fallback)" : "Slippage manuel"}
          </div>
          <PresetButtons
            options={[
              { value: 0.1, label: "0.1%" },
              { value: 0.5, label: "0.5%" },
              { value: 1, label: "1%" },
            ]}
            value={customSlippage ? -1 : slippage}
            onChange={(v) => {
              setSlippage(v as number);
              setCustomSlippage(false);
            }}
            className="[&>button]:flex-1 [&>button]:min-h-[48px] [&>button]:border-sp-lightBorder [&>button]:bg-sp-lightSurface [&>button]:text-sp-lightText"
          />

          <div className="mt-3">
            <Slider
              value={slippage}
              min={0.1}
              max={5}
              step={0.1}
              onChange={(v) => {
                setSlippage(v);
                setCustomSlippage(true);
              }}
              className="[&_input]:bg-sp-lightSurface2"
            />
          </div>

          {slippage > 1 && !settings.autoSlippage && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-caption text-amber-700">
              ⚠️ High slippage increases risk of front-running
            </div>
          )}
        </div>
      </section>

      <Divider />

      {/* Transaction Deadline */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-body font-semibold text-sp-lightText">Transaction Deadline</h3>
            <p className="mt-0.5 text-caption text-sp-lightMuted">
              Transaction will revert if pending for longer
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-sp-lightBorder bg-sp-lightSurface2 px-3 py-2 min-h-[48px]">
            <input
              type="number"
              value={deadline}
              onChange={(e) => setDeadline(Number(e.target.value))}
              className="w-12 bg-transparent text-right text-body font-semibold text-sp-lightText focus:outline-none"
            />
            <span className="text-caption text-sp-lightMuted">min</span>
          </div>
        </div>
      </section>

      <Divider />

      {/* Toggles */}
      <section className="space-y-4">
        <SettingRow
          title="MEV Protection"
          description="Protect against sandwich attacks"
          checked={mevProtection}
          onChange={setMevProtection}
        />

        <SettingRow
          title="Auto Router"
          description="Find the best route across all DEXes"
          checked={autoRouter}
          onChange={setAutoRouter}
        />

        <SettingRow
          title="Expert Mode"
          description="Skip confirmation modals for faster swaps"
          checked={expertMode}
          onChange={setExpertMode}
          warning="Use at your own risk"
        />
      </section>

      <Divider />

      {/* PILOT Token Tier */}
      <section>
        <h3 className="text-body font-semibold text-sp-lightText mb-3">PILOT Token</h3>
        <PilotTierCard />
        <p className="mt-2 text-micro text-sp-lightMuted">
          Hold PILOT tokens to get up to 20% discount on platform fees. 15% of all fees are used to buy and burn PILOT.
        </p>
      </section>

      <Divider />

      {/* Interface */}
      <section>
        <h3 className="text-body font-semibold text-sp-lightText">Interface</h3>
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-sp-lightBorder bg-sp-lightSurface2 px-4 py-3 min-h-[56px]">
            <span className="text-caption text-sp-lightText">Theme</span>
            <PresetButtons
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
              ]}
              value="dark"
              className="[&>button]:border-sp-lightBorder [&>button]:bg-sp-lightSurface [&>button]:text-sp-lightText [&>button]:px-4 [&>button]:min-h-[40px]"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-sp-lightBorder bg-sp-lightSurface2 px-4 py-3 min-h-[56px]">
            <span className="text-caption text-sp-lightText">Language</span>
            <span className="text-caption font-medium text-sp-lightMuted">English</span>
          </div>
        </div>
      </section>
    </div>
  );

  // Shared footer actions
  const footerActions = (
    <div className="flex gap-3">
      <Button 
        variant="ghost" 
        className="flex-1 min-h-[48px] border-sp-lightBorder text-sp-lightText hover:bg-sp-lightSurface2"
        onClick={() => {
          resetSettings();
          setDeadline(20);
        }}
      >
        Reset
      </Button>
      <Button className="flex-1 min-h-[48px]" onClick={onClose}>
        Save & Close
      </Button>
    </div>
  );

  // Mobile: BottomSheet
  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title="Settings"
        snapPoints={[50, 90]}
        initialSnap={1}
        className="bg-sp-lightSurface"
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto">
            {settingsContent}
          </div>
          <BottomSheetFooter className="bg-sp-lightSurface border-sp-lightBorder">
            {footerActions}
          </BottomSheetFooter>
        </div>
      </BottomSheet>
    );
  }

  // Desktop: Side drawer
  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col transform border-l border-sp-lightBorder bg-sp-lightSurface shadow-soft transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-sp-lightBorder bg-sp-lightSurface px-6 py-4">
          <h2 className="text-h2 font-semibold text-sp-lightText">Settings</h2>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sp-lightMuted transition hover:bg-sp-lightSurface2 hover:text-sp-lightText active:scale-95"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Shared content */}
        <div className="flex-1 overflow-y-auto">
          {settingsContent}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-sp-lightBorder bg-sp-lightSurface px-6 py-4">
          {footerActions}
        </div>
      </div>
    </>,
    document.body
  );
}

/* ========================================
   SETTING ROW COMPONENT
   ======================================== */
function SettingRow({
  title,
  description,
  checked,
  onChange,
  warning,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  warning?: string;
}) {
  return (
    <div className="flex min-h-[56px] items-start justify-between gap-4 py-2">
      <div className="flex-1">
        <div className="text-body font-medium text-sp-lightText">{title}</div>
        <div className="mt-0.5 text-caption text-sp-lightMuted">{description}</div>
        {warning && checked && (
          <div className="mt-1 text-micro text-amber-600">⚠️ {warning}</div>
        )}
      </div>
      <Toggle on={checked} onChange={onChange} />
    </div>
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
