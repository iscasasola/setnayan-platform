// State 02 · LOADING — a skeleton is the layout at rest. It copies the real
// content's geometry one-to-one, then dissolves into the data. Never a
// spinner (a spinner admits the layout is unknown; a skeleton proves it
// isn't), never a full-viewport blocker.

type BlockProps = {
  className?: string;
};

/** One shimmering placeholder shape. Size/shape it with className to copy the
 *  real element's geometry: `h-3 w-1/2` for a title bar, `h-8 w-8
 *  rounded-full` for an avatar, `h-7 w-16 rounded-full` for a pill. */
export function SkeletonBlock({ className }: BlockProps) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded bg-ink/10 ${className ?? ''}`}
    />
  );
}

type RowProps = {
  /** Renders the leading shape as a circle (avatar rows). */
  round?: boolean;
};

/** A list-row skeleton — leading shape, two text lines, a trailing action
 *  stub. Matches the roster/queue row geometry most surfaces render. */
export function SkeletonRow({ round }: RowProps) {
  return (
    <div aria-hidden className="flex items-center gap-3 py-2.5">
      <SkeletonBlock className={`h-8 w-8 shrink-0 ${round ? 'rounded-full' : ''}`} />
      <div className="flex-1 space-y-1.5">
        <SkeletonBlock className="h-3 w-1/2" />
        <SkeletonBlock className="h-2 w-1/3" />
      </div>
      <SkeletonBlock className="h-6 w-16 shrink-0 rounded-full" />
    </div>
  );
}

type ListProps = {
  /** How many rows the real list typically shows above the fold. */
  rows?: number;
  round?: boolean;
  /** Announced to assistive tech while the visual skeleton shimmers. */
  label?: string;
};

/** A stack of row skeletons standing in for a loading list. */
export function SkeletonList({ rows = 3, round, label = 'Loading' }: ListProps) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} round={round} />
      ))}
    </div>
  );
}
