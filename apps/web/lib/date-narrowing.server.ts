import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { getBatchVendorAvailableDays } from '@/lib/vendor-availability';
import { intersectViableCandidates } from '@/lib/candidate-dates';
import {
  computeAuspiciousReasons,
  CEREMONY_TYPES,
  type CeremonyType,
  type MeaningfulDateKind,
} from '@/lib/auspicious-date';
import { isChineseWedding } from '@/lib/chinese-wedding';

/** The one runtime list, imported rather than re-typed — `auspicious-date.ts`
 *  carries a compile-time exhaustiveness proof against the union. */
function asCeremonyType(value: unknown): CeremonyType | null {
  return typeof value === 'string' && (CEREMONY_TYPES as readonly string[]).includes(value)
    ? (value as CeremonyType)
    : null;
}

/**
 * DATE-AS-OUTPUT, RE-RUN AT THE AGREEMENT (PR-H slice B · owner §6.1).
 *
 * A couple who has not picked a wedding day commits CANDIDATE days at
 * onboarding. Every supplier they actually book removes the days that supplier
 * cannot work. When one candidate is left, that IS the wedding date — it was
 * decided by the couple's own shortlist meeting the calendars of the suppliers
 * they chose, not by any single supplier.
 *
 * 🔑 WHY IT MOVED. Before the handshake this ran at the couple's Lock, which was
 * also the booking. Under the handshake Lock only ASKS — so leaving it there
 * would narrow the couple's candidates against a supplier who has agreed to
 * NOTHING and can still decline, write the couple's FINAL wedding date on the
 * strength of a question, and then leave that date standing after the decline,
 * because the write is `.is('event_date', null)`-guarded and nothing clears it.
 * Slice A therefore skipped the gate on an ask and named re-running it here as
 * the work this module now does.
 *
 * ⚠ `finalizeVendor` DOES NOT CALL THIS, AND THE REASON IS STRUCTURAL — not an
 * unfinished refactor, and this note exists so nobody "tidies" it into one.
 * On the flag-OFF path its Lock IS the booking, so it must know the answer
 * BEFORE it writes anything: it returns `date_will_lock` and waits for the
 * couple to confirm, which means the arithmetic runs against the confirmed set
 * PLUS the not-yet-confirmed target. This runs AFTER the booking exists, against
 * the confirmed set alone. Same question, two different moments, two different
 * inputs — and folding them together would mean handing this function an
 * unconfirmed vendor, which is precisely the defect that moved the code.
 * The shared thing is the arithmetic itself, and it already is shared:
 * `intersectViableCandidates` + `getBatchVendorAvailableDays`, called by both.
 *
 * ⚠ THE SET IS THE CONFIRMED VENDORS, FULL STOP. It does not take a "plus this
 * target" argument, because by the time an agreement calls it the agreeing
 * supplier IS confirmed — the RPC wrote 'contracted' in the same statement it
 * wrote 'agreed'. Adding them again would be harmless arithmetic and a standing
 * invitation to pass an UNCONFIRMED vendor, which is exactly the defect that
 * moved this code.
 */

export type DateNarrowingOutcome =
  /** Nothing to do: a date is already set, or there were never candidates. */
  | { status: 'no_op' }
  /** More than one candidate still works for the whole team. */
  | { status: 'still_open'; remaining: number }
  /** Exactly one candidate left AND it was written. */
  | { status: 'locked'; date: string }
  /** Exactly one left, but the write matched zero rows — a date landed from
   *  somewhere else between the read and the write. NOT an error, and NOT
   *  reportable as a lock: the couple's date is whatever won that race. */
  | { status: 'lost_race' };

/**
 * @param db the client to read and write `events` with.
 *
 * ⚠ THE AGREEMENT PATH MUST PASS THE ADMIN CLIENT, and that is not a shortcut.
 * The caller there is the SUPPLIER, who has no RLS path to `events` at all —
 * `date_candidates` lives behind the couple-scoped read and the update is
 * couple-only. Their own session would come back with zero rows, which this
 * function would read as "no candidates" and quietly do nothing, forever.
 * Authorization for the whole act was already established one step earlier by
 * `vendor_agree_to_lock`, which is DEFINER, owns the ownership gate, and returns
 * the `event_id` READ OFF THE ROW IT AUTHORIZED — so nothing here trusts an id
 * the vendor supplied.
 */
