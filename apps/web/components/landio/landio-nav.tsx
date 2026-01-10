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
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check initial scroll position
    setScrolled(window.scrollY > 20);
    
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  
  // Always render the navigation structure - never return null
  // Only wallet-related features depend on `mounted` state

  // Mobile UX: lock background scroll while menu is open
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  const isLanding = pathname === "/";

  const links = isLanding
    ? [
        { href: "/#services", label: "Services" },
        { href: "/#integrations", label: "Integrations" },
        { href: "/#faq", label: "FAQ" },
      ]
    : [
        { href: "/swap", label: "Swap" },
        { href: "/rewards", label: "Rewards" },
        { href: "/status", label: "Status" },
      ];

  const isActive = (href: string) => pathname === href;

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      {mobileMenuOpen && (
        <div
          className="mobile-menu-backdrop"
          aria-hidden="true"
          onClick={closeMobileMenu}
        />
      )}
      <nav 
        className={`nav ${scrolled ? "nav-scrolled" : ""}`}
        role="navigation"
        aria-label="Main navigation"
      >
      <div className="nav-inner">
        {/* Logo */}
        <Link href="/" className="logo" aria-label="SwapPilot - Home">
          <div className="logo-icon">SP</div>
          <span className="logo-text">SwapPilot</span>
        </Link>

        {/* Desktop Navigation */}
        <ul className="nav-links" role="menubar">
          {links.map((link) => (
            <li key={link.href} role="none">
              <Link 
                href={link.href}
                role="menuitem"
                className={!isLanding && isActive(link.href) ? "active" : undefined}
                onClick={closeMobileMenu}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right Section */}
        <div className="nav-right">
          {/* Network Badge - visible on app pages */}
          {!isLanding && (
            <div className="network-badge" title="Connected to BNB Chain">
              <span className="network-dot"></span>
              <span className="network-name">BNB Chain</span>
            </div>
          )}

          {/* CTA Button - always visible */}
          {isLanding ? (
            <Link href="/swap" className="btn btn-primary btn-cta">
              Launch App
              <svg className="btn-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
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
                          <button onClick={openConnectModal} className="btn btn-primary btn-cta">
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
                        <button onClick={openAccountModal} className="btn btn-secondary btn-wallet">
                          <span className="wallet-dot"></span>
                          {shortAddress(account.address)}
                        </button>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          ) : (
            <button className="btn btn-primary btn-cta" disabled>
              Connect Wallet
            </button>
          )}

          {/* Mobile Menu Button */}
          <button 
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            <span className={`hamburger ${mobileMenuOpen ? "open" : ""}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${mobileMenuOpen ? "open" : ""}`} role="menu">
        <ul>
          {links.map((link) => (
            <li key={link.href} role="none">
              <Link 
                href={link.href}
                role="menuitem"
                onClick={closeMobileMenu}
              >
                {link.label}
              </Link>
            </li>
          ))}
          {isLanding && (
            <li role="none">
              <Link href="/swap" className="btn btn-primary" onClick={closeMobileMenu}>
                Launch App
              </Link>
            </li>
          )}
        </ul>
      </div>
      </nav>
    </>
  );
}
