/**
 * Shared server-side view model for the /login surface.
 *
 * WHY: the sign-in UI renders in more than one place that must stay in sync —
 * the `/login` route (hard load / refresh / SEO / redirect) and the marketing
 * top-nav overlay (HomeOverlays). Both render the shared greige SignInCard and
 * need the identical params contract + OAuth-visibility gating. Computing it
 * once here keeps them from drifting. (The /login route reads all of it; the
 * marketing overlay uses the OAuth-visibility bits + next='/'.)
 *
 * PRESERVED from the prior /login/page.tsx (per [[feedback_setnayan_button_preservation]]):
 *   - searchParams contract: error / check_email / ready / next.
 *   - safeNext() validation of the redirect destination.
 *   - the shell OAuth gate (lib/oauth-shell-gate.ts): web + desktop show OAuth;
 *     the phone app shows it only in a build with the native sign-in plugin,
 *     which never uses the web view for Google (Google refuses an embedded view).
 */
import { getOAuthGate } from '@/lib/request-platform';
import { safeNext } from '@/lib/auth';
import { OAUTH_FLAGS } from '@/app/_components/oauth-button-row';
import { parseProviderParam, type KnownProvider } from '@/lib/sign-in-door';
import { loginErrorFromParam } from '@/lib/human-auth-error';
import { eventSlugFromNext } from '@/lib/sign-in-for-a-guest';
import { createAdminClient } from '@/lib/supabase/admin';

export type LoginSearchParams = {
  error?: string;
  check_email?: string;
  ready?: string;
  next?: string;
  /**
   * Account-type hint carried through to the signup link (only 'vendor' is
   * honored). Lets a login-first vendor CTA (e.g. /open-shop when logged out)
   * land on Sign in yet keep the "New? Create your vendor account" path
   * preselecting the vendor radio via /signup?as=vendor.
   */
  as?: string;
  /** Set by the sign-in action after a failed password attempt on a Google/Apple-only account. */
  provider?: string;
};

export type LoginView = {
  errorMessage: string | null;
  /** The door the account actually uses (only with an errorMessage). */
  provider: KnownProvider | null;
  justSignedUpEmail: string | null;
  readyEmail: string | null;
  prefilledEmail: string;
  next: string;
  signupHref: string;
  showOAuth: boolean;
  desktopOAuth: boolean;
  /** The phone app: Apple sheet + Google in the system browser (lib/native-oauth.ts). */
  nativeOAuth: boolean;
  /** `next` opens an event — the card speaks to a guest, not a planner. */
  forGuest: boolean;
};

/**
 * Does `next` lead back to a real event? Only then is the card a guest's.
 * A supplier's shop shares the bare root, so the slug alone cannot say — one
 * read of `events` does. Best-effort: a failed read is the ordinary card.
 */
async function nextOpensAnEvent(next: string): Promise<boolean> {
  const slug = eventSlugFromNext(next);
  if (!slug) return false;
  try {
    const { data } = await createAdminClient()
      .from('events')
      .select('event_id')
      .ilike('slug', slug)
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function getLoginView(params: LoginSearchParams): Promise<LoginView> {
  /* 🔒 NEVER THE URL'S OWN WORDS (guest text audit 2026-09-30). `?error=` is a
     query param anyone can type, and this card printed whatever read like a
     sentence — so a link reading "/login?error=Your account is locked, call
     0917…" rendered a phishing line inside OUR sign-in card. It is mapped to
     one of a FIXED set of sentences here, before it reaches the render. */
  const errorMessage = loginErrorFromParam(params.error);
  const provider = errorMessage ? parseProviderParam(params.provider) : null;
  const justSignedUpEmail = params.check_email
    ? decodeURIComponent(params.check_email)
    : null;
  const readyEmail = params.ready ? decodeURIComponent(params.ready) : null;
  const prefilledEmail = readyEmail ?? '';
  const next = safeNext(params.next);
  // Carry both the return destination and the (whitelisted) account-type hint
  // onto the signup link so a login-first vendor CTA doesn't lose vendor intent.
  const signupParams = new URLSearchParams();
  if (next !== '/') signupParams.set('next', next);
  if (params.as === 'vendor') signupParams.set('as', 'vendor');
  const signupQuery = signupParams.toString();
  const signupHref = `/signup${signupQuery ? `?${signupQuery}` : ''}`;

  // OAuth visibility by shell (lib/oauth-shell-gate.ts). Desktop renders the
  // loopback variant; the phone app the native variant (only in a build that
  // carries it — an older one stays email-only); web the server-action row.
  const gate = await getOAuthGate(OAUTH_FLAGS);
  const showOAuth = gate.show;
  const desktopOAuth = gate.desktop;
  const nativeOAuth = gate.native;
  const forGuest = await nextOpensAnEvent(next);

  return {
    errorMessage,
    provider,
    justSignedUpEmail,
    readyEmail,
    prefilledEmail,
    next,
    signupHref,
    showOAuth,
    desktopOAuth,
    nativeOAuth,
    forGuest,
  };
}
