import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { askedOnce } from '@/lib/request-once';
import { eventSkuActive } from '@/lib/entitlements';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { EVENT_PLUS_SKU } from '@/lib/hub-parts';
import { asViewed } from '@/lib/view-as-free.server';
import { setnayanMarkFor, type SetnayanMark } from '@/lib/setnayan-mark-by-plan';

/**
 * 🏷 THE EVENT'S SETNAYAN MARK, READ FROM ITS PLAN (DECISION_LOG 2026-11-04; Build 6 Lane L) — the shipped readers only
 * (Rule 0): Event Pro = `eventCoupleWebsiteProActive` (the gate the footer has always asked — Full Pro, or the parts' cap
 * reached); Event Plus = `eventSkuActive(EVENT_PLUS)`. Both FEATURE gates (admin-approved), both as the viewer is SHOWN
 * them (`asViewed` — "view as a free couple" sees the free mark).
 *
 * 🔒 A read that fails is the FREE mark (the watermark) — the safe default every footer gate already keeps: a lost read
 * never strips the mark off an event that has not paid.
 *
 * One answer per render per event (`askedOnce`).
 */
export function eventSetnayanMark(supabase: SupabaseClient, eventId: string): Promise<SetnayanMark> {
  return askedOnce(supabase, 'setnayan-mark', [eventId], async () => {
    const [pro, plus] = await Promise.all([
      asViewed(eventCoupleWebsiteProActive(supabase, eventId).catch(() => false)),
      asViewed(eventSkuActive(supabase, eventId, EVENT_PLUS_SKU).catch(() => false)),
    ]);
    return setnayanMarkFor({ pro, plus });
  });
}
