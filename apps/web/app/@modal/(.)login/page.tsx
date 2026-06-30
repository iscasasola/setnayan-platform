/**
 * Intercepted /login — the frosted sign-in rail that slides in OVER the page you
 * were on (homepage, /pricing, …) on a SOFT navigation to /login, instead of
 * navigating away to the standalone page. Next.js intercepting route: `(.)login`
 * matches /login at the root level and renders into the root layout's `@modal`
 * parallel slot, leaving the underlying page mounted behind. Owner 2026-07-01.
 *
 * A hard load / refresh / deep-link of /login does NOT hit this interceptor —
 * the `@modal` slot falls back to default.tsx (null) and app/login/page.tsx
 * renders as the full standalone page. So both paths reuse the same LoginHero +
 * SignInRail and the same auth wiring (getLoginView); only the wrapper differs
 * (this one adds the client LoginOverlay for motion + dismiss).
 */
import { LoginHero } from '@/app/login/_components/login-hero';
import { SignInRail } from '@/app/login/_components/sign-in-rail';
import { LoginOverlay } from '@/app/login/_components/login-overlay';
import { getLoginView, type LoginSearchParams } from '@/app/login/_components/login-data';

export default async function InterceptedLogin({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const params = await searchParams;
  const { heroImageUrl, ...rail } = await getLoginView(params);

  return (
    <LoginOverlay
      hero={<LoginHero heroImageUrl={heroImageUrl} />}
      rail={<SignInRail {...rail} />}
    />
  );
}
