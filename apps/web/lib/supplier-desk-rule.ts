import {
  calendarDayInZone,
  eventDateToEpoch,
  getMenuLifecyclePhase,
  morningAfterInstantMs,
} from '@/lib/day-of-mode';
import type { DayOfModuleId } from '@/lib/vendor-dayof-modules';
import { dayOfModuleHref, DAY_OF_CONSOLE_HREF } from '@/lib/vendor-dayof-module-href';

/**
 * THE SUPPLIER'S DESK — the rules that decide it, kept PURE.
 *
 * ── WHAT THIS IS PART OF ────────────────────────────────────────────────────
 * The strip a booked supplier sees on the celebration's own page stops being a
 * door out and becomes their desk, in place. Owner, 2026-08-27: *"on the day.
 * is the integration of the vendors to the event's event hub. so we would still
 * want to to be an event hub"* — and, before a line was written, *"we are
 * redesigning not placing a new page."* So there is NO new route: the same
 * `/{slug}` everyone opens carries the supplier's own tools.
 *
 * ⏳ AND NO LONGER FOR ONE DAY ONLY. What S3 shipped opened on the day and shut
 * at 06:00 the morning after — about thirty hours of a booking's life. The
 * binding design argues against exactly that (*"a day-only room recreates the
 * midnight-door mistake"*), so the door now has four states. See
 * `SupplierDeskStage` below, which is where that is written down.
 *
 * PURE — no `server-only`, no Supabase, no React — so it runs under
 * `tsx --test`. (`server-only` is not an installed package in this repo; a
 * module that imports it cannot be loaded by a node test at all.)
 */
/**
 * THE FOUR STATES OF THE DESK — and why there are four rather than one.
 *
 * ── WHAT SHIPPED FIRST, AND WHY IT WAS NOT ENOUGH ───────────────────────────
 * S3 (2026-08-27) opened the desk on the day and shut it at 06:00 the morning
 * after. That is about thirty hours of a booking's life. The binding design's
 * own strongest sentence is against it: *"a day-only room recreates exactly the
 * midnight-door mistake this product has already paid once to learn."* The
 * venue's address and the call time are wanted in the WEEKS BEFORE; confirming
 * a shot landed happens the morning AFTER.
 *
 * So the door opens for the whole life of the booking, and each state says
 * something true rather than showing nothing:
 *
 *   · `call_sheet` — booked, the day is ahead. The name, the date, the
 *      countdown, the venue once the organiser sets it, the running order once
 *      they write it, the headcount so far. They said yes; they are entitled.
 *   · `today`      — exactly what S3 shipped, unchanged.
 *   · `look_back`  — the week after. The day as it actually ran.
 *   · `archive`    — long after. One quiet line; a supplier's past work is
 *      their portfolio, so the door never disappears.
 *
 * 🔒 THE SHAPE NEVER CHANGES — same pieces, same order, learned once. A piece
 * that cannot be true yet SAYS SO; nothing silently vanishes. That rule is the
 * design's, and it is what stops the call sheet reading as a broken desk.
 */
export type SupplierDeskStage = 'call_sheet' | 'today' | 'look_back' | 'archive';

/**
 * How long the look-back runs before the desk goes quiet. Seven days because
 * that is the design's own window (*"the morning after (6:00 AM → 7 days)"*),
 * and because the week after a celebration is when a supplier is still
 * delivering from it.
 */
export const LOOK_BACK_DAYS = 7;

export type DeskWhen = {
  /** `events.event_date` — `YYYY-MM-DD`. */
  eventDate: string | null | undefined;
  /** `events.event_end_date` — the LAST day, where the type allows a range. */
  eventEndDate?: string | null;
  /** `events.cleared_at` — the organiser closed this celebration out. */
  clearedAt?: string | null;
  /** The venue's IANA zone. Omitted falls back to the runtime's, which on
   *  Vercel is UTC — eight hours off a Manila celebration. Always pass it. */
  tz?: string;
  nowMs?: number;
};

/**
 * Which state the desk is in — or `null` when the celebration has no date at
 * all, in which case there is nothing honest to say and the strip stays the
 * link out it has always been.
 *
 * ── WHY THE DAY ARM DELEGATES INSTEAD OF DEFINING ───────────────────────────
 * 🔒 `today` is still `getMenuLifecyclePhase` — the SAME question the
 * organiser's own day-of desk asks — rather than a window of its own. That
 * module already carries three answers this desk would otherwise have had to
 * rediscover, each of which cost this project something:
 *
 *   · **06:00 the morning after, not midnight.** A reception here runs past
 *     midnight, and a desk that shuts while the party is still going is the
 *     midnight-door mistake the photo route already paid for once.
 *   · **The LAST day, not the first.** `event_end_date` where the type allows a
 *     range. A first-day anchor leaves a supplier on day two of a three-day
 *     celebration with the hub live and their desk shut.
 *   · **`cleared_at` closes it.** If the organiser has closed the celebration
 *     out, nobody is working it.
 *
 * A second copy of that arithmetic is exactly how the bottom nav once swapped
 * into day-of mode while the surface it pointed at disagreed by 36 hours.
 *
 * ⚠ AND THE LOOK-BACK EDGE IS NOT A SECOND COPY EITHER. It reads
 * `morningAfterInstantMs` — the very instant the day arm closes on — so the two
 * states cannot overlap and cannot leave a gap between them. It was extracted
 * from inside `getMenuLifecyclePhase` for this, not re-derived here.
 *
 * ⚖ A CLEARED CELEBRATION READS AS `archive`, NOT `look_back`. `cleared_at`
 * makes the phase 'after' whatever the calendar says, so an organiser who
 * closes a celebration out BEFORE its day lands before the morning-after
 * instant and falls through to the quiet line — which is the honest answer: a
 * closed-out celebration has nothing to look back on.
 */
