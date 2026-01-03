"use client";

import { type ReactNode, useState, useEffect } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/layout/app-shell";

interface AppProvidersProps {
  children: ReactNode;
  /**
   * When true (default), wraps the app with the legacy AppShell.
   * Set to false to render pages without the legacy chrome (e.g. Landio-only UI).
   */
  useLegacyShell?: boolean;
}

// Wrapper that maintains consistent DOM structure for hydration
function Web3Wrapper({ children, provider: Provider }: { children: ReactNode; provider: React.ComponentType<{children: ReactNode}> | null }) {
  // Always render a consistent wrapper div to avoid hydration mismatch
  // The Provider is only used after hydration is complete
  if (!Provider) {
    return <>{children}</>;
  }
  return <Provider>{children}</Provider>;
}

export function AppProviders({ children, useLegacyShell = true }: AppProvidersProps) {
  const [Web3Provider, setWeb3Provider] = useState<React.ComponentType<{children: ReactNode}> | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Dynamically import Web3Provider only on client to avoid indexedDB SSR errors
    import("@/components/providers/web3-provider").then((mod) => {
      setWeb3Provider(() => mod.Web3Provider);
    });
  }, []);

  const content = useLegacyShell ? <AppShell>{children}</AppShell> : children;

  // Use suppressHydrationWarning on the wrapper to handle the provider change gracefully
  return (
    <div suppressHydrationWarning>
      <Web3Wrapper provider={mounted ? Web3Provider : null}>
        <ToastProvider>
          {content}
        </ToastProvider>
      </Web3Wrapper>
    </div>
  );
}