export async function narrowEventDateAfterAgreement(
  db: SupabaseClient,
  args: { eventId: string; forcedByEventVendorId: string },
): Promise<DateNarrowingOutcome> {
  const { eventId, forcedByEventVendorId } = args;

  const { data: dateRow, error: dateReadErr } = await db
    .from('events')
    .select('event_date, date_candidates, ceremony_type, secondary_ceremony_type')
    .eq('event_id', eventId)
    .maybeSingle();
  // 🪤 A REJECTED READ IS NOT A THROWN ERROR. Treating `error` as "no date set"
  // would send this function on to WRITE one off an empty candidate list.
  if (dateReadErr || !dateRow) return { status: 'no_op' };

  const existingDate = (dateRow as { event_date?: string | null }).event_date ?? null;
  if (existingDate) return { status: 'no_op' };

  const candidates = Array.isArray((dateRow as { date_candidates?: unknown }).date_candidates)
    ? ((dateRow as { date_candidates: unknown[] }).date_candidates).filter(
        (s): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s),
      )
    : [];
  if (candidates.length === 0) return { status: 'no_op' };

  const { data: lockedRows } = await db
    .from('event_vendors')
    .select('marketplace_vendor_id')
    .eq('event_id', eventId)
    .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[])
    .is('archived_at', null)
    .not('marketplace_vendor_id', 'is', null);
  const profileIds = [
    ...new Set<string>((lockedRows ?? []).map((r) => r.marketplace_vendor_id as string)),
  ];
  // Nobody confirmed yet ⇒ nothing constrains the candidates. Bailing out is not
  // merely an optimisation: `intersectViableCandidates` over an EMPTY constraint
  // set would report every candidate viable, and on a one-candidate shortlist
  // that reads as "narrowed to one" and writes a date no supplier ever agreed to.
  if (profileIds.length === 0) return { status: 'still_open', remaining: candidates.length };

  const sorted = [...candidates].sort();
  const [ys = 2027, ms = 1, ds = 1] = (sorted[0] ?? '2027-01-01').split('-').map(Number);
  const [ye = 2027, me = 1, de = 1] = (sorted[sorted.length - 1] ?? sorted[0] ?? '2027-01-01')
    .split('-')
    .map(Number);
  const avail = await getBatchVendorAvailableDays(
    createAdminClient(),
    profileIds,
    new Date(ys, ms - 1, ds),
    new Date(ye, me - 1, de),
  );
  const viable = intersectViableCandidates(candidates, avail, profileIds);
  if (viable.length !== 1) return { status: 'still_open', remaining: viable.length };

  const forced = viable[0]!;
  const meaningAdmin = createAdminClient();
  const { data: meaningfulRows } = await meaningAdmin
    .from('event_meaningful_dates')
    .select('meaningful_date, kind, note')
    .eq('event_id', eventId);
  const [yy = 2027, mm = 1, dd = 1] = forced.split('-').map(Number);
  const reasons = computeAuspiciousReasons(
    new Date(yy, mm - 1, dd),
    asCeremonyType((dateRow as { ceremony_type?: unknown }).ceremony_type),
    (meaningfulRows ?? []).map((r) => ({
      date: r.meaningful_date as string,
      kind: r.kind as MeaningfulDateKind,
      note: (r.note as string | null) ?? null,
    })),
    isChineseWedding(dateRow),
  );

  // ⚠ `.is('event_date', null)` is a CONCURRENCY guard and it must stay: the
  // read above is TOCTOU, and this is the only thing stopping a slow agreement
  // from clobbering a date the couple set in a parallel tab.
  //
  // 🪤 AND A GUARDED UPDATE THAT MATCHES ZERO ROWS SUCCEEDS WITH NO ERROR.
  // `!error` therefore does NOT mean "the date was written" — the same trap
  // `finalizeVendor` already carries in its own comment, which is why the row
  // count is the answer here and the absence of an error is not.
  const { data: dateRows, error: dateErr } = await db
    .from('events')
    .update({
      event_date: forced,
      event_date_precision: 'day',
      date_status: 'locked',
      auspicious_reasons: reasons,
      // WHOSE agreement created this date — stamped in the SAME statement, so
      // the stamp lands if and only if this write did.
      date_forced_by_lock_of: forcedByEventVendorId,
    })
    .eq('event_id', eventId)
    .is('event_date', null)
    .select('event_id');
  if (dateErr || (dateRows?.length ?? 0) === 0) return { status: 'lost_race' };
  return { status: 'locked', date: forced };
}
