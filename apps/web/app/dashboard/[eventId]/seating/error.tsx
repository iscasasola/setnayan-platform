'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Seat-plan route error boundary (render-crash investigation · Sync verdict
// 2026-07-16). WHY this file exists: the seating segment previously had NO
// error.tsx, so a data-dependent throw BETWEEN hooks in the editor/lab (a
// malformed persisted row → a `useMemo`/`new Array(n)` throw mid-render →
// React #310 on the next render) escalated to the ROOT page as an unrecoverable
// "Application error". This boundary catches it at the seating segment (2D
// editor AND the /lab 3D plan are children) and converts unrecoverable → a
// recoverable, kit-styled card with Retry. The read-time coord/capacity
// sanitizing (`sanitizePersistedCoord`/`sanitizeCapacity` in lib/seating.ts) +
// the between-hooks guards heal the underlying row; this is the belt-and-braces
// safety net so a future malformed row degrades instead of blanking the app.
// Sentry auto-captures via the global handler (iteration 0035).

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function SeatingError({ error, reset }: Props) {
  const router = useRouter();
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[seating error boundary]', error);
    }
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-cream px-6 py-16 text-ink">
      <div className="w-full max-w-md text-center">
        <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/40">
          Seat plan
        </p>
        <h1 className="mb-4 font-display text-3xl italic leading-tight text-ink sm:text-4xl">
          This seat plan hit a snag.
        </h1>
        <p className="mx-auto mb-9 max-w-sm font-sans text-base leading-relaxed text-ink/70">
          Your tables and guest list are safe — nothing was lost. Reload the plan
          to pick up where you left off.
        </p>
        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-sm bg-mulberry px-6 py-3 font-sans text-sm font-medium tracking-wide text-cream transition-colors hover:bg-mulberry-600"
          >
            Reload the plan
          </button>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center justify-center rounded-sm border border-ink/20 px-6 py-3 font-sans text-sm font-medium tracking-wide text-ink transition-colors hover:bg-ink/5"
          >
            Refresh from saved
          </button>
        </div>
        {error?.digest && (
          <p className="mt-9 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/30">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
