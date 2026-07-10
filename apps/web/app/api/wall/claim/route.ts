import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { setWallDisplayCookie } from '@/lib/live-wall';
import { clientIp } from '@/lib/client-ip';
import { enforceRateLimit, rateLimited429 } from '@/lib/with-rate-limit';

// POST /api/wall/claim — a venue screen claims its display session.
//
// Salamisim P1 (build plan): the couple generates a single-use 6-char code in
// their Papic add-on page; the venue AV person opens /wall/[eventId] on any
// browser and types it. wall_claim_display (SECURITY DEFINER, service-role-
// only) atomically claims the unexpired, unrevoked, unclaimed code; we mint
// the display-session JWT cookie the feed route requires. The projector is an
// anonymous screen — no Supabase auth, no RLS session; this code+JWT pair IS
// its credential (P0 security invariant: no anon read path to wall_feed).

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { eventId?: string; code?: string };
  try {
    body = (await req.json()) as { eventId?: string; code?: string };
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const eventId = body.eventId?.trim();
  const code = body.code?.trim();
  if (!eventId || !code || code.length > 12) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  // Rate-limit the anon 6-char code-guessing oracle: per-IP AND per-event (lock
  // the code space so an attacker can't brute-force a given wedding from many IPs).
  const ip = clientIp(req.headers) ?? 'noip';
  const ipRl = await enforceRateLimit('wall_claim_ip', ip, { limit: 10, windowSecs: 60 });
  if (!ipRl.ok) return rateLimited429(ipRl.retryAfterSecs);
  const evtRl = await enforceRateLimit('wall_claim_evt', eventId, { limit: 30, windowSecs: 3600 });
  if (!evtRl.ok) return rateLimited429(evtRl.retryAfterSecs);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('wall_claim_display', {
    p_event_id: eventId,
    p_code: code,
  });
  if (error) {
    return NextResponse.json({ error: 'claim_failed' }, { status: 500 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { session_id?: string }
    | undefined;
  if (!row?.session_id) {
    // Wrong/used/expired code — uniform error, no oracle about which.
    return NextResponse.json({ error: 'invalid_code' }, { status: 401 });
  }

  await setWallDisplayCookie({ session_id: row.session_id, event_id: eventId });
  return NextResponse.json({ ok: true });
}
