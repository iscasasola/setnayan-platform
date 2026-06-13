import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from './supabase/admin';

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
// ensureFinalized so the floor math and the finalize snapshot never diverge).
async function liveHeadcount(
  supabase: SupabaseClient,
  eventId: string,
  basis: HeadcountBasis,
): Promise<number> {
  let q = supabase
    .from('guests')
    .select('guest_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('deleted_at', null);
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
 * Lazy auto-finalize (Phase 7, owner decision #6) — cron-free. If the guest-list
 * edit deadline has passed and the event isn't yet locked, stamp
 * guest_count_locked_at + freeze final_pax = max(estimated_pax, headcount). Once
 * locked, the binding count never moves again (late RSVPs / accepted claims
 * can't change a vendor's cost). Idempotent + race-safe (the UPDATE is gated on
 * guest_count_locked_at IS NULL). Returns the finalize state either way.
 */
export async function ensureFinalized(
  supabase: SupabaseClient,
  eventId: string,
): Promise<FinalizeState> {
  const { data: ev } = await supabase
    .from('events')
    .select(
      'estimated_pax, headcount_basis, guest_list_edit_deadline, guest_count_locked_at, final_pax, event_date',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  const estimatedPax: number | null = ev?.estimated_pax ?? null;
  const basis = (ev?.headcount_basis ?? 'attending') as HeadcountBasis;
  if (!ev) return { locked: false, finalPax: null, estimatedPax, basis };

  if (ev.guest_count_locked_at) {
    return { locked: true, finalPax: ev.final_pax ?? null, estimatedPax, basis };
  }

  // Effective deadline (end of day): the couple's explicit date, else 14 days
  // before the event — a sane default (FINALIZE_LEAD_DAYS, provisional) so
  // auto-finalize works out-of-box; the explicit column overrides once the
  // settings UI to change it lands. No event date + no explicit → never locks.
  // Parsed as UTC (trailing 'Z') so the lock fires at the same instant
  // regardless of the server's timezone — a couple's end-of-deadline-day in
  // UTC. (Review fix: bare "T23:59:59" parses as server-local time.)
  const FINALIZE_LEAD_DAYS = 14;
  let deadlineEnd: number | null = null;
  if (ev.guest_list_edit_deadline) {
    deadlineEnd = Date.parse(`${ev.guest_list_edit_deadline}T23:59:59Z`);
  } else if (ev.event_date) {
    const d = new Date(`${ev.event_date}T23:59:59Z`);
    d.setUTCDate(d.getUTCDate() - FINALIZE_LEAD_DAYS);
    deadlineEnd = d.getTime();
  }
  if (deadlineEnd == null || Number.isNaN(deadlineEnd) || Date.now() <= deadlineEnd) {
    return { locked: false, finalPax: null, estimatedPax, basis };
  }
  // Deadline passed → finalize now (freeze the binding count). The WRITE goes
  // through the service-role admin client (not the caller's, which may be the
  // couple's RLS client) — both so the column-guard trigger
  // (guard_pax_finalize_columns) permits it AND so a couple can't forge the
  // lock via the API. The lazy lock is a write-on-read (cron-free, per the
  // cron-free lock); idempotent + rare.
  const admin = createAdminClient();
  const count = await liveHeadcount(admin, eventId, basis);
  const computed = Math.max(estimatedPax ?? 0, count);
  // null when a finalized event genuinely has nothing to anchor on (no estimate
  // AND no guests) — intentional: resolveLivePax then returns null = "no pax to
  // price", which is correct for an empty finalized event.
  const computedFinalPax = computed > 0 ? computed : null;
  await admin
    .from('events')
    .update({
      guest_count_locked_at: new Date().toISOString(),
      final_pax: computedFinalPax,
    })
    .eq('event_id', eventId)
    .is('guest_count_locked_at', null);
  // Re-read the AUTHORITATIVE persisted values (review fix): on a finalize race
  // the loser's UPDATE matches 0 rows, so trust the DB, not the local compute —
  // the loser returns the winner's frozen value, never a stale snapshot.
  const { data: after } = await admin
    .from('events')
    .select('guest_count_locked_at, final_pax')
    .eq('event_id', eventId)
    .maybeSingle();
  return {
    locked: Boolean(after?.guest_count_locked_at),
    finalPax: after?.final_pax ?? null,
    estimatedPax,
    basis,
  };
}

/**
 * True when the guest list is finalized — planning edits (add / RSVP / remove)
 * should be blocked. Thin wrapper over ensureFinalized for the guest-mutation
 * pre-checks; the DB trigger guard_guest_edits_when_locked is the backstop.
 */
export async function guestEditsLocked(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return (await ensureFinalized(supabase, eventId)).locked;
}

/**
 * Live pax = the frozen final_pax once the list is finalized, else
 * max(events.estimated_pax floor, live headcount on the event's basis). Only
 * SURE attending guests count by default (the owner-locked basis). Auto-finalizes
 * lazily. Returns null when there's nothing to anchor on.
 */
export async function resolveLivePax(
  supabase: SupabaseClient,
  eventId: string,
): Promise<number | null> {
  const fin = await ensureFinalized(supabase, eventId);
  if (fin.locked) return fin.finalPax;
  const headcount = await liveHeadcount(supabase, eventId, fin.basis);
  if (fin.estimatedPax == null && headcount === 0) return null;
  return Math.max(fin.estimatedPax ?? 0, headcount);
}

// ---------------------------------------------------------------------------
// Phase 5 — per-vendor surcharge for guests above the quoted count.
// ---------------------------------------------------------------------------

/**
 * The vendor surcharge (PHP) for the live pax above the count their base price
 * was quoted against: ceil((livePax - quoteBase) / block) * ratePhp.
 * Returns 0 when no rate, no base, or pax is at/below the base — i.e. the owner
 * fallback "no rate → no extra charge". Pure; mirrors the customer floor+block
 * model (computePaxPriceCentavos).
 */
export function computeAddedPaxSurcharge(params: {
  livePax: number | null;
  quoteBasePax: number | null;
  ratePhp: number | null;
  block?: number | null;
}): number {
  const { livePax, quoteBasePax, ratePhp } = params;
  const block = params.block && params.block > 0 ? params.block : 1;
  if (!ratePhp || ratePhp <= 0) return 0;
  if (livePax == null || quoteBasePax == null) return 0;
  const extra = livePax - quoteBasePax;
  if (extra <= 0) return 0;
  return Math.ceil(extra / block) * ratePhp;
}

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
