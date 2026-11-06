import Link from 'next/link';
import { ChevronLeft, ClipboardList, ScanLine } from 'lucide-react';
import { coordinatingWords } from '@/lib/events-you-run';

/**
 * 🗂 THE ONE SLIM DARK LINE a supplier reads inside an event they run as the hosts' coordinator (owner "approved",
 * 2026-10-28; prototype `coordinator_door_2026-10-28` frame D): **Coordinating Claire & Indalecio · ‹ Back to your
 * shop**. Everything under it is the couple's own event dashboard, unchanged — the line only says whose event this is
 * and is the one way back to the shop.
 *
 * 🎫 With `checkInHref`, a **Check-in** door to the shipped desk sits before the way back (owner 2026-10-28).
 *
 * Drawn by `app/dashboard/[eventId]/layout.tsx` ONLY for a viewer it admitted through the coordinator's seat
 * (`wedding_planner_external`) who also has a shop — never for the couple, a co-host or a helper. It grants nothing:
 * the layout's shipped admission check runs before it, unchanged.
 *
 * Not a frame: the line is a strip; only "Back to your shop" is pressable (44 px). The strip stays dark in dark mode
 * too — a fixed charcoal, the colour of Today's event-day card — so it reads the same either way.
 */
export function CoordinatingLine({ eventName, checkInHref = null }: { eventName: string | null; checkInHref?: string | null }) {
  const words = coordinatingWords(eventName);
  const name = words.replace(/^Coordinating /, '');
  return (
    <div
      role="note"
      data-coordinating-line=""
      className="flex items-center gap-2.5 bg-[#2a2622] px-4 py-1 text-[13px] text-white sm:px-6 lg:px-8 dark:border-b dark:border-white/10"
    >
      <ClipboardList aria-hidden className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.9} />
      <span className="min-w-0 truncate">
        {words === 'Coordinating this event' ? words : <>Coordinating <b className="font-semibold">{name}</b></>}
      </span>
      {checkInHref ? (
        /* 🎫 The shipped Check-in desk, one tap away (owner 2026-10-28: "coordinators can also scan qr codes for
           attendance in the reception"). Drawn only when the desk's own rule admits this seat. */
        <Link
          href={checkInHref}
          data-coordinating-checkin=""
          className="ml-auto inline-flex min-h-11 shrink-0 items-center font-semibold text-white"
        >
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
            <ScanLine aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />
            Check-in
          </span>
        </Link>
      ) : null}
      <Link
        href="/vendor-dashboard"
        data-coordinating-back=""
        className={`${checkInHref ? '' : 'ml-auto '} inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-full px-1 font-semibold text-white`}
      >
        <span className="inline-flex items-center gap-0.5 rounded-full bg-white/15 px-2.5 py-1">
          <ChevronLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />
          Back to your shop
        </span>
      </Link>
    </div>
  );
}
