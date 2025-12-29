import { CardDark } from "@/components/ui/surfaces";
import { Pill } from "@/components/ui/primitives";
import { Table, Row } from "@/components/ui/table";

export function FrameProviderInfo() {
  return (
    <CardDark className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-sp-border bg-sp-surface/90 px-4 py-3">
        <div className="text-xs font-semibold">1inch DEX Aggregator</div>
        <Pill tone="accent">Provider</Pill>
      </div>

      <div className="p-4 grid gap-3">
        <div className="rounded-lg border border-sp-border bg-white/5 p-3">
          <div className="text-[11px] text-sp-muted">Capabilities</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill tone="ok">Quote</Pill>
            <Pill tone="warn">Tx build (later)</Pill>
            <Pill>Deep-link</Pill>
          </div>
        </div>

        <div className="rounded-lg border border-sp-border bg-white/5 p-3">
          <div className="text-[11px] font-semibold">Provider status</div>
          <div className="mt-2 text-[11px] text-sp-muted">Latency & success rates (last 24h)</div>
          <div className="mt-3">
            <Table>
              <Row left={<div className="text-xs font-semibold">SwapPilot</div>} right={<Pill tone="ok">+1.5%</Pill>} />
              <Row left={<div className="text-xs font-semibold">PancakeSwap</div>} right={<Pill tone="ok">+1.1%</Pill>} />
              <Row left={<div className="text-xs font-semibold">KyberSwap</div>} right={<Pill tone="warn">-0.8%</Pill>} />
            </Table>
          </div>
        </div>

        <div className="rounded-lg border border-sp-border bg-white/5 p-3">
          <div className="text-[11px] font-semibold">Recent links</div>
          <div className="mt-2 grid gap-2 text-[11px] text-sp-muted">
            <div className="rounded-md border border-sp-border bg-sp-surface/60 px-3 py-2">Docs</div>
            <div className="rounded-md border border-sp-border bg-sp-surface/60 px-3 py-2">API status</div>
            <div className="rounded-md border border-sp-border bg-sp-surface/60 px-3 py-2">Changelog</div>
          </div>
        </div>
      </div>
    </CardDark>
  );
}
