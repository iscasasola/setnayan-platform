import { NextResponse } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensurePapicBoard, fetchGuestMissions } from '@/lib/papic-games';

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
  // ensure_papic_board's OWN gate treats that as the trusted server), scoped to
  // THIS guest's own cookie-derived event — the same trust model as guest-capture.
  //
  // 🚨 THIS COMMENT WAS TRUE, THEN SILENTLY WASN'T, FOR NINE DAYS (fixed
  // 2026-08-10). It used to read "the couple/coordinator/admin gate is bypassed
  // for the server" as a statement about the whole call. But ensure_papic_board
  // began by PERFORMing ensure_papic_auto_missions, and on 2026-08-01 THAT
  // function was hardened — "a missing session is now a REFUSAL, not a bypass".
  // So every call from here raised, the board transaction aborted, the
  // `.catch(() => 0)` below swallowed it, and the reader fail-softed to
  // "no board → show everything by created_at" — a list that looks fine. No
  // library challenge and no booth mission reached a single guest, and CI was
  // green throughout because CI never calls the live database.
  //
  // 🔑 THE BELIEF THAT ROTTED WAS ABOUT A FUNCTION THIS FILE DOES NOT NAME.
  // A comment asserting how a callee's callee behaves has no way to notice when
  // that callee is hardened. The fix put the authorization at the entry points
  // and gave the board an unchecked internal step; `rpc-argument-names.db.test.ts`
  // could never have caught this, so a db test now calls this exact path with a
  // NULL session and asserts a board comes back.
  //
  await ensurePapicBoard(admin, session.event_id).catch(() => 0);

  const missions = await fetchGuestMissions(admin, session.guest_id).catch(() => []);
  return NextResponse.json({ missions });
}
