import type { SupabaseClient } from '@supabase/supabase-js';

export type VendorCategory =
  | 'venue'
  | 'religious_venue'
  | 'catering'
  | 'photographer'
  | 'videographer'
  | 'florist'
  | 'cake_maker'
  | 'host_emcee'
  | 'band_dj'
  | 'string_quartet'
  | 'choir'
  | 'officiant'
  | 'planner_coordinator'
  | 'makeup_artist'
  | 'hair_stylist'
  | 'gown_designer'
  | 'suit_designer'
  | 'rings'
  | 'invitations_stationery'
  | 'transportation'
  | 'lights_and_sound'
  | 'led_screens'
  | 'photobooth'
  | 'mobile_bar'
  | 'church_fees'
  | 'reception_decor'
  | 'security'
  | 'gifts_and_giveaways'
  | 'accommodation'
  | 'misc';

export type VendorStatus =
  | 'considering'
  | 'shortlisted'
  | 'contracted'
  | 'deposit_paid'
  | 'delivered'
  | 'complete';

export const VENDOR_CATEGORIES: ReadonlyArray<VendorCategory> = [
  'venue',
  'religious_venue',
  'catering',
  'photographer',
  'videographer',
  'florist',
  'cake_maker',
  'host_emcee',
  'band_dj',
  'string_quartet',
  'choir',
  'officiant',
  'planner_coordinator',
  'makeup_artist',
  'hair_stylist',
  'gown_designer',
  'suit_designer',
  'rings',
  'invitations_stationery',
  'transportation',
  'lights_and_sound',
  'led_screens',
  'photobooth',
  'mobile_bar',
  'church_fees',
  'reception_decor',
  'security',
  'gifts_and_giveaways',
  'accommodation',
  'misc',
];

export const VENDOR_CATEGORY_LABEL: Record<VendorCategory, string> = {
  venue: 'Venue',
  religious_venue: 'Religious Ceremony Venue',
  catering: 'Catering',
  photographer: 'Photographer',
  videographer: 'Videographer',
  florist: 'Florist',
  cake_maker: 'Cake maker',
  host_emcee: 'Host / Emcee',
  band_dj: 'Band / DJ',
  string_quartet: 'String quartet',
  choir: 'Choir',
  officiant: 'Officiant',
  planner_coordinator: 'Planner / Coordinator',
  makeup_artist: 'Makeup artist',
  hair_stylist: 'Hair stylist',
  gown_designer: 'Gown designer',
  suit_designer: 'Suit designer',
  rings: 'Rings',
  invitations_stationery: 'Invitations & stationery',
  transportation: 'Transportation',
  lights_and_sound: 'Lights & sound',
  led_screens: 'LED screens',
  photobooth: 'Photobooth',
  mobile_bar: 'Mobile bar',
  church_fees: 'Church fees',
  reception_decor: 'Reception decor',
  security: 'Security',
  gifts_and_giveaways: 'Gifts & giveaways',
  accommodation: 'Accommodation',
  misc: 'Miscellaneous',
};

export const VENDOR_STATUSES: ReadonlyArray<VendorStatus> = [
  'considering',
  'shortlisted',
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
];

export const VENDOR_STATUS_LABEL: Record<VendorStatus, string> = {
  considering: 'Considering',
  shortlisted: 'Shortlisted',
  contracted: 'Contracted',
  deposit_paid: 'Deposit paid',
  delivered: 'Delivered',
  complete: 'Complete',
};

export const VENDOR_STATUS_TONE: Record<VendorStatus, string> = {
  considering: 'bg-ink/5 text-ink/70',
  shortlisted: 'bg-amber-100 text-amber-900',
  contracted: 'bg-sky-100 text-sky-800',
  deposit_paid: 'bg-violet-100 text-violet-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  complete: 'bg-emerald-200 text-emerald-900',
};

export type EventVendorRow = {
  vendor_id: string;
  public_id: string;
  event_id: string;
  category: VendorCategory;
  vendor_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  status: VendorStatus;
  total_cost_php: number | null;
  deposit_paid_php: number | null;
  notes: string | null;
  created_at: string;
  /**
   * FK to vendor_profiles. NULL = off-platform (couple-encoded only).
   * Populated atomically when a couple-invite is claimed or a Connect
   * happens; the same transaction also inserts a vendor_follows row
   * per 0019 § Booking-implies-follow auto-insert.
   */
  marketplace_vendor_id: string | null;
  /**
   * FK to event_vendor_packages (migration 20260604110000_vendor_packages.sql).
   * Populated by the cascade-lock flow when a host locks a vendor's
   * bundled package. NULL on normal (non-package) event_vendors rows.
   * Optional — surfaced as undefined by clients that don't SELECT it.
   */
  event_vendor_package_id?: string | null;
};

