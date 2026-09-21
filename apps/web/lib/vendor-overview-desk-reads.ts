/**
 * vendor-overview-desk-reads.ts — the four ADMIN-scoped `event_vendors` reads
 * behind the Overview's answers desk, split out of `lib/vendor-overview.ts`
 * because that module is `server-only` and a test cannot import it.
 *
 *   · `readDepositsAwaitingAcknowledgement` — "Confirm the deposit" cards (money).
 *   · `readDeclinedDepositIds` — deposits the shop already answered "it never
 *     arrived", which leave the desk.
 *   · `readLockAgreementRequests` — "Agree to a booking" asks, each on a 7-day fuse.
 *   · `readDeletionRequests` — "a celebration you were paid for is being removed".
 *   · `readBookingsAwaitingCompletion` — "your event is over, mark it delivered",
 *     the starter motor of the whole after-the-event chain (CTRL-B2 build 1).
 *
 * ⚠ PAGED TO THE SERVER'S EXACT COUNT (`readAllPages`). Each was one un-ranged
 * SELECT, and PostgREST caps a response at 1,000 rows with `error: null` — so a
 * shop past a thousand rows silently lost the rest, and the rows it lost were
 * the OLDEST asks (the lock read is oldest-first) or the oldest deposits.
 *
 * 🔑 EVERY READ SAYS WHETHER IT FINISHED. `fetchLockAgreementRequests` used to
 * discard its error outright, so a refused read rendered the desk as "You're
 * all caught up" — byte-identical to a shop with nothing waiting. The caller
 * turns `complete: false` into a "couldn't load" line on the Overview.
 *
 * Every query orders on a unique tiebreaker (`vendor_id`) after its sort key, so
 * the range windows cannot skip or repeat a row between pages.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAllPages } from '@/lib/read-all-pages';

export type DeskRead<T> = { rows: T[]; error: string | null; complete: boolean };

const PAGE = 1000;

export type DepositAwaitingRow = {
  vendor_id: string;
  event_id: string;
  vendor_name: string | null;
  deposit_recorded_at: string;
  deposit_acknowledged_at: string | null;
  deposit_proof_url: string | null;
};

/** Deposits a couple recorded that this shop has not yet confirmed. */
/**
 * 🔒 THE COLUMN LIST IS THE CALLER'S. It names the couple's private receipt,
 * and `deposit-proofs-are-private.test.ts` holds every file that SELECTS that
 * column to showing it only through `depositProofDisplayUrl` — which is
 * server-only and lives with the caller (`lib/vendor-overview.ts`), not here.
 */
export async function readDepositsAwaitingAcknowledgement(
  admin: SupabaseClient,
  vendorProfileId: string,
  columns: string,
): Promise<DeskRead<DepositAwaitingRow>> {
  const read = await readAllPages(
    async (from, to) => {
      const { data, error, count } = await admin
        .from('event_vendors')
        .select(columns, { count: 'exact' })
        .eq('marketplace_vendor_id', vendorProfileId)
        .not('deposit_recorded_at', 'is', null)
        .is('deposit_acknowledged_at', null)
        // PR-I · §12.2 step 9. This feed hands its raw `vendor_id` straight to
        // `vendorAcknowledgeDeposit`, which moves MONEY — so it must never
        // offer a row that is not a sale: a `covered` cascade line carries ₱0
        // (the anchor is the money row), and an archived row is a
        // rejected/withdrawn booking. `resolveFeeAnchorRowId` is the backstop.
        .or('package_role.is.null,package_role.eq.anchor')
        .is('archived_at', null)
        .order('deposit_recorded_at', { ascending: false })
        .order('vendor_id', { ascending: true })
        .range(from, to);
      return { rows: data ?? null, error: error ? error.message : null, total: count };
    },
    { pageSize: PAGE },
  );
  return { rows: read.rows as DepositAwaitingRow[], error: read.error, complete: read.complete };
}

/**
 * Claims this shop already ANSWERED with "it never arrived". Its own read (not
 * a filter on the one above) so the answered set is a separate fact; an
 * incomplete read here would put an answered claim back on the desk, so it is
 * reported like the others rather than degraded to "none answered".
 */
