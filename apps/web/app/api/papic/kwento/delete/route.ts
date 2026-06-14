import { NextResponse } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/papic/kwento/delete — a zero-account guest removes their OWN Kwento.
// The window (24h from submit), ownership, and the not-yet-baked guard all live
// in the service-role-only `guest_delete_own_message` RPC (guests have no
// auth.uid(), same trust model as submit). Soft-delete: the row is marked
// user_deleted + pulled from every public surface.

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await readGuestSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { messageId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const messageId = body.messageId?.trim();
  if (!messageId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('guest_delete_own_message', {
    p_guest_id: session.guest_id,
    p_message_id: messageId,
  });

  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  // false = not the author / past 24h / already gone / locked into a keepsake.
  if (data !== true) return NextResponse.json({ error: 'too_late' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
