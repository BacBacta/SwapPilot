import { FrameSettingsPanel } from "@/components/frames/frame-6-settings";

export default function Page() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-h1 font-bold text-sp-text">Settings</h1>
      <p className="mt-1 text-caption text-sp-muted">Slippage, safety checks, and scoring</p>
      <div className="mt-6 max-w-3xl">
        <FrameSettingsPanel />
      </div>
    </div>
  );
}
