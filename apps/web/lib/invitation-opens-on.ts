/**
 * apps/web/lib/invitation-opens-on.ts
 *
 * THE ONE DATE THE INVITATION OPENS (owner 2026-10-14, DECISION_LOG 📬 "RSVP GETS ITS OWN OPEN AND
 * CLOSE", item 6: *"the Invitation opens on `std_invitation_launch_date` when the couple set one, else
 * 90 days out — the film and the switch read ONE date"*).
 *
 * Measured before this file: the Save the Date film said "the invitation goes live on <date>" from
 * `events.std_invitation_launch_date ?? defaultInvitationLaunchIso(event_date)` (3 calendar months),
 * while the page switched from the Save the Date to the Invitation at `STD_THRESHOLD_DAYS` (90 days of
 * 24 hours, on the server's clock) and never read the couple's date at all. So the film could promise
 * one day and the page switch on another. Both now ask THIS function:
 *   · the film's closing line (`defaultInvitationLaunchIso`, lib/save-the-date-content.ts),
 *   · the phase switch (`getLifecyclePhase`, lib/invitation-widgets.ts), compared against the
 *     VENUE's calendar day,
 *   · the reply window's "Replies open on …" when the Invitation has not opened yet (lib/reply-window.ts).
 *
 * Pure, tiny and import-free on purpose: the film and the Maker's Save the Date builder are client
 * code and must not carry the phase engine to learn one date.
 */

/** Days before the event the Invitation opens when the couple set no date of their own. */
export const INVITATION_OPENS_DAYS_BEFORE = 90;

const YMD = /^\d{4}-\d{2}-\d{2}/;

/**
 * A stored day as `YYYY-MM-DD`, or null. PostgREST hands a `date` column over as a string; a driver that
 * parses it (PGlite, node-postgres) hands over a `Date` at UTC midnight — both read as the same day here,
 * so a reader never throws on a shape it was not written for.
 */
export function ymdOf(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return YMD.test(t) ? t.slice(0, 10) : null;
}

/**
 * `YYYY-MM-DD` the Invitation opens: the couple's own `std_invitation_launch_date` when set, else
 * `INVITATION_OPENS_DAYS_BEFORE` days before the event's first day. Null with no event date and no
 * date of their own (nothing to count from).
 */
export function invitationOpensOn(eventDate: string | Date | null | undefined, launchDate: string | Date | null | undefined): string | null {
  const own = ymdOf(launchDate);
  if (own) return own;
  const day = ymdOf(eventDate);
  if (!day) return null;
  const [y = NaN, m = NaN, d = NaN] = day.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) - INVITATION_OPENS_DAYS_BEFORE * 86_400_000;
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** Today as `YYYY-MM-DD` on the venue's clock (Asia/Manila when the zone is missing or unknown). */
export function venueDayOf(timeZone: string | null | undefined, nowMs: number): string {
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(nowMs));
  try {
    return fmt((timeZone ?? '').trim() || 'Asia/Manila');
  } catch {
    return fmt('Asia/Manila');
  }
}
