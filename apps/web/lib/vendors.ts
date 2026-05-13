import type { SupabaseClient } from '@supabase/supabase-js';

export type VendorCategory =
  | 'venue'
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
  'misc',
];

export const VENDOR_CATEGORY_LABEL: Record<VendorCategory, string> = {
  venue: 'Venue',
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
};

export async function fetchEventVendors(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventVendorRow[]> {
  const { data, error } = await supabase
    .from('event_vendors')
    .select(
      'vendor_id,public_id,event_id,category,vendor_name,contact_email,contact_phone,status,total_cost_php,deposit_paid_php,notes,created_at',
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
