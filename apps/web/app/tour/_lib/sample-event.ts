import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';

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

/**
 * THE ONE READ — pinned to `is_sample = TRUE` + the hardcoded slug + wedding,
 * and checked again on the row. Null for anything that is not EXACTLY the
 * sample; every door below decides what null means (a 404, or "no sample").
 */
const readSample = cache(async () => {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('events')
    .select(
      'event_id, display_name, slug, is_sample, event_type, role_palette, reception_design, venue_setting, event_date, bride_name, groom_name',
    )
    .eq('is_sample', true)
    .eq('slug', SAMPLE_SLUG)
    .eq('event_type', 'wedding')
    .limit(1)
    .maybeSingle();
  // A refused read is SAID (Sentry + console), never only a null — the tour's
  // 404 and Details' "no sample" would otherwise look like no sample exists.
  if (error) {
    logQueryError('tour.readSample', error, { slug: SAMPLE_SLUG }, 'graceful_degrade');
    return null;
  }
  if (!data || data.is_sample !== true || data.slug !== SAMPLE_SLUG) return null;
  return data;
});

export const getSampleEvent = cache(async () => {
  const data = await readSample();
  // Fail safe: anything that isn't EXACTLY the sample → 404, never a real event.
  if (!data) notFound();
  return data;
});

/**
 * The sample's id, or null — for a route handler (the Details theme gallery's
 * sample prints, `/api/hub-print/<piece>?sample=1`), where `notFound()` is not
 * an answer. The same pinned read; never an id from the request.
 */
export async function findSampleEventId(): Promise<string | null> {
  return (await readSample())?.event_id ?? null;
}

/** The sample event_id — pass this to every fetcher; never read an id from the URL. */
export async function getSampleEventId(): Promise<string> {
  return (await getSampleEvent()).event_id;
}
