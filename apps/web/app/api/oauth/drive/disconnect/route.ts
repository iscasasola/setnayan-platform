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

async function readForm(
  req: NextRequest,
): Promise<{ eventId: string | null; slot: string | null }> {
  // Support both <form action="..."> POSTs (multipart/url-encoded) and
  // programmatic JSON callers from a future client-component disconnect UX.
  // `slot=overflow` targets the 2nd Drive (provider='drive_overflow').
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as
      | { event_id?: string; slot?: string }
      | null;
    return { eventId: body?.event_id ?? null, slot: body?.slot ?? null };
  }
  const form = await req.formData().catch(() => null);
  return {
    eventId: (form?.get('event_id') as string | null) ?? null,
    slot: (form?.get('slot') as string | null) ?? null,
  };
}

export async function POST(req: NextRequest) {
  const { eventId, slot } = await readForm(req);
  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 });
  }
  // slot=overflow → disconnect the 2nd Drive only (owner 2026-07-11). It has no
  // events.* mirror, so it never touches Drive #1's photo-delivery pointer or the
  // papic_storage_target.
  const isOverflow = slot === 'overflow' || slot === '2';
  const provider = isOverflow ? 'drive_overflow' : 'drive';

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
    .eq('provider', provider)
    .is('revoked_at', null)
    .maybeSingle();

  // events.* mirror to reset — ONLY for the primary Drive (overflow has none).
  const eventReset = isOverflow
    ? null
    : {
        papic_storage_target: 'setnayan_r2',
        // Phase 0: the shared Drive disconnect clears the Photo Delivery panel
        // state too so both surfaces return to idle together.
        photo_delivery_provider: null,
        photo_delivery_oauth_expires_at: null,
        photo_delivery_folder_id: null,
        photo_delivery_folder_name: null,
        photo_delivery_account_email: null,
        photo_delivery_status: 'idle',
      };

  // No grant = nothing to do; still flip the primary's storage target back to R2
  // just in case the event row is in an inconsistent state, then redirect.
  if (!grant) {
    if (eventReset) {
      await admin.from('events').update(eventReset).eq('event_id', eventId);
    }
    const target = new URL(`/dashboard/${eventId}/studio/papic`, req.url);
    target.searchParams.set('drive_disconnected', '1');
    return NextResponse.redirect(target);
  }

  // --- Best-effort Google revoke ---
  // We only call Google when env is configured. If not, we still flip
  // revoked_at locally — that's the source of truth for whether we'll
  // ever use this token again.
  const config = await getDriveOAuthConfig();
  if (config.ready) {
    await revokeDriveToken(grant.refresh_token as string);
  }

  // --- WIPE THE CREDENTIAL + flip revoked_at locally + reset storage target ---
  //
  // ⚠ THIS USED TO SET `revoked_at` ONLY, and its comment argued that was
  // enough because revoked_at is "the source of truth for whether we'll ever
  // use this token again." That is the wrong test. The question is not whether
  // WE would use it — it is whether we are still HOLDING a key to someone's
  // Google Drive after they asked us to let go. A Google refresh token does not
  // expire on its own.
  //
  // The YouTube disconnect was fixed on 2026-07-27 and this one was not, so the
  // fix reached one of the two BYO paths. Both now write the same three fields
  // as the Setnayan-owned channel pool (`lib/live-studio-channel-grants.ts`):
  // refresh_token '' (the column is NOT NULL, hence '' not null) · access_token
  // null · revoked_at now.
  //
  // Safe by ordering: the Google revoke above already read
  // `grant.refresh_token` into memory, so wiping the column here cannot break
  // it.
  await Promise.all([
    admin
      .from('oauth_grants')
      .update({
        refresh_token: '',
        access_token: null,
        revoked_at: new Date().toISOString(),
      })
      .eq('grant_id', grant.grant_id),
    ...(eventReset
      ? [admin.from('events').update(eventReset).eq('event_id', eventId)]
      : []),
  ]);

  const target = new URL(`/dashboard/${eventId}/studio/papic`, req.url);
  target.searchParams.set('drive_disconnected', '1');
  return NextResponse.redirect(target);
}
