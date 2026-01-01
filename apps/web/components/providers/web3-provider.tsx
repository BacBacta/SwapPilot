"use client";

import { useState, useEffect } from "react";
import { getDefaultConfig, RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { bsc, mainnet, polygon, arbitrum, optimism, base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";

/* ========================================
   WAGMI CONFIG - MULTI-CHAIN
   ======================================== */
const config = getDefaultConfig({
  appName: "SwapPilot",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo",
  chains: [bsc, mainnet, polygon, arbitrum, optimism, base],
  ssr: true,
});

const queryClient = new QueryClient();

/* ========================================
   CUSTOM RAINBOWKIT THEMES
   ======================================== */
const swapPilotDarkTheme = darkTheme({
  accentColor: "#F7C948",
  accentColorForeground: "#0B0F17",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
});

const swapPilotLightTheme = lightTheme({
  accentColor: "#F7C948",
  accentColorForeground: "#0B0F17",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
});

// Override specific colors for dark theme
const customDarkTheme = {
  ...swapPilotDarkTheme,
  colors: {
    ...swapPilotDarkTheme.colors,
    modalBackground: "#0F1623",
    modalBorder: "rgba(255,255,255,0.08)",
    profileForeground: "#151D2E",
    connectButtonBackground: "#151D2E",
    connectButtonInnerBackground: "#1A2436",
  },
};

// Override specific colors for light theme
const customLightTheme = {
  ...swapPilotLightTheme,
  colors: {
    ...swapPilotLightTheme.colors,
    modalBackground: "#FFFFFF",
    modalBorder: "rgba(18,25,38,0.08)",
    profileForeground: "#F2F4F8",
    connectButtonBackground: "#F2F4F8",
    connectButtonInnerBackground: "#E8EBF0",
  },
};

/* ========================================
   WEB3 PROVIDER
   ======================================== */
interface Web3ProviderProps {
  children: React.ReactNode;
}

function RainbowKitWrapper({ children }: Web3ProviderProps) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(true);

  // Ensure client-side only rendering to avoid indexedDB SSR issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen to theme changes via data-theme attribute
  useEffect(() => {
    if (!mounted) return;
    
    const updateTheme = () => {
      const theme = document.documentElement.getAttribute("data-theme");
      setIsDark(theme !== "light");
    };

    // Initial check
    updateTheme();

    // Observe changes
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, [mounted]);

  // Prevent SSR flash - show nothing until mounted
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <RainbowKitProvider 
      theme={isDark ? customDarkTheme : customLightTheme} 
      modalSize="compact"
    >
      {children}
    </RainbowKitProvider>
  );
}

export function Web3Provider({ children }: Web3ProviderProps) {
  const [mounted, setMounted] = useState(false);

  // WalletConnect uses indexedDB which doesn't exist in SSR
  // Only render the full provider tree on the client
  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial hydration, render children without Web3 providers
  // This prevents indexedDB errors from WalletConnect
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitWrapper>
          {children}
        </RainbowKitWrapper>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
