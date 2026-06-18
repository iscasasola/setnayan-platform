import { Screen, Sk, RowSkeleton } from '@/components/skeletons';

/**
 * Skeleton for /vendor-dashboard — mirrors the vendor home layout:
 * header (eyebrow + name + verification chip) → profile-completion nudge →
 * 6 stat tiles (2→3→6 cols) → upcoming events section (3 thread rows) →
 * recent activity section.
 */
export default function VendorLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Screen label="Loading vendor dashboard">
        {/* Header — eyebrow + business name + verification chip */}
        <header className="space-y-2">
          <Sk className="h-3 w-36 rounded" />
          <Sk className="h-10 w-56 max-w-full rounded-md" />
          <div className="flex flex-wrap items-center gap-2">
            <Sk className="h-6 w-24 rounded-full" />
            <Sk className="h-6 w-16 rounded-full" />
          </div>
        </header>

        {/* Profile completion nudge — amber strip */}
        <Sk className="h-14 w-full rounded-2xl" />

        {/* 6 stat tiles — 2-col → 3-col → 6-col */}
        <section aria-hidden>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-ink/10 bg-cream p-4">
                <Sk className="h-6 w-8 rounded-md" />
                <Sk className="mt-2 h-3 w-full rounded" />
              </div>
            ))}
          </div>
        </section>

        {/* Upcoming events — section eyebrow + 3 thread rows */}
        <section aria-hidden>
          <div className="mb-3 flex items-baseline justify-between">
            <Sk className="h-3 w-36 rounded" />
            <Sk className="h-3 w-16 rounded" />
          </div>
          <ul className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i}>
                <RowSkeleton />
              </li>
            ))}
          </ul>
        </section>

        {/* Recent activity — section eyebrow + placeholder */}
        <section aria-hidden>
          <div className="mb-3 flex items-baseline justify-between">
            <Sk className="h-3 w-32 rounded" />
            <Sk className="h-3 w-20 rounded" />
          </div>
          <Sk className="h-28 w-full rounded-2xl" />
        </section>
      </Screen>
    </div>
  );
}
