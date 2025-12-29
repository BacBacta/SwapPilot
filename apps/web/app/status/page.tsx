import { FrameStatusDashboard } from "@/components/frames/frame-8-status";

export default function Page() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-h1 font-bold text-sp-text">Status</h1>
      <p className="mt-1 text-caption text-sp-muted">Monitor your swaps and system health</p>
      <div className="mt-6">
        <FrameStatusDashboard />
      </div>
    </div>
  );
}
