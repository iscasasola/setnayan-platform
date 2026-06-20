import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { runLoginGhostingCheck } from '@/lib/ghosting';
import { GuidedTour } from '@/app/_components/guided-tour';
import { completeTour } from '@/lib/tour-actions';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SecureAccountBanner } from './_components/secure-account-banner';

/**
 * Root dashboard layout — shared by BOTH the account route group `(account)`
 * (picker · profile · notifications · create-event · api-keys) AND the event
 * subtree `[eventId]/*`.
 *
 * 2026-06-14 chrome retirement: this layout now owns NO visible chrome. The
 * account chrome (`OuterDashboardHeader`) moved to `(account)/layout.tsx`; the
 * event chrome (paper `SidebarShell`) lives in `[eventId]/layout.tsx`. Neither
 * the legacy cream header nor a `lg:pl-60` gutter renders here anymore — which
 * removes the dual-render flash where the cream chrome painted first on event
 * routes and was suppressed only by a client `usePathname()` guard + a
 * `lg:-ml-60` cancel. It keeps only the `app-surface` font lock + a `--m-paper`
 * base background so every dashboard route renders on the new palette from the
 * first paint.
 *
 * What MUST stay here (runs for every authenticated /dashboard route):
 *   - auth gate (redirect to /login)
 *   - the defensive users-profile probe (account_type · deleted_at ·
 *     tour_seen_keys) with the column-drift `SELECT *` fallback
 *   - deleted-account sign-out + vendor → /vendor-dashboard redirect
 *   - the login-driven ghosting check (cron-free · runs after the response)
 *   - the couple welcome GuidedTour
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(loginRedirectPath('/dashboard'));
  }
  const supabase = await createClient();

  // Defensive users SELECT (5th-hotfix pattern, preserved): explicit error
  // capture + a column-drift `SELECT *` fallback so a future ADD COLUMN that
  // lands on code before its migration doesn't crash this load-bearing chrome,
  // and a try/catch so a synchronous supabase-js / transport throw degrades to
  // profile=null instead of bubbling to global-error on the post-login render.
  type ProfileShape = {
    account_type?: string | null;
    deleted_at?: string | null;
    tour_seen_keys?: string[] | null;
  };
  let profile: ProfileShape | null = null;
  try {
    const fullRes = await supabase
      .from('users')
      .select('account_type, deleted_at, tour_seen_keys')
      .eq('user_id', user.id)
      .maybeSingle();
    if (
      fullRes.error &&
      /column .* does not exist|undefined_column|42703/i.test(
        (fullRes.error as { message?: string; code?: string }).message ??
          (fullRes.error as { code?: string }).code ??
          '',
      )
    ) {
      // Column missing on prod → migration drift. Fall back to SELECT *.
      const fallbackRes = await supabase
        .from('users')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      profile = (fallbackRes.data as unknown as ProfileShape) ?? null;
      if (fallbackRes.error) {
        logQueryError(
          'DashboardLayout (users.profile fallback)',
          fallbackRes.error,
          { user_id: user.id },
          'graceful_degrade',
        );
      }
    } else if (fullRes.error) {
      logQueryError(
        'DashboardLayout (users.profile)',
        fullRes.error,
        { user_id: user.id },
        'graceful_degrade',
      );
      profile = null;
    } else {
      profile = (fullRes.data as unknown as ProfileShape) ?? null;
    }
  } catch (caught) {
    logQueryError(
      'DashboardLayout (users.profile threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { user_id: user.id },
      'graceful_degrade',
    );
    profile = null;
  }

  // Reject deleted accounts — sign them out cleanly.
  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect('/login?error=Account+deleted');
  }

  // Vendors belong on the vendor-side tree.
  if (profile?.account_type === 'vendor') {
    redirect('/vendor-dashboard');
  }

  // Login-driven ghosting check (no cron) — runs after the response, gated
  // once per login inside the helper. Couple side: nudge if their inquiries
  // sit unanswered.
  after(() => runLoginGhostingCheck(user.id, 'couple'));

  return (
    <div
      className="app-surface min-h-dvh"
      style={{ background: 'var(--m-paper)' }}
    >
      {/* Anon-draft safety net: only renders for a Supabase anonymous principal
          (their plan isn't yet tied to an email). Vanishes on convert. */}
      {user.is_anonymous ? <SecureAccountBanner /> : null}
      {children}
      {!(profile?.tour_seen_keys ?? []).includes('couple_welcome_v1') ? (
        <GuidedTour tourKey="couple_welcome_v1" completeAction={completeTour} />
      ) : null}
    </div>
  );
}
