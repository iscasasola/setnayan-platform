import 'server-only';

/**
 * 👁 recordPortfolioPhotoView — a couple or guest OPENED one portfolio photo (Build 3 Lane E, item 11; DECISION_LOG
 * 2026-11-09 👁 "Add it. Count the views").
 *
 * The ONE door to `public.record_portfolio_photo_view` (migration 20271331531509), which is SERVICE ROLE ONLY: this
 * action hashes the viewer the way the shop's own view count does (`hashViewer`, `lib/record-vendor-view.ts`) and hands
 * the function the signed-in user id (or null) so the FUNCTION refuses the shop's own people and admins — the rule
 * lives in one place, the database, never in a caller. One per viewer per photo per Manila day, deduped there.
 *
 * Best-effort, like every view capture: a failure is swallowed and never reaches the visitor. It returns nothing a
 * caller could draw — a photo opens the same whether or not it was counted.
 *
 * ⚖ NOT ITS OWN SERVER ACTION: the export budget is at its ceiling (`scripts/lint-server-action-budget.mjs` — every
 * action is a Vercel route). The browser reaches this through the EXISTING view action, `recordVendorProfileView({
 * vendorProfileId, photoKey })` (`lib/record-vendor-view.ts`), which hands a photo open here instead of counting a shop
 * view.
 */

import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { hashViewer } from '@/lib/vendor-funnel';

/** The same opaque per-browser id the shop view count dedupes signed-out visitors on. */
const ANON_VIEWER_COOKIE = 'sn_vw';

export async function recordPortfolioPhotoView(vendorProfileId: string, photoKey: string): Promise<void> {
  try {
    if (!vendorProfileId || !photoKey || photoKey.length > 1024) return;

    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      /* auth read is best-effort */
    }

    let raw: string | null = userId ? `u:${userId}` : null;
    if (!raw) {
      try {
        const jar = await cookies();
        const existing = jar.get(ANON_VIEWER_COOKIE)?.value;
        if (existing) raw = `a:${existing}`;
        else {
          const fresh = crypto.randomUUID();
          raw = `a:${fresh}`;
          jar.set({ name: ANON_VIEWER_COOKIE, value: fresh, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
        }
      } catch {
        /* no cookie store — nothing to dedupe on, so nothing is counted */
      }
    }
    if (!raw) return;

    await createAdminClient().rpc('record_portfolio_photo_view', {
      p_vendor_profile_id: vendorProfileId,
      p_photo_key: photoKey,
      p_viewer_hash: hashViewer(raw),
      p_viewer_user_id: userId,
    });
  } catch {
    /* fully best-effort — a dropped view never breaks the page */
  }
}
