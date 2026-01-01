"use client";

import { useState, useEffect, type ReactNode, Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";

interface AppProvidersProps {
  children: ReactNode;
}

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sp-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-sp-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sp-text-muted text-sm">Loading SwapPilot...</span>
      </div>
    </div>
  );
}

export function AppProviders({ children }: AppProvidersProps) {
  const [Web3Provider, setWeb3Provider] = useState<React.ComponentType<{ children: ReactNode }> | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Dynamic import of Web3Provider only on client side
    import("@/components/providers/web3-provider")
      .then((mod) => setWeb3Provider(() => mod.Web3Provider))
      .catch(console.error);
  }, []);

  // During SSR or initial client render, show loading
  if (!isClient || !Web3Provider) {
    return <LoadingFallback />;
  }

  // Once provider is loaded, render the full app
  return (
    <Web3Provider>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </Web3Provider>
  );
}
