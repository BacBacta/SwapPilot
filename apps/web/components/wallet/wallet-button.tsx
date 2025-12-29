"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { cn } from "@/lib/cn";
import { ChainImage } from "@/components/ui/token-image";

/* ========================================
   CUSTOM CONNECT BUTTON
   ======================================== */
interface WalletButtonProps {
  className?: string;
  showBalance?: boolean;
  showChainStatus?: boolean;
}

export function WalletButton({ 
  className, 
  showBalance = true,
  showChainStatus = true 
}: WalletButtonProps) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            className={cn(!ready && "pointer-events-none select-none opacity-0")}
            aria-hidden={!ready}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border border-sp-accent/30 bg-sp-accent/10 px-4 py-2.5 text-caption font-semibold text-sp-accent transition-all duration-200",
                      "hover:border-sp-accent/50 hover:bg-sp-accent/20 hover:shadow-glow",
                      "active:scale-95",
                      className
                    )}
                  >
                    <WalletIcon className="h-4 w-4" />
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border border-sp-bad/30 bg-sp-bad/10 px-4 py-2.5 text-caption font-semibold text-sp-bad transition-all duration-200",
                      "hover:border-sp-bad/50 hover:bg-sp-bad/20",
                      className
                    )}
                  >
                    <WarningIcon className="h-4 w-4" />
                    Wrong Network
                  </button>
                );
              }

              return (
                <div className={cn("flex items-center gap-2", className)}>
                  {/* Chain button */}
                  {showChainStatus && (
                    <button
                      onClick={openChainModal}
                      className="flex items-center gap-2 rounded-xl border border-sp-border bg-sp-surface2 px-3 py-2 text-caption font-medium text-sp-text transition hover:border-sp-borderHover hover:bg-sp-surface3"
                    >
                      {chain.hasIcon && (
                        <ChainImage
                          name={chain.name ?? "Chain"}
                          iconUrl={chain.iconUrl}
                          iconBackground={chain.iconBackground}
                          size={20}
                        />
                      )}
                      <span className="hidden sm:inline">{chain.name}</span>
                      <ChevronDownIcon className="h-3 w-3 text-sp-muted" />
                    </button>
                  )}

                  {/* Account button */}
                  <button
                    onClick={openAccountModal}
                    className="flex items-center gap-2 rounded-xl border border-sp-border bg-sp-surface2 px-3 py-2 text-caption font-medium text-sp-text transition hover:border-sp-borderHover hover:bg-sp-surface3"
                  >
                    {showBalance && account.displayBalance && (
                      <span className="hidden font-semibold text-sp-accent sm:inline">
                        {account.displayBalance}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-gradient-to-br from-sp-accent to-sp-blue" />
                      <span>{account.displayName}</span>
                    </div>
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

/* ========================================
   ICONS
   ======================================== */
function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
