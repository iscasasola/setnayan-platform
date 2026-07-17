/**
 * /login — the standalone destination for a hard load / refresh / deep-link /
 * SEO crawl / server redirect (e.g. bounced off a protected route) of /login.
 *
 * ONE LOGIN EVERYWHERE (owner 2026-07-18 "we only want 1 login … that popup and
 * dimming the background anywhere"): this renders the SAME greige "Sign in to
 * Setnayan." card visitors see from the marketing top-nav — via the shared
 * SignInCardModal — instead of a bespoke full-page layout. Close/Escape/backdrop
 * go home (dismissHref="/") since there's no page behind on a hard load, and the
 * dim sits over a paper base.
 *
 * The auth wiring (signInWithPassword server action, OAuth gating, the
 * error/check_email/ready/next searchParams contract + safeNext()) is unchanged —
 * it lives in ./_components/login-data.ts and ./_components/sign-in-card.tsx, per
 * [[feedback_setnayan_button_preservation]].
 */
import type { Metadata } from 'next';
import { SignInCardModal } from './_components/sign-in-card-modal';
import { getLoginView, type LoginSearchParams } from './_components/login-data';

export const metadata: Metadata = {
  title: 'Sign in · Setnayan',
  description:
    'Sign in to your Setnayan account. One account for couples planning their wedding and vendors selling their services.',
  alternates: { canonical: '/login' },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const params = await searchParams;
  const view = await getLoginView(params);

  // A paper base under the translucent greige dim so a hard load never flashes a
  // stark void behind the backdrop before the card settles.
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--m-paper)' }}>
      <SignInCardModal
        dismissHref="/"
        next={view.next}
        signupHref={view.signupHref}
        showOAuth={view.showOAuth}
        desktopOAuth={view.desktopOAuth}
        errorMessage={view.errorMessage}
        justSignedUpEmail={view.justSignedUpEmail}
        readyEmail={view.readyEmail}
        prefilledEmail={view.prefilledEmail}
      />
    </main>
  );
}
