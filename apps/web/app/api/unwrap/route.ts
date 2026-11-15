import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isUuid } from '@/lib/is-uuid';
import { isGiftMomentSource } from '@/lib/gift-moment';
import { claimGiftMoment, readEventGiftMoments, readShopGiftMoments } from '@/lib/gift-moment.server';

export const dynamic = 'force-dynamic';

/**
 * 🎁 THE GIFT MOMENT'S ONE DOOR (owner 2026-11-14, DECISION_LOG "THE GIFT MOMENT" · "PRESSING REDEEM IS THE CLAIM").
 *
 *   GET  /api/unwrap?event=<eventId>  — a supplier's gifts on that event, for its HOST (couple member). Asked by
 *                                             Home AFTER it has drawn, so Home's own reads never grow for it.
 *   GET  /api/unwrap?shop=1           — the signed-in supplier's badge rewards. Asked by Today after its badge
 *                                             read (which is what pays a newly earned reward).
 *   POST /api/unwrap  {source, ref}   — Redeem: the claim. Idempotent — a repeat answers the SAME claim.
 *
 * Named /api/unwrap, not /api/gift-…, because the couple's gift-LIST guards (`the-couples-gift-list-follows-the-
 * drawing.test.ts`, `the-gift-record-follows-the-drawing.test.ts`) hold that the Pabuya gift list adds no route; this
 * door is the gift MOMENT's, a different thing, and those guards stay as they are.
 *
 * ⚡ A route, not a server action, on purpose: the server-action budget is at its ceiling
 * (`scripts/lint-server-action-budget.mjs`), and this one file serves both the read and the claim.
 *
 * Who may see or claim a gift is decided IN THE DATABASE (`gift_moments_for_event` / `gift_moments_for_shop` /
 * `gift_moment_claim`, called as the signed-in person) — this file never widens it. A guest, a stranger or another
 * shop gets no rows and a refused claim.
 */
const NO_STORE = { 'cache-control': 'private, no-store' } as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to see your gifts.' }, { status: 401, headers: NO_STORE });

  const sp = request.nextUrl.searchParams;
  const eventId = sp.get('event');
  if (eventId) {
    if (!isUuid(eventId)) return NextResponse.json({ error: 'That event could not be found.' }, { status: 400, headers: NO_STORE });
    const moments = await readEventGiftMoments(supabase, eventId);
    if (!moments) return NextResponse.json({ error: 'Your gifts could not be read just now.' }, { status: 503, headers: NO_STORE });
    return NextResponse.json({ moments }, { headers: NO_STORE });
  }
  if (sp.get('shop') === '1') {
    const profile = await fetchOwnVendorProfile(supabase, user.id);
    if (!profile) return NextResponse.json({ error: 'Your shop could not be found.' }, { status: 404, headers: NO_STORE });
    const moments = await readShopGiftMoments(supabase, createAdminClient(), profile.vendor_profile_id);
    if (!moments) return NextResponse.json({ error: 'Your gifts could not be read just now.' }, { status: 503, headers: NO_STORE });
    return NextResponse.json({ moments }, { headers: NO_STORE });
  }
  return NextResponse.json({ error: 'Say which gifts: ?event=<id> or ?shop=1.' }, { status: 400, headers: NO_STORE });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ status: 'refused' }, { status: 401, headers: NO_STORE });

  const body = (await request.json().catch(() => null)) as { source?: unknown; ref?: unknown } | null;
  if (!body || !isGiftMomentSource(body.source) || !isUuid(body.ref)) {
    return NextResponse.json({ status: 'refused' }, { status: 400, headers: NO_STORE });
  }
  const answer = await claimGiftMoment(supabase, body.source, body.ref);
  // No answer from the database: the claim may or may not have landed. The button says "No connection — your gift
  // is safe" and Try again re-sends this SAME claim, which the key makes safe.
  if (!answer) return NextResponse.json({ status: 'unknown' }, { status: 503, headers: NO_STORE });
  return NextResponse.json(
    { status: answer.status, claimedAt: answer.claimedAt },
    { status: answer.status === 'refused' ? 403 : 200, headers: NO_STORE },
  );
}
