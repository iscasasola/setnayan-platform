import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { areBookingsOpen } from '@/lib/bookings-open.server';
import { shopPageGate } from '@/lib/own-shop-preview';

/**
 * 🔗 Does `slug` open as a PUBLIC shop to a signed-out stranger? The same `shopPageGate` the public shop page
 * (`app/v/[slug]/page.tsx`) answers with, over the same columns that page's `fetchVendor` hands the gate. The
 * marketing pages ask it before they draw a "See the sample shop" card (logged-out crawl 2026-11-14, #1 and #2: both
 * cards linked to a shop that was a 404). A refused read is "no" — a link is never drawn to a page nobody confirmed
 * opens. Its own lean read, so a marketing page never imports the shop page's UI.
 */
const GATE_COLUMNS =
  'public_visibility, verification_state, is_demo, self_published_at, find_locked_at, fraud_suspended_at, fraud_banned_at, fraud_tombstoned, paused_at' as const;

export async function shopOpensToStrangers(slug: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient()
      .from('vendor_profiles')
      .select(GATE_COLUMNS)
      .ilike('business_slug', slug)
      .maybeSingle();
    if (error) {
      logQueryError('shopOpensToStrangers', error, { slug }, 'graceful_degrade');
      return false;
    }
    if (!data) return false;
    return shopPageGate(data, { isTeam: false, adminDemoMode: false, bookingsOpen: await areBookingsOpen() }).open === 'public';
  } catch {
    return false;
  }
}
