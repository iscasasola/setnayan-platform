import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { askedOnce } from '@/lib/request-once';
import { loadRoleNames } from '@/lib/role-names.server';
import type { GuestRole } from '@/lib/guests';
import {
  serviceLabel,
  type CountGroup,
  type CountMode,
  type CountedService,
  type RosterEntry,
  type ServiceCounts,
  type SupplierHeadcount,
} from '@/lib/supplier-count';

export type { SupplierHeadcount } from '@/lib/supplier-count';

/**
 * 🧮 WHO A SUPPLIER COUNTS — the reads (owner 2026-11-04; `lib/supplier-count.ts` for the rule, migration
 * 20271307968824 for the SQL). Every read is MEASURED: a refused read is `null`, never "everyone attending".
 */

type RawService = {
  id: string;
  category: string | null;
  shop: string | null;
  booked: boolean;
  mode: CountMode;
  roles: GuestRole[] | null;
  group_ids: string[] | null;
  attending: number;
  not_counted: number;
  outside_rule: number;
  counted: number;
};
type RawCounts = { services: RawService[] | null; groups: CountGroup[] | null; roster: RosterEntry[] | null };

/** The payload → the couple's shape. Exported for the lab, which draws the same shape from a fixture. */
export function serviceCountsOf(raw: RawCounts): ServiceCounts {
  const services: CountedService[] = (raw.services ?? []).map((s) => ({
    id: s.id,
    category: s.category,
    label: serviceLabel(s.category, s.shop),
    shop: s.shop?.trim() || null,
    booked: s.booked === true,
    rule: { mode: s.mode ?? 'all', roles: s.roles ?? [], groupIds: s.group_ids ?? [] },
    attending: Number(s.attending) || 0,
    notCounted: Number(s.not_counted) || 0,
    outsideRule: Number(s.outside_rule) || 0,
    counted: Number(s.counted) || 0,
  }));
  return { services, groups: raw.groups ?? [], roster: raw.roster ?? [] };
}

/**
 * Every per-head service on the event, its count and its rule, the event's groups, and the anonymous roster — ONE
 * request (`get_event_service_counts`), asked ONCE per render: the guest card's "Not counted for ▾", the Guest List's
 * row notes and the Suppliers page's "Who they count" all read it. The couple, a guest-list helper, or the admin.
 */
export async function readEventServiceCounts(supabase: SupabaseClient, eventId: string): Promise<ServiceCounts | null> {
  // The couple's words for roles ride along (a failed read is the usual words, logged — `loadRoleNames`).
  const [{ data, error }, names] = await Promise.all([
    askedOnce(supabase, 'rpc.get_event_service_counts', [eventId], async () =>
      supabase.rpc('get_event_service_counts', { p_event_id: eventId }),
    ),
    loadRoleNames(supabase, eventId, 'supplierCount.roleNames'),
  ]);
  if (error || !data) {
    if (error) logQueryError('supplierCount.eventServiceCounts', error, { eventId }, 'graceful_degrade');
    return null;
  }
  return { ...serviceCountsOf(data as RawCounts), names };
}

/**
 * The supplier's count tile (`get_vendor_headcount_rule`): `null` when none of their booked services here is priced per
 * head (no tile), or when the read was refused — the Headcount card then draws exactly what it drew before.
 */
export async function readVendorHeadcountRule(supabase: SupabaseClient, eventId: string): Promise<SupplierHeadcount | null> {
  const { data, error } = await supabase.rpc('get_vendor_headcount_rule', { p_event_id: eventId });
  if (error) {
    logQueryError('supplierCount.vendorHeadcountRule', error, { eventId }, 'graceful_degrade');
    return null;
  }
  if (!data) return null;
  const d = data as Record<string, unknown>;
  return {
    attending: Number(d.attending) || 0,
    notCounted: Number(d.not_counted) || 0,
    outsideRule: Number(d.outside_rule) || 0,
    counted: Number(d.counted) || 0,
    category: (d.category as string | null) ?? null,
    mode: ((d.mode as CountMode | undefined) ?? 'all'),
    roles: (d.roles as GuestRole[] | undefined) ?? [],
    groups: (d.groups as string[] | undefined) ?? [],
  };
}
