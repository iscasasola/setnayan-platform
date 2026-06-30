/**
 * /login — full-bleed cinematic sign-in (mockup "1c · Full-bleed · sign-in
 * rail", owner 2026-07-01). A photographic hero panel (the homepage hero frame)
 * on the left carrying the brand headline + a floating pill nav, with a frosted
 * obsidian sign-in rail on the right. Mobile collapses to the headline over a
 * bottom-anchored rail.
 *
 * This is the STANDALONE page — the destination for a hard load / refresh /
 * deep-link / SEO crawl of /login. The soft-navigation experience (the rail
 * sliding in OVER the page you were on) is the intercepted route at
 * app/@modal/(.)login, which reuses the same LoginHero + SignInRail.
 *
 * Design note: the dark treatment is the OBSIDIAN end of the existing Clean
 * Editorial palette (var(--m-ink) #1E2229), not a separate dark theme — so it
 * coexists with the light-locked app surface. See globals.css `.sn-login`.
 *
 * The auth wiring (signInWithPassword server action, OAuth gating, the
 * error/check_email/ready/next searchParams contract + safeNext()) is unchanged
 * — it now lives in ./_components/login-data.ts (shared with the intercepted
 * route) and ./_components/sign-in-rail.tsx, per
 * [[feedback_setnayan_button_preservation]].
 */
import type { Metadata } from 'next';
import { LoginHero } from './_components/login-hero';
import { SignInRail } from './_components/sign-in-rail';
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
  const { heroImageUrl, ...rail } = await getLoginView(params);

  return (
    <main className="sn-login-page">
      <div className="sn-login sn-login--enter">
        <LoginHero heroImageUrl={heroImageUrl} />
        <aside className="sn-login-rail">
          <SignInRail {...rail} />
        </aside>
      </div>
    </main>
  );
}
