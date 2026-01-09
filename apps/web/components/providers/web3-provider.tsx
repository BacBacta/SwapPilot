"use client";

import { useState, useEffect } from "react";
import { 
  RainbowKitProvider, 
  darkTheme, 
  lightTheme,
  connectorsForWallets,
} from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  trustWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { WagmiProvider, http, createConfig, fallback } from "wagmi";
import { bsc } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";

/* ========================================
   RELIABLE BSC RPC ENDPOINTS - with fallback support
   ======================================== */
const BSC_RPC_URLS = [
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed2.binance.org",
  "https://bsc-dataseed3.binance.org",
  "https://bsc-dataseed4.binance.org",
];

/* ========================================
   WAGMI CONFIG - OPTIMIZED FOR FAST WALLET CONNECTION
   ======================================== */
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64";

// Only include essential wallets for faster modal loading
const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [
        metaMaskWallet,
        trustWallet,
        coinbaseWallet,
      ],
    },
    {
      groupName: "Other",
      wallets: [
        walletConnectWallet,
        injectedWallet,
      ],
    },
  ],
  {
    appName: "SwapPilot",
    projectId,
  }
);

// Create optimized HTTP transport with fallback RPCs
const bscTransports = BSC_RPC_URLS.map(url => 
  http(url, {
    batch: {
      batchSize: 100, // Batch up to 100 calls together
      wait: 10, // Wait max 10ms to batch calls
    },
    timeout: 5_000, // Reduced timeout for faster fallback
    retryCount: 1, // Quick retry before fallback
  })
);

const config = createConfig({
  connectors,
  chains: [bsc],
  ssr: true,
  transports: {
    [bsc.id]: fallback(bscTransports, {
      rank: true, // Automatically rank RPCs by latency
      retryCount: 2, // Retry across fallback RPCs
    }),
  },
  // Disable expensive multicall for simple reads
  // Keep injected-provider discovery enabled so selecting MetaMask works
  // reliably on browsers with multiple injected wallets (e.g. Brave Wallet).
  multiInjectedProviderDiscovery: true,
});

// Create query client with optimized settings for performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000, // Data fresh for 10s (was 5s)
      gcTime: 30_000, // Keep in cache for 30s (was 10s)
      refetchOnWindowFocus: false, // Disable refetch on window focus
      refetchOnReconnect: false, // Disable refetch on reconnect
      retry: 1, // Only 1 retry for failed queries
    },
  },
});

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
  const [isDark, setIsDark] = useState(true);

  // Listen to theme changes via data-theme attribute
  useEffect(() => {    
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
  }, []);

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
