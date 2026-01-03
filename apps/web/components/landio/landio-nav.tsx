"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function triggerRainbowKitConnect() {
  document.querySelector<HTMLButtonElement>("[data-testid='rk-connect-button']")?.click();
}

export function LandioNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [walletState, setWalletState] = useState<{ address?: string; isConnected: boolean }>({
    isConnected: false,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only use wagmi hooks after mounting (client-side)
  useEffect(() => {
    if (!mounted) return;

    // Dynamic import wagmi to avoid SSR issues
    import("wagmi").then(({ useAccount }) => {
      // This won't work as hooks can't be called conditionally
      // Instead, we'll listen to wagmi state changes via a different approach
    }).catch(() => {});

    // Check for wallet state periodically or via custom event
    const checkWallet = () => {
      // Look for RainbowKit connect button state
      const btn = document.querySelector("[data-testid='rk-account-button']");
      if (btn) {
        const text = btn.textContent || "";
        if (text.includes("0x")) {
          setWalletState({ address: text, isConnected: true });
        }
      }
    };

    checkWallet();
    const interval = setInterval(checkWallet, 1000);
    return () => clearInterval(interval);
  }, [mounted]);

  const isLanding = pathname === "/";

  const links = isLanding
    ? [
        { href: "/#features", label: "Features" },
        { href: "/#pricing", label: "Pricing" },
        { href: "/blog", label: "Blog" },
        { href: "/contact", label: "Contact" },
      ]
    : [
        { href: "/swap", label: "Swap" },
        { href: "/rewards", label: "Rewards" },
        { href: "/status", label: "Status" },
        { href: "/settings", label: "Settings" },
      ];

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="logo">
          <div className="logo-icon">SP</div>
          SwapPilot
        </Link>

        <ul className="nav-links">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} style={!isLanding && isActive(link.href) ? { color: "var(--accent)" } : undefined}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="nav-right">
          {isLanding ? (
            <Link href="/swap" className="btn btn-primary">
              Launch App
            </Link>
          ) : (
            <button 
              className="btn btn-secondary" 
              onClick={triggerRainbowKitConnect}
              suppressHydrationWarning
            >
              {mounted && walletState.isConnected && walletState.address
                ? shortAddress(walletState.address)
                : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
