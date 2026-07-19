import type { SupabaseClient } from '@supabase/supabase-js';
import { blockRelevance, deriveCallTime, type LensBlock } from '@/lib/vendor-timeline';
import { formatCentavos, type ProposalLineItem, type ProposalTokenKey } from '@/lib/vendor-proposals';

/**
 * Proposal merge-token resolution — extracted from createProposal so the
 * vendor-dashboard proposals page AND the in-chat "send a proposal" action
 * resolve tokens through the SAME deterministic path (no drift, no duplicate
 * privilege). Pure over an already-authorized brief; the chat path passes a
 * minimal brief for inquiry-stage (not-yet-booked) proposals, which simply
 * yields fewer resolved tokens.
 */

export type ProposalBrief = {
  event: {
    display_name: string | null;
    event_date: string | null;
    venue_name: string | null;
    venue_address: string | null;
  };
  booked_categories: string[];
  pax: { invited: number; attending: number; maybe: number; pending: number };
  dietary: { meal_counts: Record<string, number> } | null;
  timeline: { label: string; block_type: string; start_at: string | null }[];
  seat_plan: { table_count: number };
};

const MEAL_LABELS: Record<string, string> = {
  beef: 'beef',
  chicken: 'chicken',
  fish: 'fish',
  vegetarian: 'vegetarian',
  vegan: 'vegan',
  kids: 'kids meal',
  no_preference: 'no preference',
};

function fmtLongDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

/** A booked-event brief with no shared planning data — for inquiry-stage proposals. */
export function minimalBrief(event: ProposalBrief['event']): ProposalBrief {
  return {
    event,
    booked_categories: [],
    pax: { invited: 0, attending: 0, maybe: 0, pending: 0 },
    dietary: null,
    timeline: [],
    seat_plan: { table_count: 0 },
  };
}

/**
 * Resolve the proposal merge values from a brief. Unresolvable counts (no pax
 * shared yet) stay null so resolveTokens renders them as explicit placeholders.
 */
export function resolveProposalValues(
  brief: ProposalBrief,
  opts: { businessName: string | null; packageName: string | null; totalCentavos: number },
): Partial<Record<ProposalTokenKey, string | null>> {
  const { pax } = brief;
  const mealBreakdown = brief.dietary
    ? Object.entries(brief.dietary.meal_counts)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${n} ${MEAL_LABELS[k] ?? k.replace(/_/g, ' ')}`)
        .join(' · ')
    : null;
  const timeline = brief.timeline as LensBlock[];
  const mySlot = timeline
    .filter((b) => b.start_at && blockRelevance(b, brief.booked_categories) === 'primary')
    .sort((a, b) => (a.start_at as string).localeCompare(b.start_at as string))[0];
  const callTime = deriveCallTime(timeline, brief.booked_categories);

  return {
    couple_name: brief.event.display_name,
    event_date: fmtLongDate(brief.event.event_date),
    venue_name: brief.event.venue_name,
    venue_address: brief.event.venue_address,
    guest_count: pax.invited > 0 ? String(pax.attending) : null,
    guest_count_expected: pax.invited > 0 ? String(pax.attending + pax.maybe) : null,
    guest_count_ceiling: pax.invited > 0 ? String(pax.attending + pax.maybe + pax.pending) : null,
    meal_breakdown: mealBreakdown,
    table_count: brief.seat_plan.table_count > 0 ? String(brief.seat_plan.table_count) : null,
    my_slot: mySlot ? `${mySlot.label} · ${fmtTime(mySlot.start_at)}` : null,
    call_time: callTime ? fmtTime(callTime.call_time) : null,
    package_name: opts.packageName,
    package_price: opts.totalCentavos > 0 ? formatCentavos(opts.totalCentavos) : null,
    business_name: opts.businessName,
  };
}

/**
 * Load a vendor package's default-included line items + total. RLS-scoped to the
 * caller's own org (the vendor_profile_id eq). Returns zeros if no package.
 */
export async function resolvePackageLineItems(
  supabase: SupabaseClient,
  vendorProfileId: string,
  packageId: string | null,
): Promise<{ packageName: string | null; totalCentavos: number; lineItems: ProposalLineItem[] }> {
  if (!packageId) return { packageName: null, totalCentavos: 0, lineItems: [] };
  const { data: pkg } = await supabase
    .from('vendor_packages')
    .select(
      'package_id, package_name, total_price_centavos, vendor_package_items ( service_description, canonical_service, replacement_value_centavos, is_default_included, display_order )',
    )
    .eq('package_id', packageId)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (!pkg) return { packageName: null, totalCentavos: 0, lineItems: [] };

  type PkgItem = {
    service_description: string;
    canonical_service: string;
    replacement_value_centavos: number;
    is_default_included: boolean;
    display_order: number;
  };
  const lineItems = ((pkg.vendor_package_items ?? []) as PkgItem[])
    .filter((i) => i.is_default_included)
    .sort((a, b) => a.display_order - b.display_order)
    .map((i) => ({
      label: i.service_description,
      detail: i.canonical_service.replace(/_/g, ' '),
      amount_centavos: Number(i.replacement_value_centavos) || null,
    }));

  return {
    packageName: pkg.package_name as string,
    totalCentavos: Number(pkg.total_price_centavos) || 0,
    lineItems,
  };
}
