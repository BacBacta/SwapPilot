"use client";

import { useState, useEffect, useCallback } from "react";

/* ========================================
   PWA INSTALLATION HOOK
   ======================================== */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface UsePWAReturn {
  isInstallable: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  promptInstall: () => Promise<boolean>;
  updateAvailable: boolean;
  updateApp: () => void;
}

export function usePWA(): UsePWAReturn {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsInstalled(isStandalone);

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    // Online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Service Worker / PWA
    // In dev, a SW tends to cache Next.js chunks and causes persistent hydration/runtime errors
    // across refreshes. We explicitly unregister and clear caches in non-production.
    if ("serviceWorker" in navigator) {
      const isProd = process.env.NODE_ENV === "production";

      if (!isProd) {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => Promise.all(regs.map((r) => r.unregister())))
          .catch(() => {
            // best-effort
          });

        if ("caches" in window) {
          caches
            .keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .catch(() => {
              // best-effort
            });
        }
      } else {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            setRegistration(reg);

            // Check for updates
            reg.addEventListener("updatefound", () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    setUpdateAvailable(true);
                  }
                });
              }
            });
          })
          .catch((err) => console.error("SW registration failed:", err));
      }
    }

    // Set initial online state
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!installPrompt) return false;

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
      setInstallPrompt(null);
      return true;
    }
    
    return false;
  }, [installPrompt]);

  const updateApp = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      window.location.reload();
    }
  }, [registration]);

  return {
    isInstallable: !!installPrompt,
    isInstalled,
    isOnline,
    promptInstall,
    updateAvailable,
    updateApp,
  };
}

/* ========================================
   INSTALL BANNER COMPONENT
   ======================================== */

interface InstallBannerProps {
  className?: string;
}

export function InstallBanner({ className = "" }: InstallBannerProps) {
  const { isInstallable, promptInstall } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  // Check if previously dismissed
  useEffect(() => {
    const wasDismissed = localStorage.getItem("pwa-banner-dismissed");
    if (wasDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa-banner-dismissed", "true");
  };

  if (!isInstallable || dismissed) return null;

  return (
    <div
      className={`
        animate-slideUp fixed bottom-20 left-4 right-4 z-40 rounded-2xl 
        border border-sp-accent/30 bg-sp-surface p-4 shadow-soft md:bottom-4 md:left-auto md:right-4 md:w-80
        ${className}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sp-accent text-lg font-bold text-black">
          SP
        </div>
        <div className="flex-1">
          <div className="text-body font-semibold text-sp-text">
            Install SwapPilot
          </div>
          <div className="text-caption text-sp-muted">
            Add to your home screen for a better experience
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-sp-muted hover:text-sp-text"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <button
        onClick={promptInstall}
        className="mt-3 w-full rounded-xl bg-sp-accent py-2.5 text-body font-semibold text-black transition hover:bg-sp-accentHover"
      >
        Install App
      </button>
    </div>
  );
}

/* ========================================
   OFFLINE INDICATOR
   ======================================== */

export function OfflineIndicator() {
  const { isOnline } = usePWA();

  if (isOnline) return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-50 bg-sp-warn/90 px-4 py-2 text-center text-body font-medium text-black">
      <span className="mr-2">⚠️</span>
      You are offline. Some features may not work.
    </div>
  );
}

/* ========================================
   UPDATE PROMPT
   ======================================== */

export function UpdatePrompt() {
  const { updateAvailable, updateApp } = usePWA();

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 animate-slideUp rounded-2xl border border-sp-blue/30 bg-sp-surface p-4 shadow-soft md:bottom-4 md:left-auto md:right-4 md:w-80">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sp-blue text-white">
          🔄
        </div>
        <div className="flex-1">
          <div className="text-body font-semibold text-sp-text">
            Update Available
          </div>
          <div className="text-caption text-sp-muted">
            A new version is ready
          </div>
        </div>
      </div>
      <button
        onClick={updateApp}
        className="mt-3 w-full rounded-xl bg-sp-blue py-2.5 text-body font-semibold text-white transition hover:bg-sp-blue/90"
      >
        Update Now
      </button>
    </div>
  );
}
