/**
 * POST /api/hub/seen — THE EVENT HUB'S "SOMEONE IS LOOKING" BEACON (Who's here, owner 2026-10-29: *"which guest is
 * viewing the event hub?"*).
 *
 * The hub page fires this ONCE, after it has drawn, at most once per device per 30 minutes
 * (`app/[slug]/_components/hub-seen-beacon.tsx`). It is a SEPARATE request — never part of the hub's HTML, so the
 * cached hub (`app/[slug]/cached/[key]`) reads no cookie and keeps its key; the middleware also leaves the guest's
 * cache-bust cookie alone for this path (`HUB_BUST_EXEMPT_PATHS`), or every open would cost that guest their cache.
 *
 *   · A guest holding THIS event's pass → their row is stamped (`record_hub_view`, which refuses to move it again
 *     inside 30 minutes — the server half of the debounce). The guest id comes from the VERIFIED pass, never from the
 *     body: nobody can stamp somebody else.
 *   · Anybody else (a stranger, a signed-in visitor, a supplier) → +1 on the event's quarter-hour counter. Never who.
 *   · The event's own team (a signed-in host or moderator, or a host's "Open as <guest>") → nothing: their own looks
 *     are not visitors (the same exclusion `/api/std/view` makes).
 *
 * Always 204, never an error to the page, never a cookie set, and it never says whether a slug exists.
 * 🛑 `HUB_VIEWS_DISABLED=1` turns it into a no-op (`hubViewsEnabled`).
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { eventIdForSlug, readGuestPassStanding } from '@/lib/guest-session';
import { isAuthCookieName } from '@/lib/hub-view-key';
import { loadHostMembership } from '@/app/[slug]/_lib/loaders';
import { hubViewsEnabled } from '@/lib/whos-here';

export const runtime = 'nodejs';
// A beacon is never cached.
export const dynamic = 'force-dynamic';

const done = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request) {
  if (!hubViewsEnabled()) return done();

  let slug = '';
  try {
    // text, not json(): `navigator.sendBeacon` posts a text/plain body (no preflight, no content-type games).
    const body: unknown = JSON.parse(await req.text());
    if (body && typeof body === 'object' && typeof (body as { slug?: unknown }).slug === 'string') {
      slug = (body as { slug: string }).slug.trim().toLowerCase();
    }
  } catch {
    return done();
  }
  if (!slug || slug.length > 100) return done();

  try {
    const eventId = await eventIdForSlug(slug);
    if (!eventId) return done();

    // The team's own looks are not visitors. Only a request carrying a Supabase session can be the team, so a guest
    // or a stranger pays for no auth round-trip here.
    const jar = await cookies();
    if (jar.getAll().some((c) => isAuthCookieName(c.name))) {
      const user = await getCurrentUser();
      if (user && (await loadHostMembership(createAdminClient(), eventId, user.id))) return done();
    }

    // 🔒 A NAME ONLY THROUGH THE GUEST'S OWN PASS — verified, checked against their current QR, and outranked by the
    // account exactly as every other pass reader is (`readGuestPassStanding`). A host's "Open as <guest>" is a host.
    const { session, standing } = await readGuestPassStanding({ eventId });
    if (standing === 'host_preview') return done();
    const guestId = session && session.event_id === eventId ? session.guest_id : null;

    const { error } = await createAdminClient().rpc('record_hub_view', { p_event_id: eventId, p_guest_id: guestId });
    if (error) console.error('[supabase-error] app/api/hub/seen/route.ts · rpc:record_hub_view', error);
  } catch (err) {
    // Best-effort: a count that could not be made is a count, never a broken page.
    console.error('[hub-seen] beacon failed', err);
  }
  return done();
}
