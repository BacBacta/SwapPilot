import { LandioTemplate } from "@/components/landio";
import { loadLandioTemplateCached as loadLandioTemplate } from "@/lib/landio/templates";

export default async function Page() {
  const tpl = await loadLandioTemplate("blog.html");
  return <LandioTemplate {...tpl} />;
}
