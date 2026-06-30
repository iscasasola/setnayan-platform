/**
 * Shared server-side view model for the /login surface.
 *
 * WHY: the sign-in UI now renders in TWO places that must stay byte-for-byte in
 * sync — the standalone full-page `/login` (hard load / refresh / SEO) and the
 * intercepted overlay (`app/@modal/(.)login`, the frosted rail that slides in
 * over the homepage on soft navigation). Both need the identical params
 * contract, OAuth-visibility gating, and hero image. Computing it once here
 * keeps the two entry points from drifting.
 *
 * PRESERVED from the prior /login/page.tsx (per [[feedback_setnayan_button_preservation]]):
 *   - searchParams contract: error / check_email / ready / next.
 *   - safeNext() validation of the redirect destination.
 *   - getClientShell() OAuth gating (web + desktop show OAuth; mobile/native
 *     WebView stays email-only because Google refuses OAuth in an embedded view).
 */
import { getClientShell } from '@/lib/request-platform';
import { safeNext } from '@/lib/auth';
import { ANY_OAUTH_ENABLED } from '@/app/_components/oauth-button-row';
import { fetchPublishedHeroVideo } from '@/lib/hero-video';

export type LoginSearchParams = {
  error?: string;
  check_email?: string;
  ready?: string;
  next?: string;
};

export type LoginView = {
  errorMessage: string | null;
  justSignedUpEmail: string | null;
  readyEmail: string | null;
  prefilledEmail: string;
  next: string;
  signupHref: string;
  showOAuth: boolean;
  desktopOAuth: boolean;
  /** First frame of the published homepage hero video, or null → CSS gradient. */
  heroImageUrl: string | null;
};

export async function getLoginView(params: LoginSearchParams): Promise<LoginView> {
  const errorMessage = params.error ? decodeURIComponent(params.error) : null;
  const justSignedUpEmail = params.check_email
    ? decodeURIComponent(params.check_email)
    : null;
  const readyEmail = params.ready ? decodeURIComponent(params.ready) : null;
  const prefilledEmail = readyEmail ?? '';
  const next = safeNext(params.next);
  const signupHref = `/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;

  // OAuth visibility by shell — see prior /login/page.tsx note. Desktop renders
  // the loopback variant; web renders the server-action row; mobile stays
  // email-only.
  const shell = await getClientShell();
  const showOAuth = ANY_OAUTH_ENABLED && shell !== 'mobile';
  const desktopOAuth = showOAuth && shell === 'desktop';

  // Reuse the owner-uploaded homepage hero as the left-panel photo so /login
  // shares the marketing site's hero imagery. Fails open to a gradient (the
  // scene renders fine with heroImageUrl = null) so a missing/unpublished hero
  // never breaks the sign-in surface.
  let heroImageUrl: string | null = null;
  try {
    const hero = await fetchPublishedHeroVideo();
    heroImageUrl = hero?.frameUrls?.[0] ?? null;
  } catch {
    heroImageUrl = null;
  }

  return {
    errorMessage,
    justSignedUpEmail,
    readyEmail,
    prefilledEmail,
    next,
    signupHref,
    showOAuth,
    desktopOAuth,
    heroImageUrl,
  };
}
