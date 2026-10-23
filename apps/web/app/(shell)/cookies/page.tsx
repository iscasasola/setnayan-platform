import Link from 'next/link';
import { LegalLayout, LegalSection } from '@/app/_components/legal/legal-chrome';



/*
  ⚠ `dynamic` IS DECLARED ONCE, ON `app/(shell)/layout.tsx`, NOT HERE.
  The shared shell reads the session, so every route in this group must be
  dynamic — and a layout's `dynamic` DOES cover its children (measured: with
  the pages declaring nothing, `force-dynamic` on the group layout alone moved
  them from `○ Static` to `ƒ Dynamic` in the build table). This file used to
  carry its own copy, along with a docblock asserting a layout could not do
  this. That assertion was false. Twenty copies of one rule is twenty places
  for it to disagree with itself — do not re-add it here.
*/

export const metadata = {
  title: 'Cookie policy',
  description:
    'The cookies and browser storage Setnayan uses and why, under the Philippine Data Privacy Act (RA 10173). Essential cookies only — no analytics, advertising or tracking cookies, so there is no cookie banner.',
  alternates: { canonical: '/cookies' },
  openGraph: {
    title: 'Cookie policy · Setnayan',
    description:
      'Setnayan uses essential cookies only. No analytics, advertising or tracking cookies.',
    url: '/cookies',
  },
};

/*
  🍪 ESSENTIAL COOKIES ONLY (owner 2026-10-22). Every cookie named below was read
  off the code that sets it — `cookies().set`, `response.cookies.set`, the
  Supabase SSR client and `document.cookie` — not from a description of it. If
  you add a cookie, add it here in the same PR; `essential-cookies-only.test.ts`
  holds the "no analytics SDK, no consent banner" half of this promise.
*/

type Row = { name: string; what: string; keeps: string };

