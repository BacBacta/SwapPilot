import type { ReactNode } from "react";
import { LandioNav } from "./landio-nav";
import { Suspense } from "react";

// Static SSR fallback navigation - shown instantly while JS loads
function NavFallback() {
  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      <div className="nav-inner">
        <a href="/" className="logo" aria-label="SwapPilot - Home">
          <div className="logo-icon">SP</div>
          <span className="logo-text">SwapPilot</span>
        </a>
        <ul className="nav-links" role="menubar">
          <li role="none"><a href="/#services" role="menuitem">Services</a></li>
          <li role="none"><a href="/#integrations" role="menuitem">Integrations</a></li>
          <li role="none"><a href="/#faq" role="menuitem">FAQ</a></li>
        </ul>
        <div className="nav-right">
          <a href="/swap" className="btn btn-primary btn-cta">Launch App</a>
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
