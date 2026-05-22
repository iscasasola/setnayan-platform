/**
 * POST /api/admin/demo-mode/toggle
 *
 * Admin-only demo-mode toggle. Owner-approved 2026-05-22 evening per
 * the PR brief that follows CLAUDE.md row 458 (the open "hide-prices
 * lock" question). When demo mode is ON, the marketplace + /v/[slug]
 * surface `is_demo=TRUE` vendor rows with their pricing visible — a
 * narrow override for admins who want to dogfood what couples would
 * see if the hide-prices lock were lifted.
 *
 * The form body sends `state=on` or `state=off`. Anything else returns
 * 400 to keep the endpoint as boring as possible.
 *
 * Auth model:
 *   - 401 if unauthenticated.
 *   - 403 if authenticated but not admin (is_internal OR is_team_member
 *     OR account_type='admin'). Non-admins should never reach this
 *     endpoint via the UI — the toggle page itself is admin-gated by
 *     the admin layout — but if they hand-craft the POST, return 403
 *     so the audit trail is honest.
 *
 * On success: writes the cookie via `setDemoModeCookie`, inserts an
 * `admin_audit_log` row, and 303-redirects back to the toggle page
 * with a `?toggled=on` or `?toggled=off` query string so the page can
 * render a success toast.
 *
 * Note: the `admin_audit_log` row is the canonical "who toggled what
 * when" record. The toggle page's "Last toggled" line reads from this
 * table.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { setDemoModeCookie, isAdminProfile } from '@/lib/demo-mode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member, email')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!isAdminProfile(profile)) {
    return NextResponse.json({ error: 'Admin only.' }, { status: 403 });
  }

  const form = await req.formData();
  const state = form.get('state');
  if (state !== 'on' && state !== 'off') {
    return NextResponse.json(
      { error: 'Body must include state=on or state=off.' },
      { status: 400 },
    );
  }

  const turnOn = state === 'on';
  const beforeJson = await readPreviousState(req);

  // 303 See Other so the browser issues a GET to the redirect target —
  // standard POST-redirect-GET pattern that prevents accidental resend
  // on refresh.
  const redirect = NextResponse.redirect(
    new URL(`/admin/settings/demo-mode?toggled=${state}`, req.url),
    303,
  );
  setDemoModeCookie(redirect, turnOn);

  // Audit log every transition. Single-admin authority per
  // `0023_admin_console.md` § 4.3 — flipping demo mode is operational,
  // not a major decision, so no two-admin gate.
  const admin = createAdminClient();
  await admin.from('admin_audit_log').insert({
    action: turnOn ? 'demo_mode_enabled' : 'demo_mode_disabled',
    target_table: 'session',
    target_id: user.id,
    before_json: { demo_mode: beforeJson },
    after_json: { demo_mode: turnOn ? 'on' : 'off' },
    reason: `Demo mode toggled ${turnOn ? 'on' : 'off'} via /admin/settings/demo-mode.`,
    actor_user_id: user.id,
  });

  return redirect;
}

/**
 * Best-effort read of the previous cookie state so the audit row can
 * record the transition (not just the new state). Falls back to
 * `'unknown'` if the cookie header isn't parseable.
 */
async function readPreviousState(req: NextRequest): Promise<'on' | 'off' | 'unknown'> {
  try {
    const cookie = req.cookies.get('setnayan_demo_mode');
    if (cookie?.value === '1') return 'on';
    return 'off';
  } catch {
    return 'unknown';
  }
}

// Explicit 405 on GET so a stray nav doesn't accidentally toggle.
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: 'method_not_allowed',
      message: 'POST only. Toggle via /admin/settings/demo-mode.',
    },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
