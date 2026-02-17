import { LandioTemplate } from "@/components/landio";
import { loadLandioTemplateCached as loadLandioTemplate } from "@/lib/landio/templates";
import { DynamicSettingsController } from "@/components/landio/controllers/client-controllers";

export default async function Page() {
  const tpl = await loadLandioTemplate("settings.html");
  return <LandioTemplate {...tpl} after={<DynamicSettingsController />} />;
}
