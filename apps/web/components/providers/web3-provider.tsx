"use client";

import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { bsc, mainnet } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";

/* ========================================
   WAGMI CONFIG
   ======================================== */
const config = getDefaultConfig({
  appName: "SwapPilot",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo",
  chains: [bsc, mainnet],
  ssr: true,
});

const queryClient = new QueryClient();

/* ========================================
   CUSTOM RAINBOWKIT THEME
   ======================================== */
const swapPilotTheme = darkTheme({
  accentColor: "#F7C948",
  accentColorForeground: "#0B0F17",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
});

// Override specific colors to match SwapPilot design
const customTheme = {
  ...swapPilotTheme,
  colors: {
    ...swapPilotTheme.colors,
    modalBackground: "#0F1623",
    modalBorder: "rgba(255,255,255,0.08)",
    profileForeground: "#151D2E",
    connectButtonBackground: "#151D2E",
    connectButtonInnerBackground: "#1A2436",
  },
};

/* ========================================
   WEB3 PROVIDER
   ======================================== */
interface Web3ProviderProps {
  children: React.ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={customTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
