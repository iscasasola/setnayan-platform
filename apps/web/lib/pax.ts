import type { SupabaseClient } from '@supabase/supabase-js';

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

/**
 * Resolve the live pax for an event from the DB:
 *   max(events.estimated_pax floor, headcount on events.headcount_basis)
 * Only SURE attending guests count by default (the owner-locked basis); the
 * other bases are honored if the couple ever switches. Returns null when there
 * is nothing to anchor on (no target set AND no qualifying guests) — callers
 * treat null as "no pax to send / show".
 */
export async function resolveLivePax(
  supabase: SupabaseClient,
  eventId: string,
): Promise<number | null> {
  const { data: ev } = await supabase
    .from('events')
    .select('estimated_pax, headcount_basis')
    .eq('event_id', eventId)
    .maybeSingle();

  const estimatedPax: number | null = ev?.estimated_pax ?? null;
  const basis = (ev?.headcount_basis ?? 'attending') as HeadcountBasis;

  let headQuery = supabase
    .from('guests')
    .select('guest_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('deleted_at', null);
  if (basis === 'invited') {
    headQuery = headQuery.neq('rsvp_status', 'declined');
  } else if (basis === 'attending_plus_maybe') {
    headQuery = headQuery.in('rsvp_status', ['attending', 'maybe']);
  } else {
    headQuery = headQuery.eq('rsvp_status', 'attending');
  }
  const { count } = await headQuery;
  const headcount = count ?? 0;

  if (estimatedPax == null && headcount === 0) return null;
  return Math.max(estimatedPax ?? 0, headcount);
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
