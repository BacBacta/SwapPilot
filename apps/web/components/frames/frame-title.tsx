export function FrameTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-2 text-sm font-semibold text-sp-lightText">
      {n}. {title}
    </div>
  );
}
