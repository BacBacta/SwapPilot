import { Pill } from "./primitives";

export function TopbarDark({
  active = "Swap",
}: {
  active?: "Swap" | "Status" | "Providers" | "Settings";
}) {
  const nav = [
    { label: "Swap", href: "/swap" },
    { label: "Status", href: "/status" },
    { label: "Providers", href: "/providers/1inch" },
    { label: "Settings", href: "/settings" },
  ] as const;

  return (
    <div className="flex items-center justify-between gap-4">
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
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              active === n.label ? "border-sp-accent/35 bg-sp-accent/10 text-sp-text" : "border-sp-border bg-white/5 text-sp-muted hover:text-sp-text"
            }`}
          >
            {n.label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Pill tone="accent">BNB</Pill>
        <Pill>Wallet</Pill>
      </div>
    </div>
  );
}
