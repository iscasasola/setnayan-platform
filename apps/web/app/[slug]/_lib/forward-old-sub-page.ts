import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { onTheCachedHub } from '@/lib/hub-request';
import { isUserNestingCutoverEnabled, oldSubPageTarget, resolveEventOwnerSlug } from '@/lib/public-event-url';
import { REQUEST_PATH_HEADER } from '@/lib/shop-console-path';
import { isLocalOrPreviewHost, isSetnayanHost } from '@/lib/custom-domain-resolve';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * forward-old-sub-page.ts — 🔗 THE ADDRESS MOVE: OLD SUB-PAGE LINKS FORWARD FOREVER (owner 2026-11-15, specs
 * DECISION_LOG d7910b5d). While the cutover is on, an event's pages live under its creator's username
 * (`/{username}/{event}/invite`, `/hub`, `/seat` …). A guest holding an old `/{event}/invite` (already invited) or
 * any other `/{event}/{page}` link is sent there, query and all (`oldSubPageTarget`, lib/public-event-url.ts).
 *
 * Called by the `[slug]` layout, but it is NOT the layout reading the request: it returns at once with the switch
 * off and on the cached Event Hub (which must read nothing — lib/the-guest-hub-stays-cacheable.test.ts), and it
 * never forwards a request that arrived nested, a form post (a Server Action), or a custom domain's bare address.
 * A forward is a courtesy: a failed read renders the page at the old address, exactly as before.
 */
export async function forwardOldSubPage(slug: string, eventId: string): Promise<void> {
  if (!isUserNestingCutoverEnabled() || onTheCachedHub()) return;
  let target: string | null = null;
  try {
    const h = await headers();
    if (h.get('x-sn-u-nesting') === '1' || h.has('next-action')) return;
    const host = (h.get('host') ?? '').toLowerCase();
    if (host && !isSetnayanHost(host) && !isLocalOrPreviewHost(host)) return; // a custom domain keeps its bare form
    target = oldSubPageTarget(h.get(REQUEST_PATH_HEADER), slug, await resolveEventOwnerSlug(createAdminClient(), eventId));
  } catch {
    return; // a forward is a courtesy: a failed read renders the page at the old address, as before
  }
  if (target) redirect(target);
}
