import { AppShellDark } from "@/components/ui/surfaces";
import { TopbarDark } from "@/components/ui/topbar";
import { FrameProviderInfo } from "@/components/frames/frame-7-provider-info";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShellDark>
      <TopbarDark active="Providers" />
      <div className="mt-6">
        <FrameProviderInfo />
        <div className="mt-3 text-xs text-sp-muted">Provider route param: {id}</div>
      </div>
    </AppShellDark>
  );
}
