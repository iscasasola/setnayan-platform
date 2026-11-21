import { Ghost, Screen, Sk, SkCircle } from '@/components/skeletons';
import { GuestsLastCopy } from './_components/guests-last-copy';

/**
 * 👻 ON EVERY VIEW, NOTHING FADES (Guests redesign drawing `guests_redesign_2026-11-20_fable.html`, "On every view",
 * owner 20 Nov "Yes, your picks"): *"the top row and thumb row draw at full colour at once; rows arrive as grey
 * placeholder lines of the same height, then fill."* So the wait is drawn in the List's own shape — the pinned row
 * with its known words, the summary's two lines, then rows of the list's height (12 px above and below, a 40 px face,
 * a hairline between) — never a grid of tiles that collapses when the list lands.
 *
 * 📋 The host's last copy of the list still draws LIVE, by the list's own screen, when the phone keeps one (owner
 * 2026-10-16: "loads fast instead of always waiting") — this is for a first visit, a filtered view, or nothing kept.
 * 🔒 guests/nothing-fades-on-arrival.test.ts
 */
const ROWS = 9;

export default function GuestsLoading() {
  return (
    <GuestsLastCopy>
      <Screen className="space-y-4" label="Loading your guests">
        <div className="flex min-w-0 items-center gap-2" data-guests-skeleton-row="">
          <span className="inline-flex h-10 items-center rounded-full bg-ink/[0.06] px-3 dark:bg-white/[0.08]">
            <Ghost known="Guests · List" textClassName="text-[14px] font-medium leading-10 text-ink" />
          </span>
          <span className="flex-1" />
          <SkCircle size="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <Sk className="h-4 w-3/5 rounded" />
          <Sk className="h-1.5 w-full rounded-full" />
          <Sk className="h-3.5 w-4/5 rounded" />
        </div>
        <div data-guests-skeleton-rows="">
          {Array.from({ length: ROWS }).map((_, i) => (
            <div key={i} className="flex min-w-0 items-center gap-3 border-t border-ink/10 py-3 dark:border-white/10">
              <SkCircle size="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <Sk className={`h-3.5 rounded ${i % 3 === 0 ? 'w-1/2' : i % 3 === 1 ? 'w-2/5' : 'w-3/5'}`} />
                <Sk className="h-3 w-1/4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </Screen>
    </GuestsLastCopy>
  );
}
