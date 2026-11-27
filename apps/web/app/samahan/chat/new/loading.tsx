/**
 * /samahan/chat/new — "+ New group", while the server answers.
 *
 * WHY: the speed audit of 2026-11-27 (Group J) found a tap here showed nothing until the server answered —
 * 3 reads in 3 steps before paint (the account, the host check, the event's people).
 *
 * SHAPE: the page's own narrow column — the back ring, the heading "New group" (the page's own words, shown at
 * once), the Name row, "Who is in it" over the people with a tick each, then the full-width "Make the group".
 *
 * page.tsx can call notFound(); with this boundary that answer streams as HTTP 200 — acceptable on a private page,
 * as on the 35 other routes that pair notFound() with a loader.
 */
import { Ghost, Screen, Sk, SkCircle } from '@/components/skeletons';

export default function NewGroupLoading() {
  return (
    <Screen className="mx-auto w-full max-w-md px-4 pb-10 pt-4">
      <SkCircle size="h-10 w-10" className="my-0.5" />
      <Ghost known="New group" className="mt-3 h-7 w-36 rounded" textClassName="mt-3 min-h-7 text-sn-3xl font-semibold leading-7 text-ink" />
      <div className="mt-4 space-y-4">
        {/* The Name row (the house Field template). */}
        <Sk className="h-12 w-full rounded-md" />
        <div>
          <Ghost known="Who is in it" className="h-3.5 w-24 rounded" textClassName="min-h-4 text-sn-md font-semibold leading-4 text-ink/70" />
          <Sk className="mt-1.5 h-3 w-full rounded" />
          <Sk className="mt-1 h-3 w-3/4 rounded" />
          <ul className="mt-2 divide-y divide-ink/10">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex min-h-12 items-center gap-3 py-1">
                <Sk className="h-5 w-5 shrink-0 rounded" />
                <span className="min-w-0 flex-1 space-y-1.5">
                  <Sk className="h-3.5 w-2/5 rounded" />
                  <Sk className="h-3 w-16 rounded" />
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Sk className="h-11 w-full rounded-md" />
      </div>
    </Screen>
  );
}