export function supplierDeskStage(input: DeskWhen): SupplierDeskStage | null {
  if (!input.eventDate) return null;
  const phase = getMenuLifecyclePhase(
    input.eventDate,
    input.clearedAt ?? null,
    input.tz,
    input.nowMs,
    input.eventEndDate ?? null,
  );
  if (phase === 'dayof') return 'today';
  if (phase === 'plan') return 'call_sheet';

  const over = morningAfterInstantMs(input.eventDate, input.tz, input.eventEndDate ?? null);
  if (!Number.isFinite(over)) return 'archive';
  const now = input.nowMs ?? Date.now();
  const withinLookBack = now >= over && now < over + LOOK_BACK_DAYS * 86_400_000;
  return withinLookBack ? 'look_back' : 'archive';
}

/**
 * Is the LIVE desk open — the day itself through to 06:00 the morning after?
 *
 * Kept as its own name because it is the question the day-of arm asks, and
 * because its tests are the ones pinning the three windows above. It is now
 * DERIVED from the stage rather than asking the phase a second time, so the two
 * can never answer differently about the same instant.
 */
export function supplierDeskIsOpen(input: DeskWhen): boolean {
  return supplierDeskStage(input) === 'today';
}

/**
 * Whole days from the venue's TODAY to the celebration's first day. Negative
 * once it is past, `null` when there is no readable date.
 *
 * 🔑 CALENDAR DAYS AT THE VENUE, NEVER A SUBTRACTION OF INSTANTS. `new
 * Date('2026-12-12')` is midnight UTC, which is the 11th west of Greenwich —
 * the date-is-not-an-instant family that once printed the wrong day on 41
 * screens. Both sides are anchored in the venue's own zone by
 * `eventDateToEpoch`, so "43 days to go" means 43 sleeps where the work is.
 */
export function daysToGo(input: {
  eventDate: string | null | undefined;
  tz?: string;
  nowMs?: number;
}): number | null {
  if (!input.eventDate) return null;
  const target = eventDateToEpoch(input.eventDate, input.tz);
  const todayStart = eventDateToEpoch(calendarDayInZone(input.tz, input.nowMs), input.tz);
  if (!Number.isFinite(target) || !Number.isFinite(todayStart)) return null;
  return Math.round((target - todayStart) / 86_400_000);
}

/**
 * The countdown a supplier reads: *"43 days to go."*
 *
 * ⚖ DAYS, NEVER MONTHS, and this is a deliberate departure from
 * `countdownChapter` in lib/papic-chapters.ts, which rolls anything past 30
 * days up into *"2 months to go"*. That is right for a photo album heading and
 * wrong here: the design's own example is "43 days to go", and a supplier
 * counting down to a booking is deciding when to order stock and book a crew.
 * A heading may round; a work surface may not.
 */
export function countdownLine(days: number): string | null {
  if (days < 0) return null;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days to go`;
}

/** What the desk says beside a running-order line the guests were never told
 *  about. The organiser's private cues are SHOWN here — owner ruling
 *  2026-08-27, who turned down "schedule only" — so the marking is the whole
 *  of the protection a supplier reading them aloud would otherwise not get. */
export const PRIVATE_LINE_NOTE = 'Not on the guests’ programme — don’t read aloud';

export type DeskTool = {
  id: DayOfModuleId;
  label: string;
  blurb: string;
  href: string;
};

/**
 * THE TOOLS THE DESK MAY LINK TO — and it is a subtractive rule on purpose.
 *
 * Four things are dropped, each for a reason that has already bitten somebody:
 *
 *   1. **Anything not enabled for this booking.** The supplier's own module
 *      choice governs here exactly as it governs the floor console.
 *   2. **Anything whose tool has no address of its own** (`dayOfModuleHref`
 *      returns null — the seat scanner, the review QR, the live review feed).
 *      They are panels ON the floor console. Inventing a destination for them
 *      is the "tile that promised a scan and delivered a client record" defect.
 *   3. **The five modules that share the floor console's own picker.** The desk
 *      offers that once, as its primary link — five identical tiles would be
 *      noise, and two of those five (the running order and the headcount) are
 *      RENDERED ON THE DESK, so pointing away for them is the door this whole
 *      change exists to close.
 *   4. 🔒 **The Papic capture tool, always.** Its page is day-bound and would
 *      bounce a supplier who opens the desk the afternoon before, and the
 *      capture lane is the one piece the build plan holds back until somebody
 *      reads its INSERT policy out of production (§ 6.4). A camera does not
 *      move onto the celebration's own page as a side effect of a redesign.
 */
export function deskTools(
  modules: ReadonlyArray<{ id: DayOfModuleId; label: string; blurb: string; enabled: boolean }>,
  eventId: string,
): DeskTool[] {
  const out: DeskTool[] = [];
  const seen = new Set<string>();
  for (const m of modules) {
    if (!m.enabled) continue;
    if (m.id === 'vendor_papic') continue;
    const href = dayOfModuleHref(m.id, eventId);
    if (!href) continue;
    if (href === DAY_OF_CONSOLE_HREF) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ id: m.id, label: m.label, blurb: m.blurb, href });
  }
  return out;
}
