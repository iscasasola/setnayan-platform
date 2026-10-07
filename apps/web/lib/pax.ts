import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from './supabase/admin';
import { guestListIsClosed } from './guest-list-closed';
import { computeAddedPaxSurcharge } from './added-pax-surcharge';
import { PASSED_AWAY, REQUEST_ENTRY_SOURCE } from './guests';

// Which guests count toward the live pax (events.headcount_basis). 'attending'
// = sure guests only (owner-locked default). Mirrors the same union in
// lib/guests.ts (kept local so this server module is import-independent).
export type HeadcountBasis = 'attending' | 'attending_plus_maybe' | 'invited';

// ---------------------------------------------------------------------------
// Adaptive Pax Pricing — server-side helpers (2026-06-13).
//
// The "live pax" for an event = max(minimum-pax floor, live headcount on the
// event's basis). It is the vendor-facing number once it tops the floor, and
// the value snapshotted onto a chat_threads inquiry. The pure progress/meter
// helpers live in lib/guests.ts (computePaxProgress); this module holds the
// helpers that need a DB read.
// ---------------------------------------------------------------------------

// Live headcount on a basis (the count query, shared by resolveLivePax +
// finalizeGuestList so the floor math and the finalize snapshot never diverge).
async function liveHeadcount(
  supabase: SupabaseClient,
  eventId: string,
  basis: HeadcountBasis,
): Promise<number> {
  let q = supabase
    .from('guests')
    .select('guest_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('deleted_at', null)
    // 🛂 A request counts for nothing until Keep or Link (lib/guests.ts).
    .neq('entry_source', REQUEST_ENTRY_SOURCE).eq(PASSED_AWAY, false);
  if (basis === 'invited') {
    q = q.neq('rsvp_status', 'declined');
  } else if (basis === 'attending_plus_maybe') {
    q = q.in('rsvp_status', ['attending', 'maybe']);
  } else {
    q = q.eq('rsvp_status', 'attending');
  }
  const { count } = await q;
  return count ?? 0;
}

export type FinalizeState = {
  /** Guest list is finalized — the binding count is frozen. */
  locked: boolean;
  /** The frozen binding count (null until finalized). */
  finalPax: number | null;
  estimatedPax: number | null;
  basis: HeadcountBasis;
};

/**
 * The guest list's finalize state — a READ, never a write.
 *
 * ⚖ OWNER RULING 2026-09-30 (DECISION_LOG): *"i must click a finalize to
 * finalize it."* This used to be a lazy auto-finalize: past the guest-list
 * deadline (or `event_date − 14 days` when none was set) the first couple-side
 * page load stamped `guest_count_locked_at`. On a birthday created ON its own
 * day that deadline was already two weeks gone, so the host's first visit to
 * the Guest list locked it, and every add after that was refused. The stamp is
 * now written ONLY by `finalizeGuestList` below, when the host presses Finalize,
 * and nothing in this function may write.
 */
export async function readFinalizeState(
  supabase: SupabaseClient,
  eventId: string,
): Promise<FinalizeState> {
  const { data: ev } = await supabase
    .from('events')
    .select('estimated_pax, headcount_basis, guest_count_locked_at, final_pax')
    .eq('event_id', eventId)
    .maybeSingle();

  const estimatedPax: number | null = ev?.estimated_pax ?? null;
  const basis = (ev?.headcount_basis ?? 'attending') as HeadcountBasis;
  if (!ev) return { locked: false, finalPax: null, estimatedPax, basis };
  const locked = guestListIsClosed({ lockedAt: ev.guest_count_locked_at });
  return { locked, finalPax: locked ? (ev.final_pax ?? null) : null, estimatedPax, basis };
}

/**
 * 🔒 THE FENCE for finalize: the caller is a HOST (a `couple` member)
 * of this event. Not "can read the event row": a published event page is
 * readable far more widely than it is ownable. Read with the caller's OWN
 * session and scoped by `user_id` explicitly, so RLS is defence in depth and
 * never the fence (an admin's RLS reaches every event).
 */
async function callerHostsEvent(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<'yes' | 'no' | 'unknown'> {
  const { data, error } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('member_type', 'couple')
    .limit(1);
  if (error) return 'unknown';
  return (data ?? []).length > 0 ? 'yes' : 'no';
}

export type FinalizeResult = { ok: true; state: FinalizeState } | { ok: false; error: string };

/**
 * The host presses Finalize. Freezes the binding count at
 * `max(estimated_pax, headcount)` and stamps `guest_count_locked_at`, after
 * which `guard_guest_edits_when_locked` refuses count changes and guests can no
 * longer reply.
 *
 * The WRITE goes through the service-role client because
 * `guard_pax_finalize_columns` reverts any other writer: the binding count is
 * money, and a couple must not be able to PATCH it directly. So the CALLER must
 * pass the signed-in user, and `callerHostsEvent` refuses anyone who is not a
 * host of this event before anything is written.
 */
export async function finalizeGuestList(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<FinalizeResult> {
  const hosts = await callerHostsEvent(supabase, eventId, userId);
  if (hosts === 'unknown') return { ok: false, error: 'Couldn’t reach your event just now — nothing was changed.' };
  if (hosts === 'no') return { ok: false, error: 'Only the hosts can finalize this guest list.' };
  const { data: ev, error } = await supabase
    .from('events')
    .select('event_id, estimated_pax, headcount_basis, guest_count_locked_at')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) return { ok: false, error: 'Couldn’t reach your event just now — nothing was changed.' };
  if (!ev) return { ok: false, error: 'Couldn’t reach your event just now — nothing was changed.' };
  const admin = createAdminClient();
  if (!ev.guest_count_locked_at) {
    const basis = (ev.headcount_basis ?? 'attending') as HeadcountBasis;
    const count = await liveHeadcount(admin, eventId, basis);
    const computed = Math.max(ev.estimated_pax ?? 0, count);
    const { error: upErr } = await admin
      .from('events')
      .update({
        guest_count_locked_at: new Date().toISOString(),
        // null when there is genuinely nothing to anchor on (no estimate AND no
        // guests): resolveLivePax then returns null = "no pax to price".
        final_pax: computed > 0 ? computed : null,
      })
      .eq('event_id', eventId)
      .is('guest_count_locked_at', null);
    if (upErr) return { ok: false, error: 'Couldn’t finalize just now — nothing was changed.' };
  }
  // Re-read what is actually stored: on a double press the second UPDATE
  // matches nothing, and the first press's frozen count is the true one.
  return { ok: true, state: await readFinalizeState(admin, eventId) };
}

/* 🔒 No host Reopen (owner 2026-10-07, DECISION_LOG "FINALIZING THE HEADCOUNT IS
   ONE-WAY"): the host's `reopenGuestList` was removed with the button. Only
   Setnayan support can unlock a list (`lib/admin-reopen-guest-list.ts`, admin-only). */

/**
 * True when the guest list is finalized — planning edits (add / RSVP / remove)
 * should be blocked. Thin wrapper over readFinalizeState for the guest-mutation
 * pre-checks; the DB trigger guard_guest_edits_when_locked is the backstop.
 */
export async function guestEditsLocked(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return (await readFinalizeState(supabase, eventId)).locked;
}

/**
 * Live pax = the frozen final_pax once the list is finalized, else
 * max(events.estimated_pax floor, live headcount on the event's basis). Only
 * SURE attending guests count by default (the owner-locked basis). Never
 * finalizes anything itself. Returns null when there's nothing to anchor on.
 */
export async function resolveLivePax(
  supabase: SupabaseClient,
  eventId: string,
): Promise<number | null> {
  const fin = await readFinalizeState(supabase, eventId);
  if (fin.locked) return fin.finalPax;
  const headcount = await liveHeadcount(supabase, eventId, fin.basis);
  if (fin.estimatedPax == null && headcount === 0) return null;
  return Math.max(fin.estimatedPax ?? 0, headcount);
}

// ---------------------------------------------------------------------------
// Phase 5 — per-vendor surcharge for guests above the quoted count.
// ---------------------------------------------------------------------------

/**
 * MOVED to `lib/added-pax-surcharge.ts` (2026-09-22) so a pure module — and a
 * plain `node:test` file — can import the rule without dragging in the admin
 * client this file needs. Re-exported here under the same name; every existing
 * importer is unchanged. One rule, one place.
 */
export { computeAddedPaxSurcharge } from './added-pax-surcharge';

export type PaxSurchargeProposal = {
  /** event_vendors.vendor_id (the booking row id) — Accept/Decline target. */
  eventVendorId: string;
  label: string;
  livePax: number;
  /** Count the base price covers (the surcharge floor). */
  quoteBasePax: number;
  ratePhp: number;
  block: number;
  /** Surcharge currently baked into total_cost_php. */
  appliedSurcharge: number;
  /** Surcharge the live pax now implies. */
  targetSurcharge: number;
  /** What Accept would change total_cost_php by (can be negative on a drop). */
  delta: number;
};

/**
 * Pending surcharge proposals for one vendor on one event: the booked services
 * (total_cost_php set) that carry a per-added-guest rate AND whose live pax has
 * moved away from the count last decided on (cost_basis_pax), producing a cost
 * delta the vendor must confirm. Symmetric — a drop yields a negative delta.
 * Base defaults to the inquiry snapshot when not yet locked. Returns [] when
 * nothing is pending (no rate, no movement, or no committed cost).
 */
export async function fetchVendorPaxProposals(
  supabase: SupabaseClient,
  opts: {
    eventId: string;
    vendorProfileId: string;
    livePax: number | null;
    paxAtInquiry: number | null;
  },
): Promise<PaxSurchargeProposal[]> {
  const { eventId, vendorProfileId, livePax, paxAtInquiry } = opts;
  if (livePax == null) return [];

  // Pricing-view mode (decision #5, Phase 9): in 'final_only' the couple opted
  // to settle the adjustment ONCE at finalization — so suppress surcharge
  // proposals while the count is still moving (not yet locked). Realtime (the
  // default) proposes continuously. Once finalized, the binding adjustment
  // proposal appears in both modes.
  const { data: ev } = await supabase
    .from('events')
    .select('adaptive_pricing_mode, guest_count_locked_at')
    .eq('event_id', eventId)
    .maybeSingle();
  if (ev?.adaptive_pricing_mode === 'final_only' && !ev?.guest_count_locked_at) {
    return [];
  }

  const { data: rows } = await supabase
    .from('event_vendors')
    .select(
      'vendor_id, category, vendor_name, service_id, total_cost_php, pax_quote_base, pax_surcharge_php, cost_basis_pax',
    )
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', vendorProfileId);
  if (!rows || rows.length === 0) return [];

  const serviceIds = Array.from(
    new Set(rows.map((r) => r.service_id).filter((v): v is string => !!v)),
  );
  const rateByService = new Map<string, { rate: number | null; block: number }>();
  if (serviceIds.length > 0) {
    const { data: svcs } = await supabase
      .from('vendor_services')
      .select('vendor_service_id, added_pax_price_php, added_pax_block, title')
      .in('vendor_service_id', serviceIds);
    for (const s of svcs ?? []) {
      rateByService.set(s.vendor_service_id, {
        rate: s.added_pax_price_php ?? null,
        block: s.added_pax_block ?? 1,
      });
    }
  }

  const proposals: PaxSurchargeProposal[] = [];
  for (const r of rows) {
    // Only committed costs can be surcharged — nothing to adjust otherwise.
    if (r.total_cost_php == null) continue;
    const svc = r.service_id ? rateByService.get(r.service_id) : undefined;
    const ratePhp = svc?.rate ?? null;
    if (!ratePhp || ratePhp <= 0) continue; // no rate → no surcharge (owner fallback)

    const quoteBasePax = r.pax_quote_base ?? paxAtInquiry ?? livePax;
    const block = svc?.block ?? 1;
    const targetSurcharge = computeAddedPaxSurcharge({
      livePax,
      quoteBasePax,
      ratePhp,
      block,
    });
    const appliedSurcharge = r.pax_surcharge_php ?? 0;
    const delta = targetSurcharge - appliedSurcharge;
    // Pending = the count has moved since the last decision AND the surcharge
    // it implies differs from what's already applied.
    if (delta === 0) continue;
    if (r.cost_basis_pax != null && r.cost_basis_pax === livePax) continue;

    proposals.push({
      eventVendorId: r.vendor_id,
      label: r.vendor_name ?? r.category ?? 'Service',
      livePax,
      quoteBasePax,
      ratePhp,
      block,
      appliedSurcharge,
      targetSurcharge,
      delta,
    });
  }
  return proposals;
}
