import 'server-only';

/**
 * 📈 recordServiceCardView — a couple or guest OPENED one service card into the grown card (Build 6 Lane I, graph b
 * "Which card sells": opened → asked → booked per card; DECISION_LOG 2026-11-10 "ALL FIVE NEW ANALYTICS GRAPHS PICKED").
 *
 * The ONE door to `public.record_service_card_view` (migration 20271337268841), which is SERVICE ROLE ONLY. The same
 * shape as `recordPortfolioPhotoView` (`lib/record-portfolio-photo-view.ts`): hash the viewer the way the shop's own view
 * count does (`hashViewer`), hand the function the signed-in user id (or null) so the FUNCTION refuses the shop's own
 * people and admins — the rule lives in one place, the database. One per viewer per card per Manila day, deduped there.
 *
 * Best-effort, like every view capture: a failure is swallowed and never reaches the visitor; the card opens the same
 * whether or not it was counted.
 *
 * ⚖ NOT ITS OWN SERVER ACTION (the export budget, `scripts/lint-server-action-budget.mjs`): the browser reaches this
 * through the EXISTING view action, `recordVendorProfileView({ vendorProfileId, serviceId })` (`lib/record-vendor-view.ts`).
 */

import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { hashViewer } from '@/lib/vendor-funnel';
import { logQueryError } from '@/lib/supabase/error-detect';

/** The same opaque per-browser id the shop view count dedupes signed-out visitors on. */
const ANON_VIEWER_COOKIE = 'sn_vw';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordServiceCardView(vendorProfileId: string, serviceId: string): Promise<void> {
  try {
    if (!vendorProfileId || !UUID_RE.test(serviceId)) return;

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

    const { error } = await createAdminClient().rpc('record_service_card_view', {
      p_vendor_profile_id: vendorProfileId,
      p_vendor_service_id: serviceId,
      p_viewer_hash: hashViewer(raw),
      p_viewer_user_id: userId,
    });
    // A refused count is recorded for us (never for the visitor): the card still opens.
    if (error) logQueryError('recordServiceCardView.rpc', error, { vendorProfileId }, 'graceful_degrade');
  } catch {
    /* fully best-effort — a dropped open never breaks the page */
  }
}
