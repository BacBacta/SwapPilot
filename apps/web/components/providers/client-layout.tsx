"use client";

import { type ReactNode } from "react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SettingsProvider } from "@/components/providers/settings-provider";
import { TokenRegistryProvider } from "@/components/providers/token-registry-provider";
import { ToastProvider } from "@/components/ui/toast";
import { Web3Provider } from "@/components/providers/web3-provider";
import { LandioNav } from "@/components/landio/landio-nav";
import { LandioFooter } from "@/components/landio/landio-footer";

interface ClientLayoutProps {
  children: ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <TokenRegistryProvider>
          <Web3Provider>
            <ToastProvider>
              <LandioNav />
              <main>{children}</main>
              <LandioFooter />
            </ToastProvider>
          </Web3Provider>
        </TokenRegistryProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
