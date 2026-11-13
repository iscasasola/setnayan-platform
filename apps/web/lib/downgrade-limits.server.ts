import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { readStayOn } from '@/lib/service-plan-hold.server';
import { fetchVendorTeam } from '@/lib/vendor-team';
import { fetchExtraAgentSeats } from '@/lib/vendor-seats';
import { teamSeats } from '@/lib/vendor-free-helper';
import type { DowngradeFacts, FitCard } from '@/lib/downgrade-limits';
import { readStoredBytes } from '@/lib/supplier-storage.server';

/**
 * downgrade-limits.server.ts — THE READS behind the limits sheet (`lib/downgrade-limits.ts` is the rule).
 *
 * 🔑 HONEST READS (the `reads-are-honest` pattern): each fact that could not be read is `null`, and the sheet then says
 * "Couldn't read …" for that limit — never "fits". The cards come from `readStayOn`, the SAME read "Which services stay
 * on" uses, so the sheet and the picker count the same cards.
 *
 * Storage: the plan's allowance is `TIER_CAPS[plan].storageBytes` (owner 2026-11-13); what the shop stores is
 * `readStoredBytes` — the same read the Plan's "Storage" row and `/api/upload` use, so the sheet, the row and the refusal
 * count the same bytes.
 */

/** The storage a plan holds — `TIER_CAPS[plan].storageBytes` (lib/supplier-storage.ts holds the rule). */
export { storageAllowanceBytes } from '@/lib/supplier-storage';

/** The usage read (lib/supplier-storage.server.ts) — re-exported so the Plan reads it from where it reads the sheet. */
export { readStoredBytes, type StoredBytesRead } from '@/lib/supplier-storage.server';

export async function readDowngradeFacts(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<DowngradeFacts> {
  const [stay, daily, branches, team, extraSeats, shop, stored] = await Promise.all([
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
    // The badge date sits beside the shop's tax identity on the TABLE, which a browser session may not read
    // (migration 20271217955839) — the service role reads it, scoped by the shop id the caller resolved from the session.
    admin
      .from('vendor_profiles')
      .select('verification_state,next_renewal_due_at,outer_radius_km')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle()
      .then(
        (r) => r,
        () => ({ data: null, error: { message: 'threw' } }),
      ),
    readStoredBytes(admin, vendorProfileId),
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
    storedBytes: stored.status === 'ok' ? stored.bytes : null,
    badge: row ? { verification_state: row.verification_state, next_renewal_due_at: row.next_renewal_due_at } : null,
  };
}
