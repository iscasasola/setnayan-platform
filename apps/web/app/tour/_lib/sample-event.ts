import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * THE single trust boundary for the public, no-login Maria & Jose tour.
 *
 * The tour reads prod data through the service-role admin client (RLS-bypassed),
 * so this resolver is the ONLY thing standing between an anonymous visitor and
 * real couples' data. Rules that make a real event structurally unreachable:
 *
 *   1. It accepts NO event id/slug from the client. The slug is a hardcoded
 *      constant, never `params`/`searchParams`.
 *   2. The query is pinned to `is_sample = TRUE` (primary gate) + the known slug
 *      + `event_type = 'wedding'` (belts).
 *   3. A missing/mismatched row → `notFound()`. If a future seed flips
 *      `is_sample` off, the tour 404s — it never falls through to a real event.
 *   4. The resolved `event_id` lives only in server memory; every downstream
 *      fetcher MUST re-pin `.eq('event_id', getSampleEventId())`.
 *
 * `cache()` so the resolve + the fail-safe `notFound()` happen once per request,
 * before streaming (mirrors the `[slug]` public page's `fetchEventBySlug`).
 */
const SAMPLE_SLUG = 'maria-and-jose';

export const getSampleEvent = cache(async () => {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('events')
    .select(
      'event_id, display_name, slug, is_sample, event_type, role_palette, event_date, bride_name, groom_name',
    )
    .eq('is_sample', true)
    .eq('slug', SAMPLE_SLUG)
    .eq('event_type', 'wedding')
    .limit(1)
    .maybeSingle();

  // Fail safe: anything that isn't EXACTLY the sample → 404, never a real event.
  if (error || !data || data.is_sample !== true || data.slug !== SAMPLE_SLUG) {
    notFound();
  }
  return data;
});

/** The sample event_id — pass this to every fetcher; never read an id from the URL. */
export async function getSampleEventId(): Promise<string> {
  return (await getSampleEvent()).event_id;
}
