"use client";

import { useState, useEffect, type ReactNode } from "react";

interface Web3ProviderWrapperProps {
  children: ReactNode;
}

export function Web3ProviderWrapper({ children }: Web3ProviderWrapperProps) {
  const [Provider, setProvider] = useState<React.ComponentType<{ children: ReactNode }> | null>(null);

  useEffect(() => {
    // Only import on client side to avoid indexedDB access during SSR
    import("@/components/providers/web3-provider")
      .then((mod) => setProvider(() => mod.Web3Provider))
      .catch(console.error);
  }, []);

  if (!Provider) {
    // Loading state while provider is being imported
    return (
      <div className="min-h-screen flex items-center justify-center bg-sp-bg">
        <div className="animate-pulse text-sp-text-muted">Loading...</div>
      </div>
    );
  }

  return <Provider>{children}</Provider>;
}
