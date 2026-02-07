import { Pill } from "./primitives";
import { cn } from "@/lib/cn";

export function TopbarDark({
  active = "Swap",
}: {
  active?: "Swap" | "Status" | "Providers";
}) {
  const nav = [
    { label: "Swap", href: "/swap" },
    { label: "Status", href: "/status" },
    { label: "Providers", href: "/providers/1inch" },
  ] as const;

  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl border border-sp-border bg-sp-surface/80 px-5 py-3 shadow-softDark backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-sp-accent text-black font-extrabold grid place-items-center shadow-softDark">
          SP
        </div>
        <div>
          <div className="text-sm font-semibold leading-4">SwapPilot</div>
          <div className="text-[11px] text-sp-muted">BNB • BEQ-first</div>
        </div>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        {nav.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
              active === n.label
                ? "border-sp-accent/35 bg-sp-accent/10 text-sp-text"
                : "border-sp-border bg-white/5 text-sp-muted hover:border-sp-borderHover hover:text-sp-text"
            )}
          >
            {n.label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-sp-border bg-white/5 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-sp-ok shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          <span className="text-[11px] text-sp-muted">Network OK</span>
        </div>
        <Pill tone="accent">BNB</Pill>
        <a
          href="/status"
          className="rounded-full border border-sp-border bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-sp-muted transition-all hover:border-sp-borderHover hover:text-sp-text"
        >
          Status
        </a>
      </div>
    </div>
  );
}
