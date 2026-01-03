import { loadLandioTemplate } from "@/lib/landio/templates";
import { LandioTemplate } from "@/components/landio";

export default async function HomePage() {
  const tpl = await loadLandioTemplate("index.html");
  return <LandioTemplate inlineCss={tpl.inlineCss} bodyHtml={tpl.bodyHtml} />;
}
