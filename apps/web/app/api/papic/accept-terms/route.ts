import { NextResponse } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/papic/accept-terms
//
// One-time UGC terms-of-use acceptance for the Papic guest camera (Apple
// guideline 1.2 / Google Play UGC: a published EULA defining objectionable
// content + an acceptance gate before a user can post). The guest is
// identified by the setnayan_guest_session cookie — no sign-in — so this
// mirrors /api/papic/guest-capture: read the cookie, then stamp acceptance
// through the SECURITY DEFINER papic_accept_ugc_terms RPC (idempotent; the
// first acceptance wins). The guest camera gates its first capture on this.

export const runtime = 'nodejs';

export async function POST() {
  const session = await readGuestSession();
  if (!session) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('papic_accept_ugc_terms', {
    p_guest_id: session.guest_id,
  });
  if (error) {
    return NextResponse.json({ error: 'accept_failed' }, { status: 500 });
  }

  const result = (data ?? {}) as { status?: string };
  if (result.status === 'ok') {
    return NextResponse.json({ status: 'ok' });
  }
  return NextResponse.json(result, { status: 400 });
}
