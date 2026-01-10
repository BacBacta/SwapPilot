import { loadLandioTemplate } from "@/lib/landio/templates";
import { LandioTemplate } from "@/components/landio";
import { DynamicHomeController } from "@/components/landio/controllers/client-controllers";

// Force dynamic rendering to always load fresh template content
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const tpl = await loadLandioTemplate("index.html");
  return <LandioTemplate inlineCss={tpl.inlineCss} bodyHtml={tpl.bodyHtml} after={<DynamicHomeController />} />;
}
