import { CardDark } from "@/components/ui/surfaces";
import { Button, Pill } from "@/components/ui/primitives";

function Phone({ title }: { title: string }) {
  return (
    <div className="relative h-[520px] w-[260px] overflow-hidden rounded-[30px] border border-sp-border bg-sp-surface shadow-softDark">
      <div className="absolute left-1/2 top-2 h-5 w-28 -translate-x-1/2 rounded-full bg-black/35 border border-white/10" />
      <div className="flex items-center justify-between px-4 py-3 border-b border-sp-border bg-sp-surface/90">
        <div className="text-xs font-semibold">{title}</div>
        <Pill tone="accent">BNB</Pill>
      </div>
      <div className="p-4 grid gap-3">
        <div className="rounded-lg border border-sp-border bg-white/5 p-3">
          <div className="flex items-center justify-between text-[11px] text-sp-muted">
            <span>From</span><span>SAFE</span>
          </div>
          <div className="mt-2 text-sm font-extrabold">$8,500</div>
        </div>
        <div className="rounded-lg border border-sp-border bg-white/5 p-3">
          <div className="flex items-center justify-between text-[11px] text-sp-muted">
            <span>To</span><span>BEQ</span>
          </div>
          <div className="mt-2 text-sm font-extrabold">$3,500</div>
        </div>
        <div className="rounded-lg border border-sp-border bg-white/5 p-3">
          <div className="text-[11px] font-semibold">Top providers</div>
          <div className="mt-2 grid gap-2 text-[11px] text-sp-muted">
            <div className="flex justify-between"><span>PancakeSwap</span><span className="text-sp-ok">+1.2%</span></div>
            <div className="flex justify-between"><span>1inch</span><span className="text-sp-warn">-0.6%</span></div>
            <div className="flex justify-between"><span>OKX</span><span className="text-sp-ok">+0.4%</span></div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 border-t border-sp-border bg-sp-surface/95 p-3">
        <Button className="h-9 w-full rounded-md">Smartest Execution</Button>
      </div>
    </div>
  );
}

export function FrameMobileSwap() {
  return (
    <CardDark className="p-4">
      <div className="text-xs font-semibold">Mobile Swap View</div>
      <div className="mt-3 flex flex-wrap gap-4">
        <Phone title="SwapPilot" />
        <Phone title="SwapPilot" />
      </div>
    </CardDark>
  );
}
