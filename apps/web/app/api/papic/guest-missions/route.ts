import { NextResponse } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensurePapicBoard, fetchGuestMissions } from '@/lib/papic-games';
import { eventPabatiActive } from '@/lib/pabati';

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

  // Idempotently materialize + rank the §9 20-slot board (couple + vendor +
  // Setnayan) before reading. ensure_papic_board advisory-locks per event and
  // calls ensure_papic_auto_missions internally, so concurrent guest opens can't
  // double-insert. Best-effort: a hiccup leaves the v4 reader to FAIL-SOFT to the
  // pre-board (created_at) ordering, so missions are never blanked.
  //
  // The RPC is deliberately NOT granted to `anon`, but that guards the
  // DIRECT-from-browser path. Here we call it SERVER-SIDE via the service-role
  // admin client on behalf of a cookie-validated guest (auth.uid() IS NULL →
  // the couple/coordinator/admin gate is bypassed for the server), scoped to
  // THIS guest's own cookie-derived event — the same trust model as guest-capture.
  //
  // Pabati (#5) availability is computed SERVER-SIDE here and passed in — the
  // resolver never trusts a client-supplied flag, and eventSkuActive (a 6-source
  // entitlement engine) stays out of SQL. Fail-closed: an error → false → Pabati
  // is skipped + backfilled.
  const pabatiActive = await eventPabatiActive(admin, session.event_id).catch(() => false);
  await ensurePapicBoard(admin, session.event_id, pabatiActive).catch(() => 0);

  const missions = await fetchGuestMissions(admin, session.guest_id).catch(() => []);
  return NextResponse.json({ missions });
}
