import { LandioTemplate } from "@/components/landio";
import { loadLandioTemplate } from "@/lib/landio/templates";
import { DynamicRewardsController } from "@/components/landio/controllers/client-controllers";

export default async function Page() {
  const tpl = await loadLandioTemplate("rewards.html");

  return <LandioTemplate {...tpl} after={<DynamicRewardsController />} />;
}
