import Link from 'next/link';
import { ArrowRight, Boxes, Gift, Radio } from 'lucide-react';

/**
 * GuestDoorwayStrip — the two finished guest pages, and the one sentence about
 * the broadcast, ON THE PAGE EVERY GUEST ALREADY HAS.
 *
 * ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
 * The 3D walk-through of the reception and the money-gift page both got cards
 * on the day-of hub. But the hub's own link surfaces only once the wedding is
 * LIVE or OVER, so the 3D card — whose copy reads "Look around the reception
 * before you arrive" — could not be reached until after arriving. And nothing
 * anywhere said a livestream was planned until the stream had already started,
 * which is precisely too late for the person it exists for.
 *
 * ── WHY CARDS AND NOT TABS ──────────────────────────────────────────────────
 * The bottom bar is a BUDGETED five slots and the pre-day shape is already
 * full — Home · Details · Story · Camera · Me. A sixth tab is not a small
 * addition but a redesign of an owner-locked shape, and a tab that appears
 * only when the bar happens to have room teaches people the bar is unreliable,
 * which is the exact failure `_lib/site-nav.ts` exists to prevent. Cards cost
 * the bar nothing and can be drawn or withheld per-viewer without the shape
 * moving under anyone.
 *
 * ── WHY ONE MOUNT ABOVE THE IDENTITY FORK ───────────────────────────────────
 * A relative watching from abroad usually opens a SHARED link and has no guest
 * cookie, so they render through the anonymous tree; the invited cousin
 * renders through the guest tree. The same three things belong to both, and
 * gating inside one tree would hide them from half the people who need them.
 * Same reasoning, same mount point as `VendorDoorway`.
 *
 * ── EVERY DECISION IS MADE ELSEWHERE ────────────────────────────────────────
 * This component draws what it is handed and settles nothing. `venueWalk` and
 * `pabuya` are `resolveGuestDoorways` output — `null` means the page behind the
 * card would have turned this viewer away, so there is no card. `broadcast` is
 * `showBroadcastNotice`. Rulings regress; layout does not.
 */
export function GuestDoorwayStrip({
  venueWalk,
  pabuya,
  broadcast,
  personalised,
  dateLabel,
}: {
  /** `/[slug]/venue`, or null → do not draw. */
  venueWalk: string | null;
  /** `/[slug]/pabuya`, or null → do not draw. */
  pabuya: string | null;
  /** Draw the "we'll be streaming" notice? */
  broadcast: boolean;
  /** Does this viewer hold a personal invite? Only changes the 3D room's copy. */
  personalised?: boolean;
  /** Pre-formatted event date for the broadcast notice, when the page has one. */
  dateLabel?: string | null;
}) {
  if (!venueWalk && !pabuya && !broadcast) return null;

  return (
    <aside
      className="mx-auto mt-6 w-full max-w-3xl space-y-3 px-4"
      aria-label="More for guests"
    >
      {venueWalk ? (
        <DoorCard
          href={venueWalk}
          icon={<Boxes aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
          title="Walk the room in 3D"
          detail={
            personalised
              ? 'Look around the reception and find your table.'
              : 'Look around the reception before you arrive.'
          }
        />
      ) : null}

      {pabuya ? (
        <DoorCard
          href={pabuya}
          icon={<Gift aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
          title="Send a blessing"
          detail="The digital money dance — straight to the couple."
        />
      ) : null}

      {broadcast ? (
        /* NOT A LINK, ON PURPOSE. A broadcast URL saved weeks ahead cannot be
           known to be open yet, and we have no way to ask (see the note over
           `showBroadcastNotice`). The only promise made here is about the page
           the reader already has open, which is the one promise that cannot
           dead-end. */
        <div className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-cream px-4 py-3.5">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
            <Radio aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-xs font-bold uppercase tracking-[0.14em] text-terracotta">
              Watching from afar
            </span>
            <span className="mt-0.5 block text-sm text-ink/75">
              This celebration will be streamed live
              {dateLabel ? <> on {dateLabel}</> : null}. Come back to this page
              on the day — the player appears right here, so there is nothing to
              install and nothing to open yet.
            </span>
          </span>
        </div>
      ) : null}
    </aside>
  );
}

/** One door. A real link, because the page behind it has already said yes. */
function DoorCard({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-ink/10 bg-cream px-4 py-3.5 transition-colors hover:border-terracotta"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-ink/60">{detail}</span>
      </span>
      <ArrowRight
        aria-hidden
        className="h-4 w-4 shrink-0 text-ink/40 transition-transform group-hover:translate-x-0.5"
        strokeWidth={2}
      />
    </Link>
  );
}
