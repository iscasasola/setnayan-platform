import { NextResponse } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { setCompletionConsent } from '@/lib/papic-games';

// POST /api/papic/guest-mission-consent
//
// A guest grants or withdraws the §4.1 per-vendor share consent on a completed
// Photo Challenge (RA 10173 §16 — withdrawal as easy as granting). guest_id comes
// from the setnayan_guest_session cookie — never the client — so a guest can only
// change consent on THEIR OWN completion. The RPC forces false for vendorless
// missions. Returns { ok, shared } where `shared` is the effective share state.
//
// Body: { missionId: string, consent: boolean }

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await readGuestSession();
  if (!session) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const b = (body ?? {}) as { missionId?: unknown; consent?: unknown };
  if (typeof b.missionId !== 'string' || b.missionId.length === 0) {
    return NextResponse.json({ error: 'missing_mission' }, { status: 400 });
  }
  // Explicit boolean only — anything other than a literal true is "keep private".
  const consent = b.consent === true;

  const admin = createAdminClient();
  const shared = await setCompletionConsent(admin, {
    guestId: session.guest_id,
    missionId: b.missionId,
    consent,
  }).catch(() => false);

  return NextResponse.json({ ok: true, shared });
}
