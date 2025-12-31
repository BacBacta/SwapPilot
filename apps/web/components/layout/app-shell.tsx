"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { WalletButton } from "@/components/wallet/wallet-button";
import { ThemeToggle } from "@/components/providers/theme-provider";
import { ChainSelector } from "@/components/swap/chain-selector";
import { InstallBanner, OfflineIndicator, UpdatePrompt } from "@/lib/use-pwa";

/* ========================================
   MOBILE BOTTOM NAVIGATION
   ======================================== */
const NAV_ITEMS = [
  { href: "/swap", label: "Swap", icon: SwapIcon },
  { href: "/referrals", label: "Referrals", icon: ReferralsIcon },
  { href: "/status", label: "Status", icon: StatusIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sp-border bg-sp-surface/95 backdrop-blur-lg md:hidden">
      <div className="safe-bottom flex h-16 items-center justify-around px-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 transition-all duration-200",
                isActive
                  ? "text-sp-accent"
                  : "text-sp-muted hover:text-sp-text"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
              <span className={cn(
                "text-micro font-medium",
                isActive && "font-semibold"
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute bottom-1 h-1 w-8 rounded-full bg-sp-accent" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ========================================
   DESKTOP SIDEBAR
   ======================================== */
export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 border-r border-sp-border bg-sp-surface/50 md:block">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-sp-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sp-accent font-bold text-black shadow-glow">
              SP
            </div>
            <div>
              <div className="text-body font-semibold text-sp-text">SwapPilot</div>
              <div className="text-micro text-sp-muted">Multi-Chain</div>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-body font-medium transition-all duration-200",
                    isActive
                      ? "bg-sp-accent/10 text-sp-accent"
                      : "text-sp-muted hover:bg-sp-surface2 hover:text-sp-text"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                  {isActive && (
                    <div className="ml-auto h-2 w-2 rounded-full bg-sp-accent" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-sp-border p-4 space-y-3">
          {/* Chain Selector */}
          <div className="rounded-xl border border-sp-border bg-sp-surface2 p-3">
            <div className="mb-2 text-micro font-medium text-sp-muted">Network</div>
            <ChainSelector showLabel={true} />
          </div>

          {/* Wallet Button */}
          <WalletButton className="w-full justify-center" />
        </div>
      </div>
    </aside>
  );
}

/* ========================================
   HEADER (Mobile)
   ======================================== */
export function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-sp-border bg-sp-bg/95 backdrop-blur-lg md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-sp-accent font-bold text-black text-micro shadow-glow">
            SP
          </div>
          <span className="text-body font-semibold text-sp-text">SwapPilot</span>
        </div>

        <div className="flex items-center gap-2">
          <ChainSelector compact showLabel={false} />
          <ThemeToggle />
          <WalletButton showBalance={false} showChainStatus={false} />
        </div>
      </div>
    </header>
  );
}

/* ========================================
   APP SHELL
   ======================================== */
interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-sp-bg theme-dark:bg-sp-bg theme-light:bg-sp-lightBg">
      {/* PWA Components */}
      <OfflineIndicator />
      <UpdatePrompt />
      <InstallBanner />

      {/* Mobile Header */}
      <MobileHeader />

      {/* Main layout */}
      <div className="flex">
        {/* Desktop Sidebar */}
        <DesktopSidebar />

        {/* Main Content */}
        <main className="flex-1 pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <MobileNav />
    </div>
  );
}

/* ========================================
   ICONS
   ======================================== */
function SwapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

function StatusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ReferralsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
