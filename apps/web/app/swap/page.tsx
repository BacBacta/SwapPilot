import { loadLandioTemplateCached as loadLandioTemplate } from "@/lib/landio/templates";
import { LandioTemplate } from "@/components/landio";
import { DynamicSwapController } from "@/components/landio/controllers/client-controllers";

export default async function Page() {
  const tpl = await loadLandioTemplate("swap.html");
  return <LandioTemplate {...tpl} after={<DynamicSwapController />} />;
}
