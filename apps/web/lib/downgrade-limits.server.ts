import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { readStayOn } from '@/lib/service-plan-hold.server';
import { fetchVendorTeam } from '@/lib/vendor-team';
import { fetchExtraAgentSeats } from '@/lib/vendor-seats';
import { teamSeats } from '@/lib/vendor-free-helper';
import type { DowngradeFacts, FitCard } from '@/lib/downgrade-limits';

/**
 * downgrade-limits.server.ts — THE READS behind the limits sheet (`lib/downgrade-limits.ts` is the rule).
 *
 * 🔑 HONEST READS (the `reads-are-honest` pattern): each fact that could not be read is `null`, and the sheet then says
 * "Couldn't read …" for that limit — never "fits". The cards come from `readStayOn`, the SAME read "Which services stay
 * on" uses, so the sheet and the picker count the same cards.
 *
 * Storage: no plan storage allowance exists yet (see `STORAGE_ALLOWANCE_BYTES`), so what the shop stores is not read —
 * the floor row is not drawn until an allowance is ruled.
 */

/**
 * The storage a plan holds, in bytes. NO PLAN HAS ONE YET: the storage rows in `vendor_billing_catalog` are priced and
 * inactive (migration 20271308555594 §2b, "There is no storage purchase or quota in the app yet"). Null = no floor
 * drawn. Never type a number here without the owner's ruling — the floor tells a supplier to delete their work.
 */
export function storageAllowanceBytes(_plan: string): number | null {
  return null;
}

export async function readDowngradeFacts(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<DowngradeFacts> {
  const [stay, daily, branches, team, extraSeats, shop] = await Promise.all([
    readStayOn(supabase, admin, vendorProfileId),
    supabase
      .from('vendor_services')
      .select('vendor_service_id,daily_capacity')
      .eq('vendor_profile_id', vendorProfileId)
      .then(
        (r) => r,
        () => ({ data: null, error: { message: 'threw' } }),
      ),
    supabase
      .from('vendor_branches')
      .select('branch_id', { count: 'exact', head: true })
      .eq('parent_vendor_profile_id', vendorProfileId)
      .eq('included_in_plan', true)
      .is('cancelled_at', null)
      .then(
        (r) => r,
        () => ({ count: null, error: { message: 'threw' } }),
      ),
    fetchVendorTeam(supabase, vendorProfileId).catch(() => null),
    fetchExtraAgentSeats(supabase, vendorProfileId).catch(() => 0),
    supabase
      .from('vendor_profiles')
      .select('verification_state,next_renewal_due_at,outer_radius_km')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle()
      .then(
        (r) => r,
        () => ({ data: null, error: { message: 'threw' } }),
      ),
  ]);

  let cards: FitCard[] | null = null;
  if (stay.status === 'ok' && !daily.error) {
    const perDay = new Map(
      ((daily.data ?? []) as { vendor_service_id: string; daily_capacity: number | null }[]).map((r) => [
        r.vendor_service_id,
        Number.isInteger(Number(r.daily_capacity)) && Number(r.daily_capacity) > 0 ? Number(r.daily_capacity) : null,
      ]),
    );
    cards = stay.cards.map((c) => ({ ...c, daily: perDay.get(c.id) ?? null }));
  } else {
    console.error('[downgrade-limits] cards unreadable', vendorProfileId, daily.error?.message ?? 'stay-on read');
  }
  if (branches.error) console.error('[downgrade-limits] branches unreadable', vendorProfileId, branches.error.message);
  if (shop.error) console.error('[downgrade-limits] shop row unreadable', vendorProfileId, shop.error.message);

  const row = shop.error ? null : (shop.data as { verification_state: string | null; next_renewal_due_at: string | null; outer_radius_km: number | null } | null);
  const owner = stay.status === 'ok' ? stay.shop.ownerUserId : null;
  const reach = row?.outer_radius_km;
  return {
    founder: stay.status === 'ok' ? stay.shop.founder : false,
    cards,
    includedBranches: branches.error || typeof branches.count !== 'number' ? null : branches.count,
    seats: team && owner ? teamSeats(team, owner) : null,
    extraSeats,
    reachKm: typeof reach === 'number' && Number.isFinite(reach) ? reach : null,
    storedBytes: null,
    badge: row ? { verification_state: row.verification_state, next_renewal_due_at: row.next_renewal_due_at } : null,
  };
}
