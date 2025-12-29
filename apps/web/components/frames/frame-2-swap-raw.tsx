import { CardLight } from "@/components/ui/surfaces";
import { Pill } from "@/components/ui/primitives";
import { bestRaw } from "@/lib/mock";

function Icon({ name }: { name: string }) {
  return (
    <div className="h-8 w-8 rounded-xl border border-sp-lightBorder bg-sp-lightSurface2 grid place-items-center text-[10px] font-extrabold text-sp-lightText">
      {name.slice(0,2).toUpperCase()}
    </div>
  );
}

export function FrameSwapBestRaw() {
  return (
    <CardLight className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-sp-lightBorder bg-sp-lightSurface px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-sp-accent text-black font-extrabold grid place-items-center">SP</div>
          <div className="text-xs font-semibold text-sp-lightText">SwapPilot</div>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="blue">Best Raw</Pill>
          (This tab ignores execution risk)
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-sp-lightText">Best Raw</div>
          <div className="flex gap-2">
            <span className="rounded-full border border-sp-lightBorder bg-sp-lightSurface2 px-3 py-1 text-[11px] text-sp-lightMuted">Sort: Price</span>
            <span className="rounded-full border border-sp-lightBorder bg-sp-lightSurface2 px-3 py-1 text-[11px] text-sp-lightMuted">BEQ ↔ RAW</span>
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          {bestRaw.map((q) => (
            <div key={q.provider} className="flex items-center justify-between rounded-lg border border-sp-lightBorder bg-sp-lightSurface px-3 py-3 shadow-soft">
              <div className="flex items-center gap-3">
                <Icon name={q.provider} />
                <div>
                  <div className="text-xs font-semibold text-sp-lightText">{q.provider}</div>
                  <div className="mt-1 text-[11px] text-sp-lightMuted">
                    Confidence {q.confidence}/100 • {q.flags.includes("MEV") ? "MEV risk" : "normal"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-extrabold text-sp-lightText">${q.outUsd.toLocaleString()}</div>
                <div className="mt-1 text-[11px] text-emerald-600">{q.deltaPct?.toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardLight>
  );
}
