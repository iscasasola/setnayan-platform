import type { SupabaseClient } from '@supabase/supabase-js';
import { BOOKED_VENDOR_STATUSES } from '@/lib/vendors';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * vendor-date-demand.ts — who ELSE wants this supplier on this day.
 *
 * ── WHAT THE OWNER ASKED FOR ────────────────────────────────────────────────
 * *"Target date for vendors will show who are also inquiring for that day so
 * they do not need to browse their calendar?"*
 *
 * So, beside the couple's target date on the supplier's conversation page: how
 * many OTHER couples are asking this same shop about that day, and how many
 * bookings the shop already holds that week. A supplier deciding whether to
 * accept an inquiry is deciding against their own diary, and the diary is two
 * clicks away on another screen.
 *
 * ── 🔒 THREE BOUNDARIES, ALL ABSOLUTE ───────────────────────────────────────
 *  1. COUNTS, NEVER NAMES. "2 other couples asking about 18 Dec" — never who
 *     they are. This is the supplier's own pipeline so the DATA is theirs; the
 *     other couples' identities are not ours to spread sideways between the
 *     conversations they are each having privately. Nothing in this module
 *     returns a name, a slug or an id, and nothing accepts a parameter that
 *     could widen it into one.
 *  2. SUPPLIER SIDE ONLY. This is the shop's commercial position. It must never
 *     render on the couple's view of the same thread — a couple learning "two
 *     rivals are also chasing this caterer" is a pressure tactic nobody ruled
 *     on. `who-else-wants-this-date.test.ts` fails if any file under
 *     `app/dashboard/` imports this module.
 *  3. ⚠ A COUPLE-FACING VERSION EXISTS ELSEWHERE and is NOT precedent. The
 *     marketplace bench shows a couple "N couples inquired for your date",
 *     floored at 3. It runs the OPPOSITE direction, it was never ruled on, and
 *     it is untouched by this file. Do not reuse its shape as permission for
 *     anything here.
 *
 * ── 🔑 RULE 0: WHAT ALREADY EXISTS, AND WHY IT COULD NOT SERVE ──────────────
 * Two shipped things answer questions adjacent to this one. Both were read
 * before a line of this was written, and neither fits — recorded here so the
 * next session does not re-derive it:
 *
 *   • `get_vendor_same_day_bookings(p_event_id, p_day)` (migration
 *     20271176204143) returns this shop's OTHER bookings on a given day, and
 *     the day parameter does generalise. But step 2 of its body REQUIRES the
 *     caller to be BOOKED on `p_event_id` — `event_vendors.status IN
 *     ('contracted','deposit_paid','delivered','complete')` — and returns
 *     `'[]'` otherwise. The surface this line is FOR is the accept card of a
 *     PENDING inquiry, where by definition no booking exists yet, so the
 *     function answers `[]` to every caller who needs it. It also returns the
 *     other events' `display_name` and `slug`, which boundary 1 forbids
 *     rendering. It is deliberately not called here, and it is not modified
 *     either: its booked-gate and its missing `vendor_team_members` union are
 *     both load-bearing and documented as such.
 *
 *   • `vendor_whitelist_pressure(p_thread_id)` (migration 20271180727490) is
 *     genuinely close — "customers already being chased for this date,
 *     EXCLUDING the one on screen" — and this page already draws it as
 *     `PipelinePressureLine`. It counts a NARROWER set (accepted-and-not-yet-
 *     locked threads only, the whitelist the tier ceiling refuses on) and it
 *     returns NO ROWS whenever the ceilings are switched off platform-wide,
 *     because a ceiling sentence must not appear where nothing would refuse.
 *     The owner's question is not about a ceiling: it is "who else wants this
 *     day", which is true whether or not caps are enforced, and includes the
 *     couples still waiting to be accepted. So the two lines coexist and say
 *     different things; this one must never be built on that RPC's `used`.
 *
 * ── WHY THE ADMIN CLIENT ────────────────────────────────────────────────────
 * A supplier is not an `event_members` row, so `public.events` — and therefore
 * `event_date` — is unreadable to them under RLS. The conversation page already
 * resolves that the way this whole route does: an admin client, scoped by a
 * `vendor_profile_id` the session has already PROVEN it owns. Every row counted
 * here names that profile. That is the sanctioned shape on
 * `/vendor-dashboard/*` (it is the guest-facing `/{slug}` desk where an admin
 * client is forbidden and an RPC is required). No RLS is weakened and no new
 * SECURITY DEFINER function is introduced.
 *
 * ── 🚨 AND BOTH EMBEDS NAME THEIR FOREIGN KEY ───────────────────────────────
 * `events!inner` from `event_vendors` is REFUSED by PostgREST with PGRST201.
 * There is one direct foreign key to `events` and — measured against production
 * — nineteen junction tables that also join the two, so PostgREST finds many
 * routes and refuses rather than guessing. This repo has already lost three
 * features to it silently, including *"another couple is holding this supplier
 * on your date"* — a caution that was never once shown. The cure was written
 * down in `lib/ghosting.ts` and did not propagate;
 * `the-cure-was-already-written-down.test.ts` is why it does now, and it is
 * what caught this file in CI.
 *
 * 🔑 A COUNT OF THE FOREIGN KEYS DID NOT PREDICT IT. Asking production for the
 * FKs from `event_vendors` to `events` returns exactly one, which reads as
 * "unambiguous" and is the wrong question — the ambiguity comes from every
 * OTHER table that reaches `events`. The junction is named on both embeds, not
 * only the one the guard scans, because a refusal here renders as a line that
 * simply never appears.
 *
 * PURE + I/O split: the week maths and the copy are pure functions with no
 * clock and no env; the reader takes its client as an argument.
 */

