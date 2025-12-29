import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Web3Provider } from '@/components/providers/web3-provider';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

export const metadata = {
  title: 'SwapPilot - Smart Token Swaps',
  description: 'Compare DEX aggregators and execute the best swap with risk-adjusted scoring.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-sp-bg text-sp-text">
        <Web3Provider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
