import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revokeDriveToken } from '@/lib/papic-drive';

// 0009 Photo Delivery — disconnect Drive.
//
// POST /api/photo-delivery/disconnect
// Body: { event_id: string }
//
// Couple-authenticated. Revokes the photo-delivery Drive refresh token
// at Google (best-effort), marks the oauth_grants row revoked, and
// clears the events.photo_delivery_* panel-facing fields so the panel
// re-renders to its idle/Connect state. The folder Setnayan created in
// the couple's Drive is NOT deleted (the couple owns those files now);
// they can keep, move, or delete them themselves.
//
// Idempotent: safe to call repeatedly; if the grant is already revoked
// or never existed, the endpoint still flips the events row to idle
// and returns 200.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: { event_id?: string };
  try {
    body = (await req.json()) as { event_id?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const eventId = body.event_id;
  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Pull the grant first so we can revoke at Google.
  const { data: grant } = await admin
    .from('oauth_grants')
    .select('grant_id, refresh_token, revoked_at')
    .eq('event_id', eventId)
    .eq('provider', 'drive_photo_delivery')
    .maybeSingle();

  if (grant && !grant.revoked_at && grant.refresh_token) {
    await revokeDriveToken(grant.refresh_token as string);
    await admin
      .from('oauth_grants')
      .update({
        revoked_at: new Date().toISOString(),
        access_token: null,
        access_token_expires_at: null,
      })
      .eq('grant_id', grant.grant_id);
  }

  // Clear events.photo_delivery_* to idle. Folder pointer is intentionally
  // wiped so re-connect produces a fresh folder rather than reusing a
  // stale id the couple may have moved/deleted.
  await admin
    .from('events')
    .update({
      photo_delivery_provider: null,
      photo_delivery_oauth_expires_at: null,
      photo_delivery_folder_id: null,
      photo_delivery_folder_name: null,
      photo_delivery_account_email: null,
      photo_delivery_status: 'idle',
      photo_delivery_progress_pct: 0,
      photo_delivery_started_at: null,
      photo_delivery_completed_at: null,
      photo_delivery_failed_count: 0,
      photos_released_at: null,
    })
    .eq('event_id', eventId);

  return NextResponse.json({ ok: true });
}
