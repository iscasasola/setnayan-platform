import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getYoutubeOAuthConfig,
  revokeYoutubeToken,
} from '@/lib/panood-youtube';

// Iteration 0011 Panood — YouTube OAuth disconnect.
//
// POST /api/oauth/youtube/disconnect
// body (form-data or JSON): { event_id: <uuid> }
//
// 1. Verifies the caller is signed in and is a couple on this event.
// 2. Loads the active grant (revoked_at IS NULL) for the event.
// 3. POSTs the refresh_token to Google's revoke endpoint (best-effort —
//    Google returns 200 for valid tokens, 400 for already-revoked; we
//    treat both as success).
// 4. Sets revoked_at on the local oauth_grants row.
// 5. Redirects (form post) or returns JSON (programmatic call) back to the
//    Panood setup page with ?youtube_disconnected=1.

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
      { error: 'Only the couple can disconnect YouTube for this event' },
      { status: 403 },
    );
  }

  // --- Load the grant ---
  const admin = createAdminClient();
  const { data: grant } = await admin
    .from('oauth_grants')
    .select('grant_id, refresh_token')
    .eq('event_id', eventId)
    .eq('provider', 'youtube')
    .is('revoked_at', null)
    .maybeSingle();

  // No grant = nothing to do; treat as success.
  if (!grant) {
    const target = new URL(`/dashboard/${eventId}/studio/panood`, req.url);
    target.searchParams.set('youtube_disconnected', '1');
    return NextResponse.redirect(target);
  }

  // --- Best-effort Google revoke ---
  // We only call Google when env is configured. If not, we still flip
  // revoked_at locally — that's the source of truth for whether we'll
  // ever use this token again.
  const config = await getYoutubeOAuthConfig();
  if (config.ready) {
    await revokeYoutubeToken(grant.refresh_token as string);
  }

  // --- Flip revoked_at locally, AND DESTROY THE CREDENTIAL ---
  //
  // ⭐ 2026-07-27: this used to write `revoked_at` ALONE, which left the couple's
  // plaintext Google refresh token sitting in `oauth_grants` indefinitely after they
  // pressed Disconnect. Nothing would ever use it again — every reader early-returns
  // on `revoked_at` — but "we stopped using it" is not "we no longer hold it", and a
  // stored credential the user believes they revoked is exactly the thing RA 10173
  // asks us not to keep. It is also the sentence /privacy has to be able to make.
  //
  // The pool side already did this: `lib/live-studio-channel-grants.ts` writes
  // `refresh_token: ''` + `access_token: null` + `revoked_at` when a Setnayan channel
  // is disconnected. The couple's own credential deserves at least the care we give
  // our own, so BYO now matches it exactly — same three fields, same empty-string form
  // (the column is NOT NULL, hence '' rather than null).
  //
  // Safe by ordering: the Google revoke above already read `grant.refresh_token` into
  // memory, so wiping the column here cannot break it.
  await admin
    .from('oauth_grants')
    .update({
      refresh_token: '',
      access_token: null,
      revoked_at: new Date().toISOString(),
    })
    .eq('grant_id', grant.grant_id);

  const target = new URL(`/dashboard/${eventId}/studio/panood`, req.url);
  target.searchParams.set('youtube_disconnected', '1');
  return NextResponse.redirect(target);
}
