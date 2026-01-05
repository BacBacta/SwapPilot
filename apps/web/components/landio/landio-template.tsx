import type { ReactNode } from "react";
import { LandioNav } from "./landio-nav";

export function LandioTemplate({ inlineCss, bodyHtml, after }: { inlineCss?: string; bodyHtml: string; after?: ReactNode }) {
  return (
    <>
      {inlineCss ? <style dangerouslySetInnerHTML={{ __html: inlineCss }} /> : null}
      <LandioNav />
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      {after ?? null}
    </>
  );
}
