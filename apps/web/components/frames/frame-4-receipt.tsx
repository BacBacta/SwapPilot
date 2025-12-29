import { CardLight, CardDark } from "@/components/ui/surfaces";
import { Button, Pill } from "@/components/ui/primitives";

export function FrameDecisionReceipt() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Light receipt */}
      <CardLight className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-sp-lightText">Decision Receipt</div>
            <div className="mt-1 text-[11px] text-sp-lightMuted">Why this quote won (explainability)</div>
          </div>
          <Pill tone="blue">Receipt</Pill>
        </div>

        <div className="mt-3 rounded-lg border border-sp-lightBorder bg-sp-lightSurface2 p-3">
          <div className="flex items-center justify-between text-[11px] text-sp-lightMuted">
            <span>Selected provider</span>
            <span className="font-semibold text-sp-lightText">Adalis</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill tone="ok">Gas estimated</Pill>
            <Pill tone="ok">Best feasible</Pill>
            <Pill tone="warn">MEV-aware</Pill>
          </div>
        </div>

        <div className="mt-3">
          <div className="text-[11px] font-semibold text-sp-lightText">Why this quote won</div>
          <ul className="mt-2 list-disc pl-5 text-[11px] text-sp-lightMuted space-y-1">
            <li>Sell provider preflight passed</li>
            <li>Lower revert probability under slippage</li>
            <li>Ranking based on BEQ (risk-adjusted)</li>
          </ul>
        </div>

        <div className="mt-3 rounded-lg border border-sp-lightBorder bg-sp-lightSurface p-3">
          <div className="text-[11px] font-semibold text-sp-lightText">Comparison (normalized)</div>
          <div className="mt-2 grid gap-2 text-[11px] text-sp-lightMuted">
            {["SwapPilot", "OKX", "1inch", "PancakeSwap"].map((p) => (
              <div key={p} className="flex items-center justify-between rounded-md border border-sp-lightBorder bg-sp-lightSurface2 px-3 py-2">
                <span className="font-semibold text-sp-lightText">{p}</span>
                <span>$0.39 • 0.8%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="soft">Copy JSON</Button>
          <Button className="bg-blue-600 text-white hover:brightness-95">Download</Button>
        </div>
      </CardLight>

      {/* Dark receipt panel */}
      <CardDark className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold">SwapPilot</div>
          <Pill tone="accent">Receipt</Pill>
        </div>
        <div className="mt-3 rounded-lg border border-sp-border bg-white/5 p-3">
          <div className="flex items-center justify-between text-[11px] text-sp-muted">
            <span>Sources</span><span className="text-sp-text font-semibold">34.86 max</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-sp-muted">
            <span>Return</span><span className="text-sp-text font-semibold">$11.30</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-sp-muted">
            <span>Best raw</span><span className="text-sp-text font-semibold">$13.20</span>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-sp-border bg-white/5 p-3">
          <div className="text-[11px] font-semibold">Compared providers</div>
          <div className="mt-2 grid gap-2 text-[11px] text-sp-muted">
            {["PancakeSwap", "1inch", "KyberSwap", "OKX"].map(p => (
              <div key={p} className="flex items-center justify-between rounded-md border border-sp-border bg-sp-surface/60 px-3 py-2">
                <span className="text-sp-text font-semibold">{p}</span>
                <span className="text-sp-ok font-semibold">+2.3%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <Button className="h-9 w-full">Continue</Button>
        </div>
      </CardDark>
    </div>
  );
}
