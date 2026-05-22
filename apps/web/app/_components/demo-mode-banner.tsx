/**
 * Sitewide banner shown when demo mode is active.
 *
 * Server component. Reads the demo-mode cookie + the current user's
 * profile, and renders a sticky-top banner only when an admin has
 * the flag turned on. Non-admin sessions never see this banner even
 * if they somehow have the cookie set (defense in depth — the
 * predicate enforces admin status).
 *
 * Mounted from the root layout so it shows up on every page when
 * demo mode is active. The banner has a per-session dismiss flag in
 * `sessionStorage` so an admin who wants to verify what couples see
 * uncluttered can hide it without flipping the whole mode off.
 *
 * Brand voice — no dev text. Speaks editorially about what demo mode
 * does (surfaces synthetic vendors with pricing visible) and ties it
 * to the Dec 1, 2026 cleanup deadline so the existence of demo data
 * never gets forgotten between sessions. Per CLAUDE.md row 458
 * ("hide-prices spec lock") and PR brief 2026-05-22 evening.
 */

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
  DEMO_MODE_CLEANUP_DEADLINE,
  DEMO_MODE_COOKIE_NAME,
  isAdminProfile,
} from '@/lib/demo-mode';
import { DemoModeBannerClient } from './demo-mode-banner-client';

export async function DemoModeBanner() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value;
  if (cookieValue !== '1') return null;

  // Cookie says demo mode is on — verify the session is still admin.
  // If a non-admin somehow has the cookie (e.g., admin signed out and
  // a non-admin signed in on the same browser), don't render.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!isAdminProfile(profile)) return null;

  // Format the deadline once on the server so the client doesn't have
  // to ship a date library. PHT (+08:00) so it reads cleanly for
  // Filipino admins.
  const deadlineLabel = new Date(DEMO_MODE_CLEANUP_DEADLINE).toLocaleDateString(
    'en-PH',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Manila',
    },
  );

  return <DemoModeBannerClient deadlineLabel={deadlineLabel} />;
}
