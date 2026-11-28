/**
 * /wall/[eventId] — the venue screen's Memory lane, while the server answers.
 *
 * Why: speed audit 2026-11-27 marked it ⓛ: no loading boundary at or above it and about 7 reads before paint, so a
 * TV that opened the link showed nothing until the server answered.
 *
 * Shape it mirrors (wall-projection.tsx, the claimed screen): full-bleed `bg-ink` → the header strip (the event's
 * name · the live photo count) → the photo grid, 3 across on a phone up to 6 on a big screen. The unclaimed screen
 * (wall-claim.tsx) is the same full-bleed `bg-ink` page, so the frame is right either way. Blocks are `bg-cream/10` so they read on `bg-ink` in light and dark alike. No title bar: the
 * projection draws none.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

export default function WallLoading() {
  return (
    <Screen className="min-h-screen bg-ink text-cream">
      <div className="flex items-center justify-between px-6 py-4">
        <Ghost className="h-3 w-40 rounded bg-cream/10" />
        <Sk className="h-6 w-20 rounded bg-cream/10" />
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 pb-10 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Sk key={i} className="aspect-square w-full rounded-md bg-cream/10" />
        ))}
      </div>
    </Screen>
  );
}
