import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginRedirectPath } from '@/lib/auth';

/**
 * Shared admin gate — council fix #1 (2026-07-09).
 *
 * WHY: the only auth check in front of /admin pages was the layout's isAdmin
 * block, and a Next.js layout is NOT a safe auth boundary — it doesn't re-run
 * on soft navigation or crafted RSC requests, while the pages under it call
 * createAdminClient() (the RLS-bypassing service-role client) with zero auth
 * of their own. Every admin PAGE that touches the service-role client must
 * call requireAdmin() itself; server ACTIONS call requireAdminAction().
 *
 * The underlying user + profile lookup is cache()'d, so layout + page +
 * /admin/work calling the gate in the same request costs ONE profile query.
 *
 * ROLLOUT: this PR gates the Overview page + refactors the layout and the
 * payments actions onto the shared helper. Rolling the call out to the other
 * ~58 admin pages is a mechanical follow-up PR (tracked in the changelog
 * fragment) — the layout gate still covers the common path meanwhile.
 */
const getAdminGate = cache(
  async (): Promise<{ userId: string | null; isAdmin: boolean }> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { userId: null, isAdmin: false };
    const { data: me } = await supabase
      .from('users')
      .select('is_internal, is_team_member, account_type')
      .eq('user_id', user.id)
      .maybeSingle();
    return {
      userId: user.id,
      isAdmin: !!(
        me?.is_internal ||
        me?.is_team_member ||
        me?.account_type === 'admin'
      ),
    };
  },
);

/**
 * Page/layout gate: unauthenticated → login redirect; authenticated non-admin
 * → 404 (never a redirect, so the /admin route doesn't leak its own existence
 * — same contract the admin layout has always had).
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const gate = await getAdminGate();
  if (!gate.userId) redirect(loginRedirectPath('/admin'));
  if (!gate.isAdmin) notFound();
  return { userId: gate.userId };
}

/**
 * Server-action gate: actions can't render a not-found boundary, so a
 * non-admin caller gets a thrown Forbidden instead (the contract the payments
 * actions' local requireAdmin already had before it was promoted here).
 */
export async function requireAdminAction(): Promise<{ userId: string }> {
  const gate = await getAdminGate();
  if (!gate.userId) redirect('/login');
  if (!gate.isAdmin) throw new Error('Forbidden');
  return { userId: gate.userId };
}
