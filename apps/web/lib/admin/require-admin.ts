import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginRedirectPath } from '@/lib/auth';
import { isAdminProfile } from './admin-predicate';

/**
 * THE admin predicate lives in `./admin-predicate` (pure + dependency-free so
 * it is unit-testable); re-exported here so app code has ONE import site for
 * the admin gate. Never hand-roll a narrower copy of it — see the comment on
 * `requireAdmin` in `app/admin/editorial-review/[editorialId]/actions.ts`.
 */
export { isAdminProfile, type AdminProfileRow } from './admin-predicate';

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
      isAdmin: isAdminProfile(me),
    };
  },
);

/**
 * Where a signed-in account that is not on the team is sent from any admin page: Home (`/`, which opens the
 * account's own Home by `landingForAccount`). Pure so a test can hold it.
 */
export const NOT_ADMIN_LANDING = '/';

/**
 * Page/layout gate: unauthenticated → login redirect; authenticated non-admin → Home.
 *
 * 🏠 A NON-ADMIN GOES HOME, NOT TO A 404 (Batch 0 · L1, MASTER-PLAN A8 + D6, walk 27 Nov). This answered `notFound()`
 * so the console would not "leak its own existence". In practice it stranded people: a sign-in whose `next` was
 * `/admin` (an account added on a phone an admin had used) landed on "This page doesn't exist", and every such visit
 * was logged in Admin › Problems as a not_found, noise the team had to read. The owner's ruling is Home: the account
 * is sent to its own Home instead, and nothing is logged. A server ACTION still
 * refuses with Forbidden below (an action cannot redirect a person who never asked to go anywhere).
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const gate = await getAdminGate();
  if (!gate.userId) redirect(loginRedirectPath('/admin'));
  if (!gate.isAdmin) redirect(NOT_ADMIN_LANDING);
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
