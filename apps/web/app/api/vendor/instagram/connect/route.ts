import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildInstagramAuthorizeUrl,
  generateInstagramStateToken,
  getMetaAppOAuthConfig,
} from '@/lib/vendor-instagram';

// Vendor Instagram connect — OAuth start.
//
// GET /api/vendor/instagram/connect
//
// 1. Verifies the caller is a signed-in vendor (owns a vendor_profiles row).
// 2. Checks IG_APP_ID / IG_APP_SECRET. If unset, returns 503 with a structured
//    payload — the profile page's IG card renders a "coming soon" state instead
//    of the live Connect button, so the feature ships SAFE before the owner
//    finishes the Instagram-Login app + App Review setup.
// 3. Generates a CSRF state nonce + inserts a row into
//    public.vendor_ig_oauth_state (service role — the state table has no
//    vendor-write policy).
// 4. 302 redirects to Instagram's OAuth dialog.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // --- Auth check: signed-in user owning a vendor profile ---
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  const { data: vp } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('user_id', user.id)
    .maybeSingle();
  const vendorProfileId = (vp as { vendor_profile_id?: string } | null)
    ?.vendor_profile_id;
  if (!vendorProfileId) {
    return NextResponse.json(
      { error: 'Only a vendor can connect Instagram' },
      { status: 403 },
    );
  }

  // --- Graceful fallback: 503 when IG_APP_* env vars are missing ---
  const config = getMetaAppOAuthConfig(req.nextUrl.origin);
  if (!config.ready) {
    return NextResponse.json(
      {
        error: 'instagram_connect_not_configured',
        message: 'Instagram connect is coming soon.',
        missing: config.missing,
      },
      { status: 503 },
    );
  }

  // --- CSRF: persist a single-use state nonce via the service role ---
  const state = generateInstagramStateToken();
  const admin = createAdminClient();
  const { error: stateError } = await admin.from('vendor_ig_oauth_state').insert({
    state_token: state,
    vendor_profile_id: vendorProfileId,
    initiated_by: user.id,
  });
  if (stateError) {
    return NextResponse.json(
      { error: 'Could not start Instagram connect. Try again.' },
      { status: 500 },
    );
  }

  const authorizeUrl = buildInstagramAuthorizeUrl({
    appId: config.appId,
    redirectUri: config.redirectUri,
    state,
  });
  return NextResponse.redirect(authorizeUrl);
}
