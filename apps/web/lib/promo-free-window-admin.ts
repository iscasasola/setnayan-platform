/**
 * Couple free-window admin-LISTING reader — the couple half of `/admin/gifts`,
 * sibling to `fetchVendorDealWindows` in lib/vendor-tier-comps.ts.
 *
 * 🔑 WHY A SEPARATE FILE FROM lib/promo-free-windows.ts. That file is the
 * ENTITLEMENT-GATE reader (cache()d, short-circuits to [] while the flag is
 * off, consumed by lib/entitlements.ts on the render path). The codebase's own
 * convention keeps an admin-LISTING reader in a separate `*-comps`-style file
 * from the gate reader — `fetchVendorDealWindows` lives in
 * `lib/vendor-tier-comps.ts`, imported by `/admin/gifts/page.tsx`, NOT in
 * `promo-free-windows.ts` alongside the gate functions it mirrors in shape.
 * This file is that same split for couple windows: a THROWING, uncached,
 * admin-listing-shaped read (ConsoleTable wants "couldn't read", never a
 * silently-empty list), separate from the couple gate reader
 * (`getLiveCoupleFreeWindows` / `promoFreeSkusForCouples`), which stays
 * cache()d + graceful-degrading because it runs on the couple-facing render
 * path instead.
 */

import { type SupabaseClient } from '@supabase/supabase-js';

/**
 * A COUPLE free window row, listing-shaped for `/admin/gifts`. Mirrors
 * `VendorDealRow` in lib/vendor-tier-comps.ts.
 */
export type CoupleFreeWindowRow = {
  promo_window_id: string;
  title: string;
  blurb: string | null;
  covered_service_keys: string[];
  starts_at: string;
  ends_at: string;
  event_date_from: string | null;
  event_date_to: string | null;
  is_active: boolean;
  show_banner: boolean;
};

/**
 * Every couple-audience (`all_couples`) window that is live or still to come —
 * active, and not yet ended. Ended and deactivated windows stay on the
 * Catalog Studio tab; this page promises "everything currently free or about
 * to be". THROWS on a refused read so ConsoleTable says "couldn't read",
 * never "no windows" — same contract as `fetchVendorDealWindows`.
 */
export async function fetchCoupleFreeWindows(
  admin: SupabaseClient,
  limit = 200,
): Promise<CoupleFreeWindowRow[]> {
  const { data, error } = await admin
    .from('promo_free_windows')
    .select(
      'promo_window_id, title, blurb, covered_service_keys, starts_at, ends_at, event_date_from, event_date_to, is_active, show_banner',
    )
    .eq('is_active', true)
    .eq('audience_type', 'all_couples')
    .order('starts_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`fetchCoupleFreeWindows failed: ${error.message}`);
  const now = Date.now();
  return ((data ?? []) as CoupleFreeWindowRow[]).filter(
    (w) => new Date(w.ends_at).getTime() > now,
  );
}
