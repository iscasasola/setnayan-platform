import Link from 'next/link';
import { LegalLayout, LegalSection } from '@/app/_components/legal/legal-chrome';
import { CookieSettingsLink } from '@/app/_components/legal/cookie-settings-link';

export const revalidate = 3600;

export const metadata = {
  title: 'Cookie policy · Setnayan',
  description:
    'The cookies and local storage Setnayan uses, why, and how to change your choices under the Philippine Data Privacy Act (RA 10173). Essential cookies only by default; analytics is opt-in; no advertising cookies.',
  alternates: { canonical: '/cookies' },
  openGraph: {
    title: 'Cookie policy · Setnayan',
    description:
      'What cookies Setnayan uses and how to change your choices. No advertising cookies.',
    url: '/cookies',
  },
};

export default function CookiesPage() {
  return (
    <LegalLayout
      eyebrow="Cookie policy"
      title="Cookies & local storage"
      meta="Effective 2026-06-30 · subject to RA 10173 (Philippines Data Privacy Act)"
    >
      <LegalSection title="The short version">
        <p>
          We use a small number of cookies and browser-storage entries.{' '}
          <strong>Essential</strong> ones keep you signed in and the app
          working — these are always on. <strong>Analytics</strong> cookies are
          optional and only run if you say yes. We do{' '}
          <strong>not</strong> use advertising or cross-site tracking cookies,
          and we don&rsquo;t sell your data. You can change your choice at any
          time: <CookieSettingsLink className="text-terracotta hover:underline" />.
        </p>
      </LegalSection>

      <LegalSection title="Essential — always on">
        <p>
          Strictly necessary to deliver the service you asked for. They
          don&rsquo;t need consent because the site can&rsquo;t function without
          them.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Authentication / session</strong> — keeps you logged in
            (Supabase auth).
          </li>
          <li>
            <strong>Security</strong> — protects forms and requests from
            cross-site abuse.
          </li>
          <li>
            <strong>Preferences</strong> — remembers your theme and your cookie
            choice itself, so we don&rsquo;t ask again on every visit.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Analytics — opt-in">
        <p>
          Helps us understand which pages are useful and where the product is
          confusing, so we can improve it. These only load <strong>after you
          accept</strong> them.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>PostHog</strong> — privacy-respecting product analytics.
            Anonymous visitors are counted in aggregate; session recordings are
            disabled and we keep no advertising profiles. If you decline,
            PostHog is never initialized in your browser.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="What we do NOT use">
        <ul className="ml-5 list-disc space-y-1">
          <li>No advertising or retargeting cookies.</li>
          <li>No cross-site tracking or data brokers.</li>
          <li>No selling or renting of your information.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Changing your choice">
        <p>
          Open{' '}
          <CookieSettingsLink className="text-terracotta hover:underline" /> any
          time to accept or turn off analytics. You can also clear cookies and
          site data in your browser settings, which resets the banner so it
          asks again. Turning analytics off takes effect immediately — no
          reload needed.
        </p>
      </LegalSection>

      <LegalSection title="Related">
        <p>
          How we handle the data behind these cookies is described in our{' '}
          <Link href="/privacy" className="text-terracotta hover:underline">
            privacy policy
          </Link>
          . For questions, email our Data Protection Officer at{' '}
          <a href="mailto:dpo@setnayan.com" className="text-terracotta hover:underline">
            dpo@setnayan.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
