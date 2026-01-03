import { LandioTemplate } from "@/components/landio";
import { loadLandioTemplate } from "@/lib/landio/templates";

export default async function Page() {
  const tpl = await loadLandioTemplate("terms.html");
  return <LandioTemplate {...tpl} />;
}
