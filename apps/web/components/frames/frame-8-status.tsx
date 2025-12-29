import { CardDark } from "@/components/ui/surfaces";
import { Pill } from "@/components/ui/primitives";
import { statusProviders } from "@/lib/mock";

export function FrameStatusDashboard() {
  return (
    <CardDark className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-sp-border bg-sp-surface/90 px-4 py-3">
        <div className="text-xs font-semibold">SwapPilot</div>
        <Pill tone="accent">Status</Pill>
      </div>

      <div className="p-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-sp-border bg-white/5 p-3">
            <div className="text-[11px] text-sp-muted">API</div>
            <div className="mt-2 text-sm font-extrabold">88%</div>
            <div className="mt-2 text-[11px] text-sp-muted">Confidence in best routes</div>
          </div>
          <div className="rounded-lg border border-sp-border bg-white/5 p-3">
            <div className="text-[11px] text-sp-muted">Latency</div>
            <div className="mt-2 text-sm font-extrabold">20s</div>
            <div className="mt-2 text-[11px] text-sp-muted">Quote aggregation window</div>
          </div>
          <div className="rounded-lg border border-sp-border bg-white/5 p-3">
            <div className="text-[11px] text-sp-muted">RPC</div>
            <div className="mt-2 text-sm font-extrabold">3/4</div>
            <div className="mt-2 text-[11px] text-sp-muted">Quorum healthy</div>
          </div>
        </div>

        <div className="rounded-lg border border-sp-border bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold">Provider status & latency</div>
            <Pill>BNB</Pill>
          </div>
          <div className="mt-3 grid gap-2">
            {statusProviders.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-md border border-sp-border bg-sp-surface/60 px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${p.ok ? "bg-sp-ok" : "bg-sp-warn"}`} />
                  <div className="text-xs font-semibold">{p.name}</div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-sp-muted">
                  <span>{p.latencyMs}ms</span>
                  <span>•</span>
                  <span>{p.errPct.toFixed(1)}% err</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-sp-border bg-white/5 p-3">
          <div className="text-[11px] font-semibold">RPC endpoints</div>
          <div className="mt-2 grid gap-2 text-[11px] text-sp-muted">
            {["BNB public #1", "BNB public #2", "BNB private #1", "BNB private #2"].map((r, i) => (
              <div key={r} className="flex items-center justify-between rounded-md border border-sp-border bg-sp-surface/60 px-3 py-2">
                <span className="text-sp-text font-semibold">{r}</span>
                <span className={i === 2 ? "text-sp-warn" : "text-sp-ok"}>{i === 2 ? "degraded" : "ok"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CardDark>
  );
}
