/**
 * Proposal merge-token resolver — Vendor Portal data-link program ③
 * (corpus 03_Strategy/Vendor_Portal_Event_Data_Link_2026-06-13.md § 3.3).
 *
 * Deterministic string substitution over data the vendor is ALREADY
 * authorized to read (the Brief + catering-metrics RPCs). Unresolvable
 * tokens render as an explicit placeholder — never silently blank, never
 * guessed (admit-unknown house rule). Zero LLM.
 */

export const PROPOSAL_TOKENS = [
  'couple_name',
  'event_date',
  'venue_name',
  'venue_address',
  'guest_count',
  'guest_count_expected',
  'guest_count_ceiling',
  'meal_breakdown',
  'table_count',
  'my_slot',
  'call_time',
  'package_name',
  'package_price',
  'business_name',
] as const;

export type ProposalTokenKey = (typeof PROPOSAL_TOKENS)[number];

export const TOKEN_HINTS: Record<ProposalTokenKey, string> = {
  couple_name: "The couple's display name",
  event_date: 'Event date (long form)',
  venue_name: 'Venue name',
  venue_address: 'Venue address',
  guest_count: 'Confirmed attending guests',
  guest_count_expected: 'Confirmed + maybes',
  guest_count_ceiling: 'If every pending guest shows',
  meal_breakdown: 'Meal mix, e.g. "61 beef · 44 chicken" (food vendors)',
  table_count: 'Tables on the seat plan',
  my_slot: 'Your earliest key slot on the day-of timeline',
  call_time: 'Suggested setup/call time',
  package_name: 'The attached package name',
  package_price: 'The attached package price',
  business_name: 'Your business name',
};

export const UNRESOLVED = '⟨not yet shared by couple⟩';

/** Replace every {{token}} in the body; unknown or missing → explicit chip. */
export function resolveTokens(
  body: string,
  values: Partial<Record<ProposalTokenKey, string | null | undefined>>,
): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, raw: string) => {
    const key = raw.toLowerCase() as ProposalTokenKey;
    const v = values[key];
    return v != null && String(v).trim().length > 0 ? String(v) : UNRESOLVED;
  });
}

export function formatCentavos(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString('en-PH', {
    minimumFractionDigits: centavos % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export type ProposalLineItem = {
  label: string;
  detail?: string | null;
  amount_centavos: number | null;
};

export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
};

export const PROPOSAL_STATUS_TONE: Record<ProposalStatus, string> = {
  draft: 'bg-ink/5 text-ink/60',
  sent: 'bg-amber-100 text-amber-900',
  viewed: 'bg-amber-100 text-amber-900',
  accepted: 'bg-emerald-100 text-emerald-900',
  declined: 'bg-rose-100 text-rose-800',
  expired: 'bg-ink/5 text-ink/50',
};
