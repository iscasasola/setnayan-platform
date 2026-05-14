import { Video, ArrowRight } from 'lucide-react';

/**
 * Stub: the video guestbook is bundled with Wedding Challenges, which will
 * land alongside Papic (iteration 0012). Renders a placeholder card so the
 * day-of grid has its full shape and copy is in place to swap in.
 */
export function VideoGuestbookCard() {
  return (
    <article className="space-y-3 rounded-2xl border border-dashed border-ink/20 bg-ink/[0.02] p-5">
      <header className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
          <Video aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Video guestbook
        </p>
        <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
          Coming soon
        </span>
      </header>

      <h3 className="text-base font-semibold tracking-tight text-ink/70">
        A rotating prompt for every guest
      </h3>
      <p className="text-sm text-ink/55">
        Coming when Papic ships. Guests record 60-second messages from their
        phone; you review and approve before recap.
      </p>

      <div
        aria-hidden
        className="flex items-center gap-2 rounded-md bg-ink/[0.04] p-3"
      >
        <div className="h-8 w-8 rounded-full bg-ink/10" />
        <div className="flex-1 space-y-1">
          <div className="h-2 w-3/4 rounded bg-ink/10" />
          <div className="h-2 w-1/2 rounded bg-ink/10" />
        </div>
      </div>

      <button
        type="button"
        disabled
        aria-disabled
        className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/40"
      >
        View submissions
        <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </article>
  );
}
