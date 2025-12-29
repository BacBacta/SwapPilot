import { CardLight } from "@/components/ui/surfaces";
import { Skeleton } from "@/components/ui/primitives";

function Row({ label, loading }: { label: string; loading?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-sp-lightBorder bg-sp-lightSurface px-3 py-3">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl border border-sp-lightBorder bg-sp-lightSurface2" />
        <div className="text-xs font-semibold text-sp-lightText">{label}</div>
      </div>
      {loading ? <Skeleton className="h-4 w-20" /> : <div className="text-xs font-extrabold text-sp-lightText">$13,300</div>}
    </div>
  );
}

export function FrameLoadingPartial() {
  return (
    <CardLight className="overflow-hidden">
      <div className="border-b border-sp-lightBorder bg-sp-lightSurface px-4 py-3">
        <div className="text-xs font-semibold text-sp-lightText">Loading / Partial Results</div>
      </div>

      <div className="p-4">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-[11px] text-yellow-700">
          Raw output ignores execution risk. Switch to BEQ for safety.
        </div>

        <div className="mt-3 grid gap-2">
          <Row label="Mail" loading />
          <Row label="Perch" loading />
          <Row label="PancakeSwap" loading />
          <Row label="KyberSwap" />
          <Row label="Parametrics" loading />
        </div>
      </div>
    </CardLight>
  );
}
