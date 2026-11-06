/**
 * /login — the standalone destination for a hard load / refresh / deep-link /
 * SEO crawl / server redirect (e.g. bounced off a protected route) of /login.
 *
 * ONE LOGIN EVERYWHERE (owner 2026-07-18 "we only want 1 login … that popup and
 * dimming the background anywhere"): this renders the SAME greige "Sign in to
 * Setnayan." card visitors see from the marketing top-nav — via the shared
 * SignInCardModal — instead of a bespoke full-page layout. Close/Escape/backdrop
 * go home (dismissHref="/") since there's no page behind on a hard load — or,
 * for a guest sent here from their event, back to that event — and the dim sits
 * over a paper base.
 *
 * The auth wiring (signInWithPassword server action, OAuth gating, the
 * error/check_email/ready/next searchParams contract + safeNext()) is unchanged —
 * it lives in ./_components/login-data.ts and ./_components/sign-in-card.tsx, per
 * [[feedback_setnayan_button_preservation]].
 */
import type { Metadata } from 'next';
import { SignInCardModal } from './_components/sign-in-card-modal';
import { LastSeenSignedOutWipe } from '@/app/_components/last-seen/last-seen-wipe-script';
import { getLoginView, type LoginSearchParams } from './_components/login-data';

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in to your Setnayan account. One account for couples planning their wedding and suppliers selling their services.',
  alternates: { canonical: '/login' },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const params = await searchParams;
  const view = await getLoginView(params);
  // ✕ (and Escape, and the backdrop) go to Discover ("/") — on the web AND in
  // the phone and desktop apps. The apps open ON this page; while Apple
  // reviewed 1.0 middleware bounced "/" straight back here inside them, so a ✕
  // pointing home did nothing (Apple check 2026-10-19, row #3) and the app drew
  // no ✕ at all. Since the owner's 2026-11-02 ruling ("let everything go live")
  // the apps open "/" like the website, so the ✕ is a real way out everywhere.
  // Held by the-app-login-has-no-dead-close.test.ts, which reads middleware.
  //
  // 🚪 A GUEST'S ✕ GOES BACK TO THEIR EVENT (2026-11-05). "Lost QR? Login" on an
  // Event Hub opens this card with `next` = that event; closing it sent the
  // guest to the marketing front page, away from the invitation they were
  // holding. `forGuest` is true only when `next` (already `safeNext`-checked, so
  // same-site) opens a real event — so the ✕ returns there; anyone else still
  // goes to Discover. Held by app/login/a-guests-close-returns-to-the-event.test.ts.

  // A paper base under the translucent greige dim so a hard load never flashes a
  // stark void behind the backdrop before the card settles.
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--m-paper)' }}>
      {/* 💾 An expired session lands here: no auth cookie → the last-seen store
          (a host's kept pages) is emptied before anything else runs. */}
      <LastSeenSignedOutWipe />
      <SignInCardModal
        dismissHref={view.forGuest ? view.next : '/'}
        next={view.next}
        signupHref={view.signupHref}
        showOAuth={view.showOAuth}
        desktopOAuth={view.desktopOAuth}
        nativeOAuth={view.nativeOAuth}
        errorMessage={view.errorMessage}
        provider={view.provider}
        justSignedUpEmail={view.justSignedUpEmail}
        readyEmail={view.readyEmail}
        prefilledEmail={view.prefilledEmail}
        forGuest={view.forGuest}
      />
    </main>
  );
}
