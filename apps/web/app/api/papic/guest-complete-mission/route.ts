import { NextResponse } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { completeMission } from '@/lib/papic-games';

// POST /api/papic/guest-complete-mission
//
// A guest records completing a Photo Challenge + the §4 per-photo share consent
// (RA 10173 explicit opt-in). guest_id comes from the setnayan_guest_session
// cookie — never the client — so a guest can only ever complete for THEMSELVES.
// The RPC re-validates that the mission and any attached capture belong to this
// guest's own event (no cross-guest photo attach), so this route only shapes
// input and never widens that boundary.
//
// Body: { missionId: string, captureId?: string | null, consentToShare?: boolean }

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

  const b = (body ?? {}) as {
    missionId?: unknown;
    captureId?: unknown;
    consentToShare?: unknown;
  };
  if (typeof b.missionId !== 'string' || b.missionId.length === 0) {
    return NextResponse.json({ error: 'missing_mission' }, { status: 400 });
  }
  const captureId =
    typeof b.captureId === 'string' && b.captureId.length > 0 ? b.captureId : null;
  // Explicit opt-in only: anything other than a literal `true` stays OFF (§4 /
  // RA 10173). A missing or truthy-but-not-true value never opts the guest in.
  const consentToShare = b.consentToShare === true;

  const admin = createAdminClient();
  const completionId = await completeMission(admin, {
    guestId: session.guest_id,
    missionId: b.missionId,
    captureId,
    consentToShare,
  }).catch(() => null);

  if (!completionId) {
    // completeMission returns null when the RPC RAISEs (mission not available
    // for this guest / cross-guest capture / unknown guest) and when the flag
    // is off. All read the same to the guest: this challenge couldn't be saved.
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  return NextResponse.json({ ok: true, completionId });
}
