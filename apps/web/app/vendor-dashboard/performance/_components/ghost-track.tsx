/**
 * 👻 GHOST TRACK — an empty picture's honest shape (Shop › Analytics, owner-approved 6 Nov 2026): a dashed outline in
 * the exact place the data will fill, with one line naming what fills it. Never a zero bar, never a fake bar.
 */
export function GhostTrack({ line, className = '' }: { line?: string; className?: string }) {
  return (
    <>
      <div className={`ag-track ag-dashed ${className}`.trim()} aria-hidden />
      {line ? <p className="ag-ghost-t">{line}</p> : null}
    </>
  );
}
