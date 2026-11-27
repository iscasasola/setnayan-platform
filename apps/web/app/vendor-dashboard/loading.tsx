import { Screen, Sk, SkCircle, SkSection } from '@/components/skeletons';

/**
 * Skeleton for /vendor-dashboard — Today, in Today's own shape (L6 · S4, walk 27 Nov 2026: a supplier's first load read
 * only "Loading…" for 8–9 s while this file still drew the retired home — a name header, a completion strip and six
 * stat tiles Today stopped drawing in November).
 *
 * 👻 Ghost (motion standard 18 Nov 2026, § 9): what is KNOWN shows at once, as itself — the section name "Needs you
 * today", the pinned row's own words. What is not (the greeting line, the tasks count, every figure, every row) is a grey
 * block under the Sheen. The parts, in the page's order (`SupplierTodayScreen`):
 *   1 · the cover (`TodayCover`) — the greeting · date line, the bold tasks line, the ⚙ on the right;
 *   2 · the numbers (`TodayStats`) — five tiles in one sliding row on a phone, three across from the tablet width;
 *   3 · Needs you today — the pinned heading, then its rows (icon · two lines · the row's action).
 */
export default function VendorLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl tab:max-w-none px-4 py-4 sm:px-6 sm:py-10 lg:px-8">
      <Screen label="Loading Today" className="space-y-0">
        {/* 1 · The cover — greeting · date, the tasks line, the ⚙. */}
        <div className="mb-1 flex items-start gap-2 pt-1">
          <div className="min-w-0 flex-1 space-y-2">
            <Sk className="h-3 w-52 max-w-full rounded" />
            <Sk className="h-6 w-40 rounded-md" />
          </div>
          <SkCircle size="h-10 w-10" className="shrink-0" />
        </div>

        {/* 2 · The numbers — the shipped tile size, so nothing moves when they land. */}
        <div aria-hidden className="-mx-4 mb-5 mt-4 overflow-hidden px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-2 tab:grid tab:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="shrink-0 tab:min-w-0">
                <div className="flex min-h-[88px] w-[104px] flex-col justify-center gap-2 rounded-2xl bg-ink/[0.045] px-3 py-2.5 tab:w-full">
                  <Sk className="h-5 w-10 rounded" />
                  <Sk className="h-3 w-16 rounded" />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* 3 · Needs you today — the pinned heading is known; its rows are not. */}
        <SkSection name="Needs you today" className="space-y-1">
          <ul aria-hidden className="divide-y divide-[color:var(--m-line)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <SkCircle size="h-9 w-9" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Sk className="h-3.5 w-3/5 rounded" />
                  <Sk className="h-3 w-2/5 rounded" />
                </div>
                <Sk className="h-9 w-20 rounded-full" />
              </li>
            ))}
          </ul>
        </SkSection>
      </Screen>
    </div>
  );
}
