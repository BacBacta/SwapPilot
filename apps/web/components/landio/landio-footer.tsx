"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function LandioFooter() {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  // For app pages (swap, rewards, etc.), use minimal footer
  if (!isLanding) {
    return (
      <footer className="footer" style={{ marginTop: 60 }}>
        <div className="container">
          <div className="footer-bottom" style={{ borderTop: "none", paddingTop: 0 }}>
            <div>© 2026 SwapPilot. All rights reserved.</div>
            <div>
              <Link href="/privacy" style={{ color: "var(--text-muted)", marginRight: 16 }}>
                Privacy
              </Link>
              <Link href="/terms" style={{ color: "var(--text-muted)" }}>
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  // For landing page, use full footer
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="logo">
              <div className="logo-icon">SP</div>
              SwapPilot
            </Link>
            <p>
              The smartest DEX aggregator on BNB Chain. Compare, score, and execute trades with
              confidence.
            </p>
            <div className="footer-social">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">𝕏</a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">📘</a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">📷</a>
              <a href="https://discord.gg" target="_blank" rel="noopener noreferrer">💬</a>
            </div>
          </div>
          <div className="footer-column">
            <h4>Product</h4>
            <ul>
              <li><a href="#services">Services</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/blog">Blog</Link></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Resources</h4>
            <ul>
              <li><a href="#services">Services</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/blog">Blog</Link></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Legal</h4>
            <ul>
              <li><Link href="/privacy">Privacy</Link></li>
              <li><Link href="/terms">Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-bottom-left">
            <span>© 2026 SwapPilot Template</span>
            <span>Made by <a href="#">SwapPilot Team</a></span>
          </div>
          <div className="footer-bottom-right">
            <span>support@swappilot.io</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
