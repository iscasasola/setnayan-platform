import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchUserRoleSummary } from '@/lib/roles';
import { landingForAccount } from '@/lib/auth-confirm-link';
import { DOOR_PARAM, parseDoor } from '@/lib/doors';
import { routes } from '@/lib/routes';

/**
 * /auth/door?door=supplier|coordinator — where a sign-in from a business door lands (owner 24 Nov 2026, drawing
 * "Business door drawing" v7).
 *
 * Every way of signing in already honours `next` exactly as given — the password action, Google / Apple
 * (`/auth/callback`), the magic link and the any-device email link (`/auth/confirm`). The door's sign-in card hands
 * them `next=/auth/door?door=X` (`doorLandingHref`), and so does `/login?door=X` for someone already signed in. This
 * route then asks the ONE landing rule, `landingForAccount`, with the door and the account's shop:
 *   · a supplier or coordinator account (it owns or is on a shop) → the supplier dashboard;
 *   · no shop yet → the shop set-up on the SAME account (`/open-shop`, Coordination already picked on the coordinator
 *     door) — never a second account.
 * Signed out (or an anonymous session) → the door's sign-in card. Held by app/auth/door/the-door-lands-by-one-rule.test.ts.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const door = parseDoor(url.searchParams.get(DOOR_PARAM));
  if (!door) return NextResponse.redirect(new URL(routes.login(), url.origin));

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || user.is_anonymous) {
    return NextResponse.redirect(new URL(`${routes.login()}?${DOOR_PARAM}=${door}`, url.origin));
  }

  const [roles, profile] = await Promise.all([
    fetchUserRoleSummary(supabase, user.id),
    supabase.from('users').select('account_type').eq('user_id', user.id).maybeSingle(),
  ]);
  if (profile.error) console.error('[supabase-error] app/auth/door/route.ts · from:users.select', profile.error);
  // A shop is known when one is found; "none" only when the shop list was measured (`shopsMeasured`) — a refused
  // read is not "no shop", so it falls back to the account type.
  const hasShop = roles.hasVendorAccess ? true : roles.shopsMeasured ? false : null;
  const accountType = (profile.data?.account_type as string | null | undefined) ?? null;

  return NextResponse.redirect(new URL(landingForAccount('/', accountType, { door, hasShop }), url.origin));
}