function CookieList({ rows }: { rows: Row[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.name}>
          <span className="flex flex-wrap gap-x-3">
            {r.name.split(' · ').map((n) => (
              <code key={n} className="break-all font-mono text-[12px] text-ink">
                {n}
              </code>
            ))}
          </span>
          <span className="block">
            {r.what} <span className="text-ink/55">· {r.keeps}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const SIGN_IN: Row[] = [
  {
    name: 'sb-…-auth-token',
    what: 'Keeps you signed in (Supabase, our sign-in provider). May be split into numbered parts.',
    keeps: 'up to 1 year — longer in the installed app; until you close the browser if “Stay signed in” is off',
  },
  {
    name: 'setnayan-client-type',
    what: 'Whether you are in a browser, the installed web app, or the desktop or phone app, so we know how long to keep you signed in.',
    keeps: '30 days',
  },
  {
    name: 'sn_signup_terms · sn_rsvp_terms',
    what: 'Carries your “I agree to the Terms” tick to the step that creates your account.',
    keeps: '30 minutes · 30 days',
  },
  {
    name: 'sn_native_landing',
    what: 'Marks a sign-in that started in the phone app, so it returns there.',
    keeps: '5 minutes',
  },
];

const GUESTS: Row[] = [
  {
    name: 'setnayan_guest_session · setnayan_guest_passes',
    what: 'Your signed guest pass for an invitation, so the page knows which seat is yours.',
    keeps: '60 days',
  },
  {
    name: 'setnayan_host_opens_pass',
    what: 'Lets a host open their own invitation as a guest would see it.',
    keeps: 'until you close the browser',
  },
  { name: 'sn_request_key', what: 'Remembers a pass you asked a host for.', keeps: '60 days' },
  { name: 'sn_p1_welcomed', what: 'Remembers that you already answered the plus-one welcome.', keeps: '1 year' },
  {
    name: 'sn_find_me · sn_find_device',
    what: 'Finding your invitation by name: a short key for the search, and a random value used only to limit repeated look-ups from one phone.',
    keeps: '15 minutes · 1 day',
  },
];

const SCREENS_AND_CHOICES: Row[] = [
  {
    name: 'setnayan_live_screen · setnayan_wall_display',
    what: 'Pairs a venue screen or photo wall with an event, so it keeps showing it.',
    keeps: '30 days · 1 day',
  },
  { name: 'sn-theme', what: 'Your Appearance choice (light or dark).', keeps: '1 year' },
  {
    name: 'sn_patiktok_booth_…',
    what: 'The booth template a host picked for their event.',
    keeps: '1 year',
  },
];

const STAFF: Row[] = [
  {
    name: 'setnayan_demo_mode · setnayan_demo_mode_hint · setnayan_admin_pw_flash · sn_view_as_free',
    what: 'Switches and one-time notices for Setnayan staff only. Never set for anyone else.',
    keeps: '2 minutes to 1 day, or until the browser closes',
  },
];

const VIEW_COUNTS: Row[] = [
  {
    name: 'sn_vc · sn_vp',
    what: 'Stops one browser counting twice toward a storyteller’s chapter or profile view count.',
    keeps: '90 days',
  },
  {
    name: 'sv',
    what: 'Stops one browser counting twice toward a Save the Date’s daily view count.',
    keeps: 'about 13 months',
  },
  {
    name: 'sn_vw',
    what: 'A random value so one signed-out browser counts once toward a supplier’s profile views. We store only a one-way hash of it, never the value itself.',
    keeps: '1 year',
  },
];

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Cookies & browser storage"
      meta="Effective 2026-10-22 · last updated 2026-10-23 · subject to RA 10173 (Philippines Data Privacy Act)"
    >
      <LegalSection title="The short version">
        <p>
          Setnayan uses <strong>essential cookies only</strong> — the ones that
          sign you in, keep the service secure, remember an invitation pass, and
          remember choices you make — plus a few that stop one browser being
          counted twice on a page&rsquo;s view count (listed below). Our daily
          count of visits uses no cookie at all. We do{' '}
          <strong>not</strong> use analytics, advertising or cross-site tracking
          cookies, we set no third-party cookies, and we don&rsquo;t sell your
          data. Because there is nothing optional to accept, there is no cookie
          banner.
        </p>
        <p>
          Every cookie we set is first-party — set by Setnayan&rsquo;s own site
          and sent only back to it. None is used for advertising.
        </p>
      </LegalSection>

      <LegalSection title="Signing in">
        <CookieList rows={SIGN_IN} />
        <p>
          If you sign in with Google or Apple, you go to their page for a
          moment; any cookies there are theirs, under their own policies. Back
          on Setnayan, the same sign-in cookie above keeps you signed in.
        </p>
      </LegalSection>

      <LegalSection title="Invitations and guests">
        <CookieList rows={GUESTS} />
      </LegalSection>

      <LegalSection title="Event screens and your choices">
        <CookieList rows={SCREENS_AND_CHOICES} />
      </LegalSection>

      <LegalSection title="Setnayan staff">
        <CookieList rows={STAFF} />
      </LegalSection>

      <LegalSection title="Keeping view counts honest">
        <p>
          Suppliers, couples and storytellers see how many times their page was
          viewed. These cookies only stop the same browser being counted twice.
          They are never used for advertising or to follow you to other sites.
        </p>
        <CookieList rows={VIEW_COUNTS} />
      </LegalSection>

      <LegalSection title="Counting visits — no cookie">
        <p>
          We also count how many people open Setnayan each day. This sets{' '}
          <strong>no cookie</strong> and stores nothing in your browser. To
          count you once a day, we turn your IP address and browser into a
          one-way code, mixed with a random value that changes every day. That
          code and that day&rsquo;s random value are deleted the next day, and
          we never store your IP address. Only the daily totals are kept (see{' '}
          <Link href="/privacy#visits" className="text-terracotta hover:underline">
            Counting visits
          </Link>{' '}
          in our privacy policy).
        </p>
      </LegalSection>

      <LegalSection title="Browser storage">
        <p>
          Like most apps, Setnayan also keeps things in your browser&rsquo;s
          own storage so pages load quickly and work offline: a copy of data
          you have already loaded, drafts you have not saved yet, and small
          display choices. This stays on your device. Three entries are worth
          naming:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <code className="font-mono text-[12px]">sn_did</code> — fraud
            protection: a random value for this browser. When you are signed
            in, we store only a one-way hash of it, to spot fake and duplicate
            accounts (see{' '}
            <Link href="/privacy" className="text-terracotta hover:underline">
              Device identifier
            </Link>{' '}
            in our privacy policy). Never used for advertising or tracking.
          </li>
          <li>
            <code className="font-mono text-[12px]">setnayan_seat_device</code>{' '}
            — a random value used only to limit repeated find-your-seat
            searches from one phone.
          </li>
          <li>
            <code className="font-mono text-[12px]">sentryReplaySession</code>{' '}
            — when something breaks, our error reporting (Sentry) can attach a
            short replay of the screen with all text masked and all images
            blocked. It lives in session storage and is cleared when you close
            the tab. Sentry sets no cookies.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="What we do NOT use">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            No analytics service and no analytics cookies — beyond the view
            counts and the daily visit count above, nothing measures how you use
            Setnayan.
          </li>
          <li>No advertising or retargeting cookies.</li>
          <li>No cross-site tracking, and no data brokers.</li>
          <li>No selling or renting of your information.</li>
        </ul>
        <p>
          Some event pages embed a YouTube live stream. It uses YouTube&rsquo;s
          privacy-enhanced player, which sets no tracking cookies until someone
          presses play; after that, YouTube&rsquo;s own cookie policy applies.
        </p>
      </LegalSection>

      <LegalSection title="Removing cookies">
        <p>
          You can clear cookies and site data for Setnayan in your browser
          settings at any time. Clearing them signs you out and forgets any
          invitation passes and choices on that browser.
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
