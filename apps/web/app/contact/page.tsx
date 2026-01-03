import { LandioTemplate } from "@/components/landio";
import { loadLandioTemplate } from "@/lib/landio/templates";

export default async function Page() {
  const tpl = await loadLandioTemplate("contact.html");
  return <LandioTemplate {...tpl} />;
}
