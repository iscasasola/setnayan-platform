/**
 * OAuth signup account-type reconciliation — pure helpers.
 *
 * The defect: email/password signup passes `account_type` in the Supabase
 * signUp metadata, which the `handle_new_auth_user` trigger reads to set
 * `public.users.account_type`. OAuth CAN'T do that — `signInWithOAuth` has no
 * way to seed the new user's `raw_user_meta_data` (the auth.users row is created
 * in the callback, from the provider profile), so the trigger defaults a vendor
 * signing up via Google/Apple to `'customer'` and no vendor path ever fires.
 *
 * The fix threads the couple/vendor intent through the OAuth round-trip
 * (`?as=vendor` on the callback URL) and RECONCILES it in the callback — but
 * only for a BRAND-NEW account, and only ever customer→vendor, so it can never
 * re-classify or hijack an established account.
 *
 * These helpers are pure (no Supabase, no I/O) so the security-sensitive
 * decisions are unit-testable and reviewable in isolation.
 */

export type OAuthIntentAccountType = 'customer' | 'vendor';

/** Narrow a form field to the account-type intent (default customer). */
export function parseOAuthAccountType(
  raw: FormDataEntryValue | null | undefined,
): OAuthIntentAccountType {
  return raw === 'vendor' ? 'vendor' : 'customer';
}

/**
 * The post-OAuth `next` destination + the callback URL that round-trips the
 * intent. A vendor with no explicit destination lands on `/open-shop` (mirrors
 * the email/password vendor path in signup/actions.ts); `?as=vendor` lets the
 * callback promote the brand-new customer row to vendor. `rawNext` must already
 * be safeNext()'d upstream.
 */
export function buildOAuthCallbackUrl(params: {
  appUrl: string;
  rawNext: string;
  accountType: OAuthIntentAccountType;
}): { next: string; url: string } {
  const { appUrl, rawNext, accountType } = params;
  const next = accountType === 'vendor' && rawNext === '/' ? '/open-shop' : rawNext;
  const q = new URLSearchParams({ next });
  if (accountType === 'vendor') q.set('as', 'vendor');
  return { next, url: `${appUrl}/auth/callback?${q.toString()}` };
}

/** How fresh an auth account must be to be eligible for vendor promotion — wide
 *  enough to cover the OAuth consent round-trip, tight enough that no
 *  established account is ever in-window. */
export const VENDOR_PROMOTE_WINDOW_MS = 120_000; // 2 minutes

/**
 * Whether the callback should promote the just-authenticated user to a vendor.
 * ALL of:
 *   1. explicit `?as=vendor` intent (the /signup vendor OAuth path),
 *   2. the account is BRAND NEW — created within ±the window of `now` (never
 *      re-classify an account with any history; ± tolerates clock skew), and
 *   3. it is currently a plain `customer` — never downgrade or touch an existing
 *      vendor/admin.
 * Any missing/garbled input → false (fail closed).
 */
export function shouldPromoteToVendor(params: {
  intent: string | null | undefined;
  userCreatedAt: string | null | undefined;
  currentAccountType: string | null | undefined;
  now: number;
}): boolean {
  const { intent, userCreatedAt, currentAccountType, now } = params;
  if (intent !== 'vendor') return false;
  if (currentAccountType !== 'customer') return false;
  if (!userCreatedAt) return false;
  const created = Date.parse(userCreatedAt);
  if (!Number.isFinite(created)) return false;
  return Math.abs(now - created) < VENDOR_PROMOTE_WINDOW_MS;
}
