import { Screen, Sk, SkLine } from '@/components/skeletons';

/**
 * Skeleton for /admin — mirrors the 3-section admin overview layout:
 * header → action-queues panel (terracotta card + 4 tiles) →
 * 8 stats (2×4 grid) → 6 nav tiles (2/3-col grid).
 */
export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      <Screen label="Loading Setnayan HQ">
        {/* Header — eyebrow + "Overview" h1 + subtitle */}
        <header className="space-y-2">
          <Sk className="h-3 w-36 rounded" />
          <Sk className="h-10 w-44 rounded-md" />
          <SkLine w="w-3/4 max-w-lg" />
        </header>

        {/* Action queues panel — terracotta-tinted card + 4 queue tiles */}
        <div className="rounded-2xl border border-terracotta/20 bg-terracotta/[0.03] p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <Sk className="h-3 w-28 rounded" />
            <Sk className="h-3 w-20 rounded" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-ink/10 bg-cream p-3">
                <Sk className="h-7 w-10 rounded-md" />
                <Sk className="mt-2 h-3 w-20 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Stats — 8 tiles in a 2×4 grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-ink/10 bg-cream p-3">
              <Sk className="h-6 w-12 rounded-md" />
              <Sk className="mt-2 h-3 w-16 rounded" />
            </div>
          ))}
        </div>

        {/* Nav tiles — 6 tiles in 2/3-col grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-ink/10 bg-cream p-5">
              <Sk className="h-3 w-20 rounded" />
              <Sk className="mt-2 h-5 w-32 rounded-md" />
              <Sk className="mt-2 h-3 w-full rounded" />
            </div>
          ))}
        </div>
      </Screen>
    </div>
  );
}
