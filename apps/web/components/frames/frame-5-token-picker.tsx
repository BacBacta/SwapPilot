import { CardLight } from "@/components/ui/surfaces";

const rows = [
  { name: "Bluechip", best: "$12,900", fee: "$3.70", sell: "$3,800" },
  { name: "Stable", best: "$12,000", fee: "$3.80", sell: "$4,000" },
  { name: "SwapFlash", best: "$12,000", fee: "$3.90", sell: "$3,900" },
  { name: "Frontrunning", best: "$19,000", fee: "$3.70", sell: "$2,000" },
];

export function FrameTokenPicker() {
  return (
    <CardLight className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-sp-lightBorder bg-sp-lightSurface px-4 py-3">
        <div className="text-xs font-semibold text-sp-lightText">Token Picker Modal</div>
        <div className="flex gap-2">
          <span className="rounded-full border border-sp-lightBorder bg-sp-lightSurface2 px-3 py-1 text-[11px] text-sp-lightMuted">Search</span>
          <span className="rounded-full border border-sp-lightBorder bg-sp-lightSurface2 px-3 py-1 text-[11px] text-sp-lightMuted">Chain</span>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-4 gap-2 text-[11px] text-sp-lightMuted">
          <div className="rounded-full border border-sp-lightBorder bg-sp-lightSurface2 px-3 py-1 text-center font-semibold text-sp-lightText">Swap</div>
          <div className="rounded-full border border-sp-lightBorder bg-sp-lightSurface2 px-3 py-1 text-center">Stable</div>
          <div className="rounded-full border border-sp-lightBorder bg-sp-lightSurface2 px-3 py-1 text-center">Recent</div>
          <div className="rounded-full border border-sp-lightBorder bg-sp-lightSurface2 px-3 py-1 text-center">Custom</div>
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-sp-lightBorder">
          <div className="grid grid-cols-4 bg-sp-lightSurface2 px-3 py-2 text-[11px] font-semibold text-sp-lightMuted">
            <div>Token</div><div className="text-right">Best</div><div className="text-right">Fee</div><div className="text-right">Sell</div>
          </div>
          {rows.map((r) => (
            <div key={r.name} className="grid grid-cols-4 border-t border-sp-lightBorder bg-sp-lightSurface px-3 py-3 text-[11px] text-sp-lightText">
              <div className="font-semibold">{r.name}</div>
              <div className="text-right font-extrabold">{r.best}</div>
              <div className="text-right text-sp-lightMuted">{r.fee}</div>
              <div className="text-right font-extrabold text-emerald-600">{r.sell}</div>
            </div>
          ))}
        </div>
      </div>
    </CardLight>
  );
}
