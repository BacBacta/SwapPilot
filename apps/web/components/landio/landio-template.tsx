import type { ReactNode } from "react";
import { LandioNav } from "./landio-nav";
import { Suspense } from "react";
import Link from "next/link";

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
  return (
    <>
      {inlineCss ? <style dangerouslySetInnerHTML={{ __html: inlineCss }} /> : null}
      <Suspense fallback={<NavFallback />}>
        <LandioNav />
      </Suspense>
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      {after ?? null}
    </>
  );
}
