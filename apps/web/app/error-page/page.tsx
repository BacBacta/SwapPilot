import { AppShellLight } from "@/components/ui/surfaces";
import { FrameErrorState } from "@/components/frames/frame-9-error";

export default function Page() {
  return (
    <AppShellLight>
      <div className="mt-20 mx-auto max-w-xl">
        <FrameErrorState />
      </div>
    </AppShellLight>
  );
}
