"use client";

import { type ReactNode, useEffect } from "react";
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
  useEffect(() => {
    if (typeof window === "undefined") return;

    const cssProto = (window as typeof window & { CSSStyleDeclaration?: { prototype?: Record<string, unknown> } })
      .CSSStyleDeclaration?.prototype as Record<string, unknown> | undefined;

    if (cssProto && typeof (cssProto as { getPropertyValue?: unknown }).getPropertyValue !== "function") {
      (cssProto as { getPropertyValue?: (prop: string) => string }).getPropertyValue = function (prop: string) {
        const raw = (this as Record<string, unknown>)[prop];
        if (raw !== undefined) return String(raw);
        const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        const camelRaw = (this as Record<string, unknown>)[camel];
        return camelRaw !== undefined ? String(camelRaw) : "";
      };
    }

    if (typeof window.getComputedStyle === "function") {
      const original = window.getComputedStyle.bind(window);
      window.getComputedStyle = ((elt: Element, pseudoElt?: string | null) => {
        const style = original(elt, pseudoElt ?? undefined);
        if (style && typeof (style as { getPropertyValue?: unknown }).getPropertyValue !== "function") {
          (style as { getPropertyValue?: (prop: string) => string }).getPropertyValue = function (prop: string) {
            const raw = (style as unknown as Record<string, unknown>)[prop];
            if (raw !== undefined) return String(raw);
            const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
            const camelRaw = (style as unknown as Record<string, unknown>)[camel];
            return camelRaw !== undefined ? String(camelRaw) : "";
          };
        }
        return style;
      }) as typeof window.getComputedStyle;
    }
  }, []);

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
            <Web3Provider>{content}</Web3Provider>
          </TokenRegistryProvider>
        </SettingsProvider>
      </ThemeProvider>
    </PostHogProvider>
  );
}
