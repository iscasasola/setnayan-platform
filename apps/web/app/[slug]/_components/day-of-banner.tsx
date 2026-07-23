// Task #13 — day-of lifecycle banner. `live` = T-1h..T+8h (per
// lib/day-of-mode.ts), `post` = T+8h..T+24h. Renders server-side so the
// surface is offline-cacheable; no client effect needed.
export function DayOfBanner({ kind }: { kind: 'live' | 'post' }) {
  if (kind === 'live') {
    return (
      <section
        aria-label="Live event mode"
        className="flex items-center gap-3 rounded-xl border-2 border-success-300 bg-success-50 p-4 sm:p-5"
      >
        <span
          aria-hidden
          className="inline-flex h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-success-600"
        />
        <div className="flex-1">
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-success-800">
            Live now
          </p>
          <p className="text-sm text-success-900">
            The wedding is happening. Your schedule, QR, and venue info are pinned
            below — they work offline if WiFi cuts out.
          </p>
        </div>
      </section>
    );
  }

  // post
  return (
    <section
      aria-label="Post-event mode"
      className="rounded-xl border border-ink/10 bg-cream p-4 sm:p-5"
    >
      <p className="font-mono text-xs uppercase tracking-[0.15em] text-ink/55">
        Thank you for celebrating
      </p>
      <p className="mt-1 text-sm text-ink/70">
        The wedding wrapped up. Your tagged photos will land here as the couple
        releases them — check back over the next few days.
      </p>
    </section>
  );
}
