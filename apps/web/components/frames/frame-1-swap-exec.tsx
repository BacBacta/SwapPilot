import { CardDark } from "@/components/ui/surfaces";
import { Button, Pill, Skeleton } from "@/components/ui/primitives";
import { Table, Row } from "@/components/ui/table";
import { bestExecutable } from "@/lib/mock";

function ProviderIcon({ name }: { name: string }) {
  return (
    <div className="h-8 w-8 rounded-xl border border-sp-border bg-white/5 grid place-items-center text-[10px] font-extrabold">
      {name.slice(0,2).toUpperCase()}
    </div>
  );
}

export function FrameSwapBestExecutable() {
  return (
    <CardDark className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-sp-border bg-sp-surface/90 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-sp-accent text-black font-extrabold grid place-items-center">SP</div>
          <div className="text-xs font-semibold">SwapPilot</div>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="accent">Best Executable</Pill>
          <Pill>BNB</Pill>
          <Button variant="soft" className="h-8 px-3">DeepLink</Button>
        </div>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        {/* Swap card */}
        <div className="rounded-lg border border-sp-border bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold">Swap Raw</div>
            <div className="flex gap-1">
              <Pill>Gas</Pill><Pill>Balanced</Pill><Pill tone="accent">Turbo</Pill>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            <div className="rounded-lg border border-sp-border bg-sp-surface/60 p-3">
              <div className="flex items-center justify-between text-[11px] text-sp-muted">
                <span>From</span><span>0.4%</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ProviderIcon name="BNB" />
                  <div className="text-xs font-semibold">BNB</div>
                </div>
                <div className="text-xs font-extrabold">$8,500</div>
              </div>
            </div>

            <div className="rounded-lg border border-sp-border bg-sp-surface/60 p-3">
              <div className="flex items-center justify-between text-[11px] text-sp-muted">
                <span>To</span><span>Auto</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ProviderIcon name="SOL" />
                  <div className="text-xs font-semibold">Token</div>
                </div>
                <div className="text-xs font-extrabold">$3,500</div>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-lg border border-sp-border bg-white/5 p-2 text-center text-sp-muted">
                Gas<br/><span className="text-sp-text font-semibold">$0.36</span>
              </div>
              <div className="rounded-lg border border-sp-border bg-white/5 p-2 text-center text-sp-muted">
                Slippage<br/><span className="text-sp-text font-semibold">1.2%</span>
              </div>
              <div className="rounded-lg border border-sp-border bg-white/5 p-2 text-center text-sp-muted">
                Mode<br/><span className="text-sp-text font-semibold">SAFE</span>
              </div>
            </div>

            <Button className="mt-2 h-9 rounded-md">Smartest Execution</Button>
          </div>

          <div className="mt-3 text-[11px] text-sp-muted2 leading-4">
            BEQ-first routing with sellability + MEV heuristics. Option 1: deep-link only.
          </div>
        </div>

        {/* Best providers */}
        <div className="rounded-lg border border-sp-border bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold">Best Providers</div>
            <Pill tone="accent">BEQ</Pill>
          </div>
          <div className="mt-3">
            <Table>
              {bestExecutable.map((q, i) => (
                <Row
                  key={q.provider}
                  className={i === 0 ? "border-sp-accent/35 bg-sp-accent/10" : ""}
                  left={
                    <div className="flex items-center gap-3">
                      <ProviderIcon name={q.provider} />
                      <div>
                        <div className="text-xs font-semibold">{q.provider}</div>
                        <div className="mt-1 flex gap-1">
                          <Pill tone={q.confidence >= 90 ? "ok" : "warn"}>{q.confidence}/100</Pill>
                          {q.flags.includes("MEV") ? <Pill tone="warn">MEV</Pill> : <Pill tone="ok">Low MEV</Pill>}
                        </div>
                      </div>
                    </div>
                  }
                  right={
                    <div className="text-right">
                      <div className="text-xs font-extrabold">${q.outUsd.toLocaleString()}</div>
                      <div className="mt-1 text-[11px] text-sp-muted">{q.deltaPct?.toFixed(1)}%</div>
                    </div>
                  }
                />
              ))}
              <Row
                left={
                  <div className="flex items-center gap-3">
                    <ProviderIcon name="More" />
                    <div>
                      <div className="text-xs font-semibold">More providers</div>
                      <div className="text-[11px] text-sp-muted">Tap to expand</div>
                    </div>
                  </div>
                }
                right={<Skeleton className="h-4 w-16" />}
              />
            </Table>
          </div>
        </div>
      </div>
    </CardDark>
  );
}
