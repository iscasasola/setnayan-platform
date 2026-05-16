import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getDriveOAuthConfig,
  revokeDriveToken,
} from '@/lib/papic-drive';

// Iteration 0012 Papic — Google Drive OAuth disconnect.
//
// POST /api/oauth/drive/disconnect
// body (form-data or JSON): { event_id: <uuid> }
//
// 1. Verifies the caller is signed in and is a couple on this event.
// 2. Loads the active grant (revoked_at IS NULL) for the event.
// 3. POSTs the refresh_token to Google's revoke endpoint (best-effort —
//    Google returns 200 for valid tokens, 400 for already-revoked; we
//    treat both as success).
// 4. Sets revoked_at on the local oauth_grants row.
// 5. Also flips events.papic_storage_target back to 'setnayan_r2' so
//    the capture pipeline can't be left in a broken "google_drive_only
//    + no active grant" state. The couple can re-connect or stay on
//    Setnayan R2; either way is safe.
// 6. Redirects (form post) or returns JSON (programmatic call) back to
//    the Papic setup page with ?drive_disconnected=1.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readEventId(req: NextRequest): Promise<string | null> {
  // Support both <form action="..."> POSTs (multipart/url-encoded) and
  // programmatic JSON callers from a future client-component disconnect UX.
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as
      | { event_id?: string }
      | null;
    return body?.event_id ?? null;
  }
  const form = await req.formData().catch(() => null);
  return (form?.get('event_id') as string | null) ?? null;
}

export async function POST(req: NextRequest) {
  const eventId = await readEventId(req);
  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 });
  }

  // --- Auth check: signed-in user + couple membership ---
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    return NextResponse.json(
      { error: 'Only the couple can disconnect Google Drive for this event' },
      { status: 403 },
    );
  }

  // --- Load the grant ---
  const admin = createAdminClient();
  const { data: grant } = await admin
    .from('oauth_grants')
    .select('grant_id, refresh_token')
    .eq('event_id', eventId)
    .eq('provider', 'drive')
    .is('revoked_at', null)
    .maybeSingle();

  // No grant = nothing to do; still flip storage target back to R2 just
  // in case the event row is in an inconsistent state, then redirect.
  if (!grant) {
    await admin
      .from('events')
      .update({ papic_storage_target: 'setnayan_r2' })
      .eq('event_id', eventId);
    const target = new URL(`/dashboard/${eventId}/add-ons/papic`, req.url);
    target.searchParams.set('drive_disconnected', '1');
    return NextResponse.redirect(target);
  }

  // --- Best-effort Google revoke ---
  // We only call Google when env is configured. If not, we still flip
  // revoked_at locally — that's the source of truth for whether we'll
  // ever use this token again.
  const config = getDriveOAuthConfig();
  if (config.ready) {
    await revokeDriveToken(grant.refresh_token as string);
  }

  // --- Flip revoked_at locally + reset storage target ---
  // Running both updates in parallel — they target different tables and
  // neither depends on the other's result.
  await Promise.all([
    admin
      .from('oauth_grants')
      .update({ revoked_at: new Date().toISOString() })
      .eq('grant_id', grant.grant_id),
    admin
      .from('events')
      .update({ papic_storage_target: 'setnayan_r2' })
      .eq('event_id', eventId),
  ]);

  const target = new URL(`/dashboard/${eventId}/add-ons/papic`, req.url);
  target.searchParams.set('drive_disconnected', '1');
  return NextResponse.redirect(target);
}
