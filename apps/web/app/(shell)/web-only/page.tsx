import Link from 'next/link';
import { LegalLayout, LegalSection } from '@/app/_components/legal/legal-chrome';
import { getCurrentUser } from '@/lib/auth';

/*
  WHERE THE STORE SHELL LANDS when it reaches a web-only feature.

  Middleware sends the Capacitor (App Store / Play Store) shell here from every
  paid digital feature's home and every purchase route — see lib/store-shell.ts
  for the list and for why the desktop .dmg is exempt. App Review 2026-06-30,
  Guideline 3.1.1 via 3.1.3(b).

  🔒 THE COPY IS DELIBERATELY BLANK ABOUT WHERE ELSE THE FEATURE LIVES. The
  2026-06-25 posture (PR #2180) is "no pointer to where to buy": naming the
  website, a price, or a purchase here is exactly the external steering 3.1.1
  forbids outside the US storefront. Say only that it is not in the app.

  `dynamic` is declared once on app/(shell)/layout.tsx and covers this route.

  🔑 THE WAY OUT DEPENDS ON WHO IS LOOKING (sweep 2026-10-19 row C10). A
  signed-out visitor reaches this page too — a shared /features link, a
  /papic deep link before signing in — and was offered "Back to your
  dashboard", a dashboard they do not have (it bounced them to /login anyway).
  Signed in → back to the dashboard; signed out → Sign in. The session is the
  shell's own per-request read (`getCurrentUser` is `cache()`d), so this adds
  no round trip.
*/

export const metadata = {
  title: 'Not available in the app',
  robots: { index: false, follow: false },
};

export default async function WebOnlyPage() {
  const user = await getCurrentUser();
  const way = user
    ? { href: '/dashboard', label: 'Back to your dashboard' }
    : { href: '/login', label: 'Sign in' };
  return (
    <LegalLayout title="Not available in the app" meta="Setnayan for iPhone and Android">
      <LegalSection title="This part of Setnayan is not included in the app">
        <p>
          The app covers planning your event — your guest list, seating, schedule,
          mood board, save-the-date and RSVP, and booking suppliers. This feature
          is not part of the app version.
        </p>
        <p>
          <Link
            href={way.href}
            className="inline-flex min-h-[44px] items-center font-medium text-mulberry hover:text-mulberry-600"
          >
            {way.label}
          </Link>
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
