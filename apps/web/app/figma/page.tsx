import Link from "next/link";
import { AppShellLight } from "@/components/ui/surfaces";
import { FrameTitle } from "@/components/frames/frame-title";
import { FrameSwapBestExecutable } from "@/components/frames/frame-1-swap-exec";
import { FrameSwapBestRaw } from "@/components/frames/frame-2-swap-raw";
import { FrameLoadingPartial } from "@/components/frames/frame-3-loading";
import { FrameDecisionReceipt } from "@/components/frames/frame-4-receipt";
import { FrameTokenPicker } from "@/components/frames/frame-5-token-picker";
import { FrameSettingsPanel } from "@/components/frames/frame-6-settings";
import { FrameProviderInfo } from "@/components/frames/frame-7-provider-info";
import { FrameStatusDashboard } from "@/components/frames/frame-8-status";
import { FrameErrorState } from "@/components/frames/frame-9-error";
import { FrameMobileSwap } from "@/components/frames/frame-10-mobile";

export default function Page() {
  return (
    <AppShellLight>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold text-sp-lightText">SwapPilot — Figma Gallery</div>
          <div className="mt-1 text-sm text-sp-lightMuted">10 templates, implemented as reusable components.</div>
        </div>
        <div className="flex gap-2">
          <Link className="rounded-full border border-sp-lightBorder bg-sp-lightSurface2 px-4 py-2 text-xs font-semibold text-sp-lightText" href="/swap">
            Open Swap
          </Link>
          <Link className="rounded-full border border-sp-lightBorder bg-sp-lightSurface2 px-4 py-2 text-xs font-semibold text-sp-lightText" href="/">
            Home
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        <section>
          <FrameTitle n={1} title="Swap — Best Executable" />
          <FrameSwapBestExecutable />
        </section>

        <section>
          <FrameTitle n={2} title="Swap — Best Raw Output" />
          <FrameSwapBestRaw />
        </section>

        <section>
          <FrameTitle n={3} title="Loading / Partial Results" />
          <FrameLoadingPartial />
        </section>

        <section>
          <FrameTitle n={4} title="Decision Receipt" />
          <FrameDecisionReceipt />
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div>
            <FrameTitle n={5} title="Token Picker Modal" />
            <FrameTokenPicker />
          </div>
          <div>
            <FrameTitle n={6} title="Settings Panel" />
            <FrameSettingsPanel />
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div>
            <FrameTitle n={7} title="Provider Info Page" />
            <FrameProviderInfo />
          </div>
          <div>
            <FrameTitle n={8} title="Status Dashboard" />
            <FrameStatusDashboard />
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div>
            <FrameTitle n={9} title="Error State" />
            <FrameErrorState />
          </div>
          <div>
            <FrameTitle n={10} title="Mobile Swap View" />
            <FrameMobileSwap />
          </div>
        </section>
      </div>
    </AppShellLight>
  );
}
