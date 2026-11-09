import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { BOOKED_EVENT_VENDOR_STATUSES, bookedSupplierFacts } from '@/lib/coordinator-trade';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * 🧭 WHO ON THIS EVENT IS A BOOKED SUPPLIER, AND WHO IS THE BOOKED COORDINATOR (owner 8 Nov 2026) — per account: the
 * owner and every team member of each shop booked here. The input `supplierProposesOnly` needs, read with the
 * service role (nobody else can read another account's shop rows) and scoped to ONE event.
 *
 * Two round trips: the booked rows with their shops, then the shops' team members. A refused read is LOGGED and
 * answers an empty map — every seat then reads as the hosts' own delegate, which can only make a notice reach a
 * seat the database would refuse; it never widens what anybody may do (the database decides that).
 */
export async function readBookedSupplierFacts(
  admin: SupabaseClient,
  eventId: string,
): Promise<Map<string, { bookedSupplier: boolean; bookedCoordinator: boolean }>> {
  const booked = await admin
    .from('event_vendors')
    .select('status, marketplace_vendor_id, vendor_profiles:marketplace_vendor_id ( user_id, services )')
    .eq('event_id', eventId)
    .in('status', [...BOOKED_EVENT_VENDOR_STATUSES])
    .not('marketplace_vendor_id', 'is', null);
  if (booked.error) {
    logQueryError('readBookedSupplierFacts.booked', booked.error, { eventId }, 'graceful_degrade');
    return new Map();
  }
  type Row = {
    status: string | null;
    marketplace_vendor_id: string | null;
    vendor_profiles: { user_id: string | null; services: string[] | null } | { user_id: string | null; services: string[] | null }[] | null;
  };
  const rows = (booked.data ?? []) as Row[];
  const shopIds = [...new Set(rows.map((r) => r.marketplace_vendor_id).filter((v): v is string => !!v))];
  const team = new Map<string, string[]>();
  if (shopIds.length > 0) {
    const members = await admin.from('vendor_team_members').select('vendor_profile_id, user_id').in('vendor_profile_id', shopIds);
    if (members.error) {
      logQueryError('readBookedSupplierFacts.team', members.error, { eventId }, 'graceful_degrade');
    } else {
      for (const m of (members.data ?? []) as { vendor_profile_id: string; user_id: string | null }[]) {
        if (m.user_id) team.set(m.vendor_profile_id, [...(team.get(m.vendor_profile_id) ?? []), m.user_id]);
      }
    }
  }
  return bookedSupplierFacts(
    rows.map((r) => {
      const shop = Array.isArray(r.vendor_profiles) ? r.vendor_profiles[0] ?? null : r.vendor_profiles;
      return {
        status: r.status,
        services: shop?.services ?? null,
        userIds: [shop?.user_id ?? null, ...(r.marketplace_vendor_id ? team.get(r.marketplace_vendor_id) ?? [] : [])],
      };
    }),
  );
}
