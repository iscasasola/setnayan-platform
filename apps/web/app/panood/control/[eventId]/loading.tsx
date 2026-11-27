/**
 * /panood/control/[eventId] — the Live Watch controller, while the server answers.
 *
 * Why: speed audit 2026-11-27, Group J. No loading boundary sat at or above this route and the page makes about
 * 22 reads before paint, so a tap showed nothing until the server answered.
 *
 * Shape it mirrors (page.tsx's fixed, scroll-free shell on `bg-cream`): the 44px status row (exit · event name ·
 * on-air chip) → the Channel 1 monitor (16:9) → the transport row (Go live + guest-pick) → the camera-channel grid.
 * On a laptop the monitor column sits left of the channels, as the page's `lg:grid-cols` does. The page's own
 * heading is `sr-only`, so no title bar is drawn.
 *
 * page.tsx can call notFound(); with this boundary that answer streams as HTTP 200 — acceptable on a private page,
 * as on the 35 other routes that pair notFound() with a loader.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

export default function PanoodControlLoading() {
  return (
    <Screen className="fixed inset-0 z-0 flex flex-col overflow-hidden bg-cream">
      {/* Status row — exit, the event's name (not known here), the on-air chip. */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-ink/10 bg-ink/[0.03] px-2">
        <Sk className="h-6 w-10 rounded-md" />
        <Ghost className="h-3 w-32 rounded" />
        <Sk className="ml-auto h-6 w-16 rounded-full" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 px-2.5 pt-2 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-3 lg:px-3">
        {/* Left — the Channel 1 monitor, then the transport row. */}
        <div className="flex shrink-0 flex-col gap-2">
          <Sk className="aspect-video max-h-[34dvh] w-full rounded-2xl lg:max-h-[46dvh]" />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Sk className="h-12 w-full rounded-xl" />
            <Sk className="h-12 w-24 rounded-xl" />
          </div>
        </div>

        {/* Right — the camera channels, the page's one scroller. */}
        <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Sk key={i} className="aspect-video w-full rounded-xl" />
          ))}
        </div>
      </div>
    </Screen>
  );
}
