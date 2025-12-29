import Link from "next/link";
import { AppShellLight } from "@/components/ui/surfaces";
import { FrameSwapBestExecutable } from "@/components/frames/frame-1-swap-exec";
import { FrameSwapImproved } from "@/components/frames/frame-swap-improved";

export default function ComparePage() {
  return (
    <AppShellLight>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-sp-lightText">UI Comparison</h1>
          <p className="mt-1 text-body text-sp-lightMuted">
            Before vs After - Improvements based on market analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/figma"
            className="rounded-xl border border-sp-lightBorder bg-sp-lightSurface px-4 py-2 text-caption font-semibold text-sp-lightText transition hover:bg-sp-lightSurface2"
          >
            Figma Gallery
          </Link>
          <Link
            href="/swap"
            className="rounded-xl bg-sp-accent px-4 py-2 text-caption font-bold text-black transition hover:brightness-95"
          >
            Open Swap
          </Link>
        </div>
      </div>

      {/* Improvement highlights */}
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        {[
          { label: "Typography", before: "4/10", after: "8/10", delta: "+100%" },
          { label: "Token Inputs", before: "3/10", after: "8/10", delta: "+166%" },
          { label: "Interactivity", before: "4/10", after: "8/10", delta: "+100%" },
          { label: "Contrast", before: "5/10", after: "8/10", delta: "+60%" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-sp-lightBorder bg-sp-lightSurface p-4"
          >
            <div className="text-micro text-sp-lightMuted">{item.label}</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-caption text-sp-lightMuted line-through">{item.before}</span>
              <span className="text-h2 font-bold text-sp-lightText">{item.after}</span>
              <span className="text-caption font-semibold text-emerald-600">{item.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Before section */}
      <section className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-lg bg-red-100 px-3 py-1 text-caption font-semibold text-red-700">
            BEFORE
          </span>
          <span className="text-body text-sp-lightMuted">Original design</span>
        </div>
        <div className="rounded-2xl border-2 border-dashed border-red-200 p-4">
          <FrameSwapBestExecutable />
        </div>
      </section>

      {/* After section */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-lg bg-emerald-100 px-3 py-1 text-caption font-semibold text-emerald-700">
            AFTER
          </span>
          <span className="text-body text-sp-lightMuted">Improved design</span>
        </div>
        <div className="rounded-2xl border-2 border-dashed border-emerald-200 p-4">
          <FrameSwapImproved />
        </div>
      </section>

      {/* Key improvements list */}
      <section className="mt-8 rounded-xl border border-sp-lightBorder bg-sp-lightSurface p-6">
        <h2 className="text-h2 text-sp-lightText">Key Improvements</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            {
              title: "Professional Typography Scale",
              desc: "5 distinct sizes (display/h1/h2/body/caption/micro) with proper hierarchy",
            },
            {
              title: "Modern Token Input",
              desc: "Large input fields, real token icons, MAX button, USD conversion, focus states",
            },
            {
              title: "Interactive Feedback",
              desc: "Hover states, focus rings, glow effects, loading shimmer animations",
            },
            {
              title: "Enhanced Contrast",
              desc: "12% borders (vs 10%), distinct surface levels, accent glow shadows",
            },
            {
              title: "Swap Direction Button",
              desc: "Centered animated button to switch tokens (industry standard)",
            },
            {
              title: "Provider Ranking Cards",
              desc: "Clear rank badges, winner highlight with glow, confidence indicators",
            },
            {
              title: "Segmented Tabs",
              desc: "BEQ/RAW toggle with pill-style active state and smooth transitions",
            },
            {
              title: "Preset Buttons",
              desc: "Quick slippage/mode selection like 1inch and KyberSwap",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sp-ok" />
              <div>
                <div className="text-body font-semibold text-sp-lightText">{item.title}</div>
                <div className="mt-0.5 text-caption text-sp-lightMuted">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShellLight>
  );
}
