'use server';

/**
 * recordVendorProfileView — best-effort, fire-and-forget capture of a public
 * vendor-profile view (Wave 6 Quote-to-Booking Funnel · the VIEWS stage).
 *
 * From a server action (the cached copy's beacon, the Find sheet's action) it may run inside Next 15 after():
 *
 *     import { after } from 'next/server';
 *     after(() => recordVendorProfileView({ vendorProfileId, source, ... }));
 *
 * ⚠ NOT from a Server Component's after(): Next refuses `headers()`/`cookies()` there, so it could not tell who is
 * looking. A render reads `readShopViewContext()` first and hands it to `recordShopViewWith` (W1-B15).
 *
 * after() runs the work AFTER the response is flushed, so this NEVER blocks the
 * page render (cron-free per project_setnayan_cron_free). Every failure mode is
 * swallowed — a dropped view must never surface an error to the visitor.
 *
 * Privacy (project_setnayan_behavioral_data_edge):
 *   - The viewer is de-identified BEFORE it touches the DB: we pass the raw
 *     user-id / anon-session-id through hashViewer() (sha256(salt || id)) and
 *     store ONLY the hash. The raw id is never written or logged.
 *   - The INSERT runs on the service-role admin client. Anon/authenticated
 *     sessions have NO INSERT grant on vendor_profile_views (RLS is read-only
 *     for them), so a view can only be recorded through this audited path.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { recordShopViewWith } from '@/lib/shop-view-count';
import { readShopViewContext } from '@/lib/shop-view-context';
import { recordPortfolioPhotoView } from '@/lib/record-portfolio-photo-view';
import { recordServiceCardView } from '@/lib/record-service-card-view';

type RecordVendorViewInput = {
  vendorProfileId: string;
  /** Entry point — mirrors event_vendors.source vocabulary. */
  source?: string | null;
  /** Raw UTM query string when present on the landing URL. */
  utm?: string | null;
  /** Couple-event context, when a signed-in couple with an active event views. */
  eventId?: string | null;
  /**
   * 👁 A PORTFOLIO PHOTO was opened (Build 3 Lane E item 11) — count THAT photo's view through the one service-role RPC
   * (`lib/record-portfolio-photo-view.ts`) instead of a shop view. Rides this action so no new server action is added.
   */
  photoKey?: string | null;
  /**
   * 📈 A SERVICE CARD was opened into the grown card (Build 6 Lane I, "Which card sells") — count THAT card's open
   * through the one service-role RPC (`lib/record-service-card-view.ts`) instead of a shop view. Rides this action so no
   * new server action is added.
   */
  serviceId?: string | null;
};

export async function recordVendorProfileView(
  input: RecordVendorViewInput,
): Promise<void> {
  try {
    if (!input.vendorProfileId) return;
    if (input.photoKey) return await recordPortfolioPhotoView(input.vendorProfileId, input.photoKey);
    if (input.serviceId) return await recordServiceCardView(input.vendorProfileId, input.serviceId);

    // 👁 W1-B15: a bot, the shop's own people and the same device again are not "a couple who opened your page"
    // (`lib/shop-view-count.ts`). This is the browser's door (the cached copy's beacon) — an action may read the
    // request and set the cookie. The live render reads the same facts BEFORE `after()` (`readShopViewContext`).
    await recordShopViewWith(createAdminClient(), input, await readShopViewContext({ mint: true }));
  } catch {
    // Fully best-effort — a failed view capture must never break a render.
  }
}
