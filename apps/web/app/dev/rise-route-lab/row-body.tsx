/** A stand-in page body for one avatar row — long enough to scroll, so the risen screen's own scroll is visible. */
export function RowBody({ row }: { row: string }) {
  return (
    <div className="space-y-3 px-4 py-4" data-rise-lab-body={row}>
      {Array.from({ length: 14 }, (_, i) => (
        <div key={i} className="rounded-tile bg-[var(--m-paper)] px-4 py-3 text-[15px] text-ink">
          {row} · section {i + 1}
        </div>
      ))}
    </div>
  );
}
