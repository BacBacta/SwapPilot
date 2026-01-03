"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function LandioNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
          ) : mounted ? (
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                mounted: rkMounted,
              }) => {
                const connected = rkMounted && account && chain;

                return (
                  <div
                    {...(!rkMounted && {
                      "aria-hidden": true,
                      style: {
                        opacity: 0,
                        pointerEvents: "none",
                        userSelect: "none",
                      },
                    })}
                  >
                    {(() => {
                      if (!connected) {
                        return (
                          <button onClick={openConnectModal} className="btn btn-secondary">
                            Connect Wallet
                          </button>
                        );
                      }

                      if (chain.unsupported) {
                        return (
                          <button onClick={openChainModal} className="btn btn-secondary" style={{ color: "var(--bad)" }}>
                            Wrong network
                          </button>
                        );
                      }

                      return (
                        <button onClick={openAccountModal} className="btn btn-secondary">
                          {shortAddress(account.address)}
                        </button>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          ) : (
            <button className="btn btn-secondary">Connect Wallet</button>
          )}
        </div>
      </div>
    </nav>
  );
}
