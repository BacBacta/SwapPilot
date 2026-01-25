import { LandioTemplate } from "@/components/landio";
import { DynamicAnalyticsController } from "@/components/landio/controllers/client-controllers";
import { loadLandioTemplate } from "@/lib/landio/templates";

export default async function Page() {
  const tpl = await loadLandioTemplate("analytics.html");
  return <LandioTemplate {...tpl} after={<DynamicAnalyticsController />} />;
}
