import { NextResponse } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureAutoMissions, fetchGuestMissions } from '@/lib/papic-games';

// GET /api/papic/guest-missions
//
// The guest's live Photo Challenge list (Papic Games §5#3). The guest is the
// zero-account model — identified by their setnayan_guest_session cookie, so
// guest_id is derived SERVER-SIDE here and never trusted from the client, the
// same trust boundary the capture route uses. Flag-gated end to end: the
// wrappers no-op (return 0 / []) when NEXT_PUBLIC_PAPIC_GAMES_V1 is off, so this
// returns an empty list until the owner flips the flag.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await readGuestSession();
  if (!session) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Idempotently materialize the FREE booth missions for this event's booked
  // vendors before reading. ensure_papic_auto_missions is advisory-locked +
  // unique-indexed, so concurrent guest opens can't double-insert. Best-effort:
  // a generation hiccup still returns whatever missions already exist.
  //
  // The RPC is deliberately NOT granted to `anon` ("guests never generate"),
  // but that guards the DIRECT-from-browser path — a guest's own anon Postgres
  // role can't call it. Here we call it SERVER-SIDE via the service-role admin
  // client on behalf of a cookie-validated guest, which is an explicitly
  // authorized caller (the RPC's couple/coordinator/admin gate only applies when
  // auth.uid() IS NOT NULL). event_id is cookie-derived, so generation is always
  // scoped to THIS guest's own event — the same trust model as guest-capture.
  await ensureAutoMissions(admin, session.event_id).catch(() => 0);

  const missions = await fetchGuestMissions(admin, session.guest_id).catch(() => []);
  return NextResponse.json({ missions });
}