export async function fetchEventVendors(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventVendorRow[]> {
  const { data, error } = await supabase
    .from('event_vendors')
    .select(
      'vendor_id,public_id,event_id,category,vendor_name,contact_email,contact_phone,status,total_cost_php,deposit_paid_php,notes,created_at,marketplace_vendor_id',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`fetchEventVendors failed: ${error.message}`);
  return (data ?? []) as EventVendorRow[];
}

export function computeVendorStats(vendors: EventVendorRow[]) {
  let totalCost = 0;
  let depositPaid = 0;
  const byStatus: Partial<Record<VendorStatus, number>> = {};
  for (const v of vendors) {
    totalCost += Number(v.total_cost_php ?? 0);
    depositPaid += Number(v.deposit_paid_php ?? 0);
    byStatus[v.status] = (byStatus[v.status] ?? 0) + 1;
  }
  return {
    count: vendors.length,
    totalCost,
    depositPaid,
    remaining: Math.max(0, totalCost - depositPaid),
    byStatus,
  };
}

export function formatPhp(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `₱${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Display-layer grouping of the 28 canonical categories into 6 phases of a
 * wedding. Used by the vendor-profile services checklist and the couple-side
 * "Add a vendor" dropdown so the long flat list reads in sensible chunks.
 *
 * Not in the DB — purely presentational. If grouping ever needs to drive
 * queries (e.g. filtering, analytics), promote to a `service_group` column.
 */
export type ServiceGroupKey =
  | 'reception'
  | 'ceremony'
  | 'attire'
  | 'media'
  | 'logistics'
  | 'other';

export const SERVICE_GROUPS: ReadonlyArray<{
  key: ServiceGroupKey;
  label: string;
  members: ReadonlyArray<VendorCategory>;
}> = [
  {
    key: 'reception',
    label: 'Reception',
    members: ['venue', 'catering', 'cake_maker', 'mobile_bar', 'reception_decor'],
  },
  {
    key: 'ceremony',
    label: 'Ceremony',
    members: ['religious_venue', 'officiant', 'church_fees', 'choir', 'string_quartet'],
  },
  {
    key: 'attire',
    label: 'Couple & attire',
    members: ['gown_designer', 'suit_designer', 'makeup_artist', 'hair_stylist', 'rings'],
  },
  {
    key: 'media',
    label: 'Media & entertainment',
    members: [
      'photographer',
      'videographer',
      'photobooth',
      'band_dj',
      'host_emcee',
      'lights_and_sound',
      'led_screens',
    ],
  },
  {
    key: 'logistics',
    label: 'Logistics',
    members: [
      'transportation',
      'security',
      'florist',
      'invitations_stationery',
      'planner_coordinator',
      'accommodation',
    ],
  },
  {
    key: 'other',
    label: 'Other',
    members: ['gifts_and_giveaways', 'misc'],
  },
];

const CATEGORY_TO_GROUP: Record<VendorCategory, ServiceGroupKey> = (() => {
  const m = {} as Record<VendorCategory, ServiceGroupKey>;
  for (const g of SERVICE_GROUPS) {
    for (const member of g.members) {
      m[member] = g.key;
    }
  }
  return m;
})();

export function serviceGroupOf(category: VendorCategory): ServiceGroupKey {
  return CATEGORY_TO_GROUP[category];
}

const CATEGORY_SET: ReadonlySet<string> = new Set(VENDOR_CATEGORIES);

/**
 * Vendor profiles store services as `text[]` where canonical entries use the
 * enum key (e.g. "photographer") and custom entries store the raw label
 * (e.g. "Vintage car rental"). This resolves either to a human-readable
 * label so display sites don't have to branch.
 */
export function displayServiceLabel(service: string): string {
  if (CATEGORY_SET.has(service)) {
    return VENDOR_CATEGORY_LABEL[service as VendorCategory];
  }
  return service;
}

export function isCanonicalService(service: string): boolean {
  return CATEGORY_SET.has(service);
}
