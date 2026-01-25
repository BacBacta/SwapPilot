"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SettingsProvider } from "@/components/providers/settings-provider";
import { TokenRegistryProvider } from "@/components/providers/token-registry-provider";
import { ToastProvider } from "@/components/ui/toast";
import { Web3Provider } from "@/components/providers/web3-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { LandioNav } from "@/components/landio/landio-nav";
import { LandioFooter } from "@/components/landio/landio-footer";

interface ClientLayoutProps {
  children: ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname();
  const web3Enabled =
    pathname === "/swap" ||
    pathname === "/rewards" ||
    pathname === "/referrals" ||
    pathname === "/settings" ||
    pathname === "/status" ||
    pathname === "/analytics" ||
    pathname.startsWith("/providers");

  const content = (
    <ToastProvider>
      <LandioNav />
      <main>{children}</main>
      <LandioFooter />
    </ToastProvider>
  );

  return (
    <PostHogProvider>
      <ThemeProvider>
        <SettingsProvider>
          <TokenRegistryProvider>
            {web3Enabled ? <Web3Provider>{content}</Web3Provider> : content}
          </TokenRegistryProvider>
        </SettingsProvider>
      </ThemeProvider>
    </PostHogProvider>
  );
}
