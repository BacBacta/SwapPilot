import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { AppProviders } from '@/components/providers/app-providers';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { SettingsProvider } from '@/components/providers/settings-provider';
import { TokenRegistryProvider } from '@/components/providers/token-registry-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'SwapPilot - Smart Token Swaps',
  description: 'Compare DEX aggregators and execute the best swap with risk-adjusted scoring.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SwapPilot',
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0B0F17' },
    { media: '(prefers-color-scheme: light)', color: '#F6F7FB' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-sp-bg text-sp-text">
        <ThemeProvider>
          <SettingsProvider>
            <TokenRegistryProvider>
              <AppProviders>{children}</AppProviders>
            </TokenRegistryProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
