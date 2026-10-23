import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchUserRoleSummary } from '@/lib/roles';
import { ACTIVE_SHOP_COOKIE, reachableShops } from '@/lib/active-shop';

/**
 * 🔀 THE SHOP-ID SWITCH — the avatar sheet's shop rows post here (owner 2026-10-22, Direction 2: "one row per
 * shop"). Writes `sn_shop` naming the chosen shop, then opens the supplier dashboard.
 *
 * 🔒 THE ID IS CHECKED BEFORE IT IS WRITTEN: it must be one of `reachableShops(...)` for the signed-in login, read
 * fresh here — never trusted from the form: every shop this login OWNS and every shop it helps in (owner 2026-10-22,
 * "every account switches between all of its shops"). Anything else (signed out, a forged id, a removed seat) writes
 * nothing and opens the dashboard as it was. The resolver re-checks the cookie on EVERY read (`resolveActiveShop`,
 * lib/active-shop.ts), so a seat removed after the switch falls back rather than opening; RLS is the fence under both.
 *
 * POST only (a form in the sheet), so a link on another site cannot flip which shop a person is standing in.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/vendor-dashboard', request.url), { status: 303 });
  let chosen = '';
  try {
    const form = await request.formData();
    chosen = String(form.get('shop') ?? '').trim();
  } catch {
    return response;
  }
  if (!chosen) return response;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url), { status: 303 });

  const roles = await fetchUserRoleSummary(supabase, user.id);
  const allowed = reachableShops(roles.vendorProfiles).some((s) => s.vendor_profile_id === chosen);
  if (!allowed) return response;

  response.cookies.set(ACTIVE_SHOP_COOKIE, chosen, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