export async function readDeclinedDepositIds(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<{ ids: Set<string>; error: string | null; complete: boolean }> {
  const read = await readAllPages(
    async (from, to) => {
      const { data, error, count } = await admin
        .from('event_vendors')
        .select('vendor_id', { count: 'exact' })
        .eq('marketplace_vendor_id', vendorProfileId)
        .not('deposit_declined_at', 'is', null)
        .order('vendor_id', { ascending: true })
        .range(from, to);
      return { rows: data ?? null, error: error ? error.message : null, total: count };
    },
    { pageSize: PAGE },
  );
  const ids = new Set((read.rows as { vendor_id: string }[]).map((r) => r.vendor_id));
  return { ids, error: read.error, complete: read.complete };
}

export type LockAgreementRow = {
  vendor_id: string;
  event_id: string;
  lock_requested_at: string;
  lock_request_expires_at: string | null;
};

/** "Which couples asked this shop to agree to a booking?" — oldest first. */
export async function readLockAgreementRequests(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<DeskRead<LockAgreementRow>> {
  const read = await readAllPages(
    async (from, to) => {
      const { data, error, count } = await admin
        .from('event_vendors')
        .select('vendor_id, event_id, lock_requested_at, lock_request_expires_at', {
          count: 'exact',
        })
        .eq('marketplace_vendor_id', vendorProfileId)
        .eq('lock_request_state', 'pending')
        // A confirmed row can carry a stale 'pending' marker — the printed
        // Locked-QR path promotes to deposit_paid without touching any lock_*
        // column — and an "agree?" card for a booking already paid is nonsense.
        .not('status', 'in', '("contracted","deposit_paid","delivered","complete")')
        // A covered cascade line carries no request of its own; only the anchor
        // is asked. An archived row is a withdrawn booking.
        .or('package_role.is.null,package_role.eq.anchor')
        .is('archived_at', null)
        .order('lock_requested_at', { ascending: true })
        .order('vendor_id', { ascending: true })
        .range(from, to);
      return { rows: data ?? null, error: error ? error.message : null, total: count };
    },
    { pageSize: PAGE },
  );
  return { rows: read.rows as LockAgreementRow[], error: read.error, complete: read.complete };
}

export type DeletionRequestRow = {
  vendor_id: string;
  event_id: string;
  delete_requested_at: string;
};

/**
 * Celebrations this shop was PAID for that the couple asked to remove. The lock
 * read's status floor is deliberately NOT copied — the ask goes precisely to
 * paid suppliers (see the docblock in `lib/vendor-overview.ts`).
 */
export async function readDeletionRequests(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<DeskRead<DeletionRequestRow>> {
  const read = await readAllPages(
    async (from, to) => {
      const { data, error, count } = await admin
        .from('event_vendors')
        .select('vendor_id, event_id, delete_requested_at', { count: 'exact' })
        .eq('marketplace_vendor_id', vendorProfileId)
        .eq('delete_request_state', 'pending')
        .or('package_role.is.null,package_role.eq.anchor')
        .is('archived_at', null)
        .order('delete_requested_at', { ascending: true })
        .order('vendor_id', { ascending: true })
        .range(from, to);
      return { rows: data ?? null, error: error ? error.message : null, total: count };
    },
    { pageSize: PAGE },
  );
  return { rows: read.rows as DeletionRequestRow[], error: read.error, complete: read.complete };
}

export type CompletionAwaitingRow = {
  vendor_id: string;
  event_id: string;
  vendor_name: string | null;
  status: string | null;
  service_marked_complete_at: string | null;
};

/**
 * Bookings whose celebration has happened and which nobody has marked
 * delivered.
 *
 * ── WHY THIS READ DID NOT EXIST ────────────────────────────────────────────
 * `coupleConfirmReceived` requires `service_marked_complete_at`. Measured
 * 2026-09-22: **51 bookings, that column set on 0 of them, and `vendor_reviews`
 * empty.** No couple has ever been able to confirm delivery, so no review has
 * ever been possible, so no shop has a track record. Nothing anywhere asked a
 * supplier for the mark — there was no `mark_complete` kind on the desk at all.
 *
 * The DATE test is deliberately left to `needsCompletionMark` (pure, in
 * `answers-desk.ts`) rather than done in SQL: "the day after, in Manila" is the
 * part that can be got wrong, and a `.lt('event_date', today)` here would be a
 * second, silent copy of that rule computed in the server's timezone.
 * This query narrows to what is cheap and unambiguous — this shop, really
 * booked, not yet marked, not archived.
 */
export async function readBookingsAwaitingCompletion(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<DeskRead<CompletionAwaitingRow>> {
  const read = await readAllPages(
    async (from, to) => {
      const { data, error, count } = await admin
        .from('event_vendors')
        .select('vendor_id, event_id, vendor_name, status, service_marked_complete_at', {
          count: 'exact',
        })
        .eq('marketplace_vendor_id', vendorProfileId)
        .is('service_marked_complete_at', null)
        .in('status', ['contracted', 'deposit_paid', 'delivered', 'complete'])
        // A `covered` cascade line is not a sale and did not work the day; an
        // archived row is a rejected or withdrawn booking. Same exclusions the
        // deposit read makes, for the same reason.
        .or('package_role.is.null,package_role.eq.anchor')
        .is('archived_at', null)
        .order('vendor_id', { ascending: true })
        .range(from, to);
      return { rows: data ?? null, error: error ? error.message : null, total: count };
    },
    { pageSize: PAGE },
  );
  return {
    rows: read.rows as CompletionAwaitingRow[],
    error: read.error,
    complete: read.complete,
  };
}
