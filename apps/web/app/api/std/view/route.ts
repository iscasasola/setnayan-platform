/**
 * POST /api/std/view — the Save-the-Date view beacon (iteration 0024).
 *
 * The public couple page fires this once per load while it's in its
 * Save-the-Date phase (and never for the couple/coordinators — the beacon is
 * gated off for authed hosts). We count UNIQUE PER DAY per device using a
 * first-party httpOnly cookie ({slug: 'YYYY-MM-DD'}); the database only ever
 * stores an aggregate day→count rollup (event_std_views), so there is no PII
 * and no per-device data at rest (RA 10173).
 *
 * Defence-in-depth: a forged POST can't inflate a non-Save-the-Date page — we
 * re-resolve the event server-side and re-check the lifecycle phase before
 * counting. Writes go through the service-role admin client + the atomic
 * record_std_view() RPC (the table has no INSERT/UPDATE policy).
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getLifecyclePhase } from '@/lib/invitation-widgets';
import {
  STD_VIEW_COOKIE,
  manilaToday,
  parseStdViewCookie,
  serializeStdViewCookie,
} from '@/lib/std-views';

export const runtime = 'nodejs';
// Never cache a beacon POST.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Always 200 — a view beacon must never surface an error to the page, and we
  // don't reveal whether a slug exists / is in phase.
  const ok = NextResponse.json({ ok: true });

  let slug = '';
  try {
    const body: unknown = await req.json();
    if (body && typeof body === 'object' && typeof (body as { slug?: unknown }).slug === 'string') {
      slug = (body as { slug: string }).slug.trim().toLowerCase();
    }
  } catch {
    /* no body → no-op */
  }
  if (!slug || slug.length > 200) return ok;

  const today = manilaToday();

  // Cookie-side dedup: already counted this event today on this device → no-op.
  const store = await cookies();
  const map = parseStdViewCookie(store.get(STD_VIEW_COOKIE)?.value);
  if (map[slug] === today) return ok;

  const admin = createAdminClient();
  const { data: event } = await admin
    .from('events')
    .select('event_id, event_date, event_type')
    .ilike('slug', slug)
    .maybeSingle();

  // Only count real wedding pages that are actually in the Save-the-Date phase.
  if (!event || event.event_type !== 'wedding') return ok;
  if (getLifecyclePhase(event.event_date) !== 'save_the_date') return ok;

  // Exclude the couple's / coordinators' OWN visits. The beacon carries the
  // viewer's cookies, so a signed-in HOST (event_members couple/coordinator or
  // an accepted event_moderator) is detected here and skipped. Anonymous and
  // guest-session viewers have no Supabase auth user → counted. Mirrors the
  // page's isAuthedHost check; runs only on a would-be count (post cookie-dedup).
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (user) {
    const [{ data: member }, { data: moderator }] = await Promise.all([
      admin
        .from('event_members')
        .select('member_type')
        .eq('event_id', event.event_id)
        .eq('user_id', user.id)
        .maybeSingle(),
      admin
        .from('event_moderators')
        .select('moderator_id')
        .eq('event_id', event.event_id)
        .eq('user_id', user.id)
        .not('accepted_at', 'is', null)
        .is('removed_at', null)
        .maybeSingle(),
    ]);
    if (member || moderator) return ok; // host's own visit — never counted
  }

  const { error } = await admin.rpc('record_std_view', {
    p_event_id: event.event_id,
    p_date: today,
  });
  if (error) return ok; // counting is best-effort; never block the page

  // Mark this device as counted for this event today (so refreshes are no-ops).
  ok.cookies.set({
    name: STD_VIEW_COOKIE,
    value: serializeStdViewCookie(map, slug, today),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 400, // ~13 months
  });
  return ok;
}
