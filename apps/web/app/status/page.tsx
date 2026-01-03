import { LandioTemplate } from "@/components/landio";
import { loadLandioTemplate } from "@/lib/landio/templates";
import { DynamicStatusController } from "@/components/landio/controllers/client-controllers";

export default async function Page() {
  const tpl = await loadLandioTemplate("status.html");
  return <LandioTemplate {...tpl} after={<DynamicStatusController />} />;
}
