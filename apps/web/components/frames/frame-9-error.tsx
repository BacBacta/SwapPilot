import { CardLight } from "@/components/ui/surfaces";

export function FrameErrorState() {
  return (
    <CardLight className="p-6 text-center">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-yellow-100 grid place-items-center">
        <div className="h-10 w-10 rounded-xl bg-sp-accent" />
      </div>
      <div className="mt-4 text-sm font-semibold text-sp-lightText">No Providers Available</div>
      <div className="mt-2 text-[11px] text-sp-lightMuted">Enable providers in settings</div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button className="rounded-md bg-blue-600 px-3 py-2 text-xs font-extrabold text-white">Open PancakeSwap</button>
        <button className="rounded-md border border-sp-lightBorder bg-sp-lightSurface2 px-3 py-2 text-xs font-extrabold text-sp-lightText">
          Go to Settings
        </button>
      </div>
    </CardLight>
  );
}
