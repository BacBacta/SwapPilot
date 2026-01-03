import type { ReactNode } from "react";

export function LandioTemplate({ inlineCss, bodyHtml, after }: { inlineCss?: string; bodyHtml: string; after?: ReactNode }) {
  return (
    <>
      {inlineCss ? <style dangerouslySetInnerHTML={{ __html: inlineCss }} /> : null}
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      {after ?? null}
    </>
  );
}
