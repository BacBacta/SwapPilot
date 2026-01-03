import { LandioTemplate } from "@/components/landio";
import { loadLandioTemplate } from "@/lib/landio/templates";

export default async function Page() {
  const tpl = await loadLandioTemplate("blog.html");
  return <LandioTemplate {...tpl} />;
}
