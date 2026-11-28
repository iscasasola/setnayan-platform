/**
 * /join/crew/[token] — the wait before a crew phone's pass answers.
 *
 * Why: speed audit 2026-11-27, Group J. A tap showed nothing until the server answered (10 reads before paint).
 *
 * Shape: `CrewFrame` (the 576 px paper column, `px-4 pt-6`) → `CrewEventHub`, the screen a crew phone lands on:
 * the "Event Hub · <shop> crew" line → the dark event tile (who · role · tools, the event's name, day and place)
 * → the pass line → the Scanner label and its camera box → the run of show rows. Every word carries the shop,
 * the person or the event, so nothing is known before the read: all grey.
 */
import { Ghost, Screen, Sk, SkLine } from '@/components/skeletons';

export default function CrewJoinLoading() {
  return (
    <Screen className="mx-auto min-h-screen w-full max-w-xl bg-paper px-4 pb-16 pt-6">
      <div>
        <Ghost className="h-3 w-48 rounded" />
        {/* The dark event tile. */}
        <div className="mt-2 space-y-2 rounded-2xl bg-ink/10 p-4">
          <Sk className="h-2.5 w-3/5 rounded" />
          <Sk className="h-5 w-4/5 rounded" />
          <Sk className="h-3 w-1/2 rounded" />
        </div>
        <Sk className="mt-3 h-3 w-4/5 rounded" />
        {/* Scanner. */}
        <Sk className="mt-6 h-3 w-16 rounded" />
        <Sk className="mt-3 h-64 w-full rounded-2xl" />
        {/* Run of show. */}
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Sk className="h-3.5 w-14 rounded" />
              <SkLine w="flex-1" />
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}
