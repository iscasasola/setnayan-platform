import { getMenuLifecyclePhase } from '@/lib/day-of-mode';
import type { DayOfModuleId } from '@/lib/vendor-dayof-modules';
import { dayOfModuleHref, DAY_OF_CONSOLE_HREF } from '@/lib/vendor-dayof-module-href';

/**
 * THE SUPPLIER'S DESK — the two rules that decide it, kept PURE.
 *
 * ── WHAT THIS IS PART OF ────────────────────────────────────────────────────
 * On the day, the strip a booked supplier sees on the celebration's own page
 * stops being a door out and becomes their desk, in place. Owner, 2026-08-27:
 * *"on the day. is the integration of the vendors to the event's event hub. so
 * we would still want to to be an event hub"* — and, before a line was written,
 * *"we are redesigning not placing a new page."* So there is NO new route: the
 * same `/{slug}` everyone opens carries the supplier's own tools, for one day.
 *
 * ── WHY THE OPENING RULE DELEGATES INSTEAD OF DEFINING ──────────────────────
 * 🔒 `supplierDeskIsOpen` asks `getMenuLifecyclePhase` — the SAME question the
 * organiser's own day-of desk asks — rather than deriving a window of its own.
 * That module already carries three answers this desk would otherwise have had
 * to rediscover, each of which cost this project something:
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
 * PURE — no `server-only`, no Supabase, no React — so it runs under
 * `tsx --test`. (`server-only` is not an installed package in this repo; a
 * module that imports it cannot be loaded by a node test at all.)
 */
export function supplierDeskIsOpen(input: {
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
}): boolean {
  if (!input.eventDate) return false;
  return (
    getMenuLifecyclePhase(
      input.eventDate,
      input.clearedAt ?? null,
      input.tz,
      input.nowMs,
      input.eventEndDate ?? null,
    ) === 'dayof'
  );
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
