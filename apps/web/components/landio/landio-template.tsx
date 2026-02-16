import type { ReactNode } from "react";
import { LandioNav } from "./landio-nav";
import { Suspense } from "react";
import Link from "next/link";

/**
 * Sanitize HTML by stripping <script>, on* event handlers, javascript: URIs,
 * and other dangerous patterns. This is a defense-in-depth measure for
 * server-rendered HTML that originates from static build artifacts.
 */
function sanitizeHtml(html: string): string {
  return html
    // Remove <script>...</script> blocks (including multi-line)
    .replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
    // Remove standalone <script> tags
    .replace(/<script[^>]*\/?>/gi, '')
    // Remove on* event handler attributes (onclick, onerror, onload, etc.)
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Remove javascript: URIs in href/src/action
    .replace(/(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1=""')
    // Remove data: URIs in src (potential XSS via data:text/html)
    .replace(/src\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi, 'src=""');
}

// Static SSR fallback navigation - shown instantly while JS loads
function NavFallback() {
  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      <div className="nav-inner">
        <Link href="/" className="logo" aria-label="SwapPilot - Home">
          <div className="logo-icon">SP</div>
          <span className="logo-text">SwapPilot</span>
        </Link>
        <ul className="nav-links" role="menubar">
          <li role="none"><Link href="/#services" role="menuitem">Services</Link></li>
          <li role="none"><Link href="/#integrations" role="menuitem">Integrations</Link></li>
          <li role="none"><Link href="/#faq" role="menuitem">FAQ</Link></li>
        </ul>
        <div className="nav-right">
          <Link href="/swap" className="btn btn-primary btn-cta">Launch App</Link>
        </div>
      </div>
    </nav>
  );
}

export function LandioTemplate({ inlineCss, bodyHtml, after }: { inlineCss?: string; bodyHtml: string; after?: ReactNode }) {
  // Sanitize HTML inputs to prevent XSS (H-1 DappBay audit)
  const safeBodyHtml = sanitizeHtml(bodyHtml);
  const safeCss = inlineCss ? sanitizeHtml(inlineCss) : undefined;

  return (
    <>
      {safeCss ? <style dangerouslySetInnerHTML={{ __html: safeCss }} /> : null}
      <Suspense fallback={<NavFallback />}>
        <LandioNav />
      </Suspense>
      <div dangerouslySetInnerHTML={{ __html: safeBodyHtml }} />
      {after ?? null}
    </>
  );
}