export type VendorDateDemand = {
  /**
   * OTHER couples asking THIS shop about the same calendar day — pending and
   * accepted inquiries alike, excluding the conversation on screen.
   */
  otherInquiries: number;
  /** Bookings this shop already holds in the same Monday–Sunday week. */
  bookingsThatWeek: number;
  /** The day being asked about, ISO `YYYY-MM-DD`. */
  dateIso: string;
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * "18 Dec" from an ISO calendar day. PURE.
 *
 * ⚠ Parsed from the STRING, never `new Date(iso)`. `event_date` is a DATE
 * column, so `new Date('2026-12-18')` is midnight UTC and the local getters
 * then report the 17th to every reader west of Greenwich — the bug that printed
 * the wrong day on 41 screens (2026-08-04).
 */
export function demandDayLabel(iso: string | null | undefined): string | null {
  const parts = parseIsoDay(iso);
  if (!parts) return null;
  return `${parts.d} ${MONTHS[parts.m - 1]}`;
}

function parseIsoDay(iso: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const [ys, ms, ds] = String(iso).split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/**
 * The Monday–Sunday week containing `iso`, as two ISO day keys. PURE.
 *
 * ⚠ ALL ARITHMETIC IN UTC. `Date.UTC` + the UTC getters never touch the
 * reader's zone, so the week does not shift for a supplier in Manila reading a
 * page rendered anywhere else. Monday-first because that is how a Philippine
 * events week is spoken about — "I already have Saturday" belongs to the week
 * whose Sunday follows it, not to the next one.
 */
export function weekBounds(iso: string | null | undefined): { from: string; to: string } | null {
  const parts = parseIsoDay(iso);
  if (!parts) return null;
  const ms = Date.UTC(parts.y, parts.m - 1, parts.d);
  const day = new Date(ms).getUTCDay(); // 0 = Sunday
  const backToMonday = (day + 6) % 7;
  const from = ms - backToMonday * 86_400_000;
  const to = from + 6 * 86_400_000;
  return { from: isoDay(from), to: isoDay(to) };
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The one line, for the accept card. PURE. Returns null when the day cannot be
 * named or when there is nothing to report — a supplier with an empty diary
 * gains nothing from being told so twice, and this app's house rule for
 * pipeline copy is to fail toward silence rather than toward a wall.
 */
export function vendorDateDemandLine(d: VendorDateDemand | null): string | null {
  if (!d) return null;
  const day = demandDayLabel(d.dateIso);
  if (!day) return null;
  if (d.otherInquiries <= 0 && d.bookingsThatWeek <= 0) return null;

  const clauses: string[] = [];
  if (d.otherInquiries > 0) {
    clauses.push(
      d.otherInquiries === 1
        ? `1 other couple is asking you about this date`
        : `${d.otherInquiries} other couples are asking you about this date`,
    );
  }
  if (d.bookingsThatWeek > 0) {
    clauses.push(
      d.bookingsThatWeek === 1
        ? `you hold 1 booking that week`
        : `you hold ${d.bookingsThatWeek} bookings that week`,
    );
  }
  return `${day} — ${clauses.join(' · ')}.`;
}

/**
 * The same facts as the customer rail's small print under Target date. PURE.
 * Shorter, because it sits under a value rather than standing on its own.
 */
export function vendorDateDemandNote(d: VendorDateDemand | null): string | null {
  if (!d) return null;
  const day = demandDayLabel(d.dateIso);
  if (!day) return null;
  if (d.otherInquiries <= 0 && d.bookingsThatWeek <= 0) return null;

  const clauses: string[] = [];
  if (d.otherInquiries > 0) {
    clauses.push(
      `${d.otherInquiries} other ${d.otherInquiries === 1 ? 'couple' : 'couples'} asking about ${day}`,
    );
  }
  if (d.bookingsThatWeek > 0) {
    clauses.push(
      `${d.bookingsThatWeek} ${d.bookingsThatWeek === 1 ? 'booking' : 'bookings'} held that week`,
    );
  }
  return clauses.join(' · ');
}

/**
 * Read the demand for one date, or null to draw nothing.
 *
 * TWO batched aggregate reads — never one per row, and never one per day of the
 * week. Both are `head: true` counts, so no row content crosses the wire and
 * there is nothing for a render to accidentally spill.
 *
 * ⚠ A REFUSED READ IS NOT A QUIET ZERO. Either count failing returns null and
 * the line does not render, because "nobody else is asking" is a claim a
 * supplier would act on, and an errored query would make it for free.
 */
export async function fetchVendorDateDemand(args: {
  /** Service-role client. See the docblock for why this route may hold one. */
  adminClient: SupabaseClient;
  /** A profile the SESSION has already proven the caller owns. */
  vendorProfileId: string;
  /** The couple's target date, ISO `YYYY-MM-DD`. Null → no question to ask. */
  eventDate: string | null;
  /** The conversation on screen, so it does not count itself. */
  excludeThreadId: string;
}): Promise<VendorDateDemand | null> {
  const { adminClient, vendorProfileId, eventDate, excludeThreadId } = args;
  const week = weekBounds(eventDate);
  if (!eventDate || !week) return null;

  const [asking, held] = await Promise.all([
    // OTHER couples asking THIS shop about THIS day. The embed filters on the
    // joined date without fetching it; `head: true` returns a count and no rows
    // at all.
    adminClient
      .from('chat_threads')
      .select('thread_id, events!chat_threads_event_id_fkey!inner(event_date)', {
        count: 'exact',
        head: true,
      })
      .eq('vendor_profile_id', vendorProfileId)
      .neq('thread_id', excludeThreadId)
      .in('inquiry_status', ['pending', 'accepted'])
      .is('archived_at', null)
      .eq('events.event_date', eventDate),
    // Bookings this shop already holds in the same week.
    adminClient
      .from('event_vendors')
      .select('vendor_id, events!event_vendors_event_id_fkey!inner(event_date)', {
        count: 'exact',
        head: true,
      })
      .eq('marketplace_vendor_id', vendorProfileId)
      .in('status', BOOKED_VENDOR_STATUSES as unknown as string[])
      .is('archived_at', null)
      .gte('events.event_date', week.from)
      .lte('events.event_date', week.to),
  ]);

  if (asking.error || held.error) {
    logQueryError(
      'fetchVendorDateDemand',
      asking.error ?? held.error,
      { vendor_profile_id: vendorProfileId, event_date: eventDate },
      'graceful_degrade',
    );
    return null;
  }

  return {
    otherInquiries: Math.max(0, asking.count ?? 0),
    bookingsThatWeek: Math.max(0, held.count ?? 0),
    dateIso: eventDate,
  };
}
