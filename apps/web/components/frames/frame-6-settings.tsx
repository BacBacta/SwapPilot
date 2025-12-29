"use client";

import { CardLight } from "@/components/ui/surfaces";
import { Toggle, Progress } from "@/components/ui/primitives";

const rows = [
  { label: "Slippage Tolerance", on: true },
  { label: "Sellability Check", on: true },
  { label: "Canonical Pools Only", on: true },
  { label: "MEV-Aware Scoring", on: true },
];

export function FrameSettingsPanel() {
  return (
    <CardLight className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-sp-lightBorder bg-sp-lightSurface px-4 py-3">
        <div className="text-xs font-semibold text-sp-lightText">Settings</div>
        <div className="text-[11px] text-sp-lightMuted">Advanced</div>
      </div>

      <div className="p-4">
        <div className="text-[11px] font-semibold text-sp-lightText">Research</div>
        <div className="mt-2">
          <Progress value={62} />
        </div>

        <div className="mt-4 grid gap-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between rounded-lg border border-sp-lightBorder bg-sp-lightSurface px-3 py-3">
              <div className="text-[11px] font-semibold text-sp-lightText">{r.label}</div>
              <Toggle on={r.on} />
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-md border border-sp-lightBorder bg-sp-lightSurface2 px-3 py-2 text-[11px] font-semibold text-sp-lightText">
            Reset
          </button>
          <button className="rounded-md bg-sp-lightText px-3 py-2 text-[11px] font-extrabold text-white">
            Save
          </button>
        </div>
      </div>
    </CardLight>
  );
}
