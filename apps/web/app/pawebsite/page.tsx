/**
 * /pawebsite — public marketing landing page for Pawebsite, the editorial
 * wedding website (www.setnayan.com/pawebsite).
 *
 * Part of the "Pa-" public-surface wave (owner-approved 2026-06-27; Pa- naming
 * LOCKED). Mirrors the /papic + /setnayan-ai pattern exactly: force-static
 * Server Component, static `metadata`, SoftwareApplication + FAQPage JSON-LD,
 * hero + benefit sections + FAQ + a Mulberry-accent primary CTA, and the shared
 * SiteFooter. The persistent SiteChrome nav renders because '/pawebsite' is
 * registered in NAV_ROUTES.
 *
 * POSITIONING (locked "Editorial human positioning"): the couple website is the
 * "front-page story of your life" — save-the-date, RSVP, the event page, and the
 * editorial story, all under one address. Sell the BENEFIT (one beautiful home
 * for your whole wedding) and quote NO price (admin-managed + provisional —
 * links to /pricing). Copy sells BENEFITS only (public-surface hygiene).
 */

import Link from 'next/link';
import { Reveal } from '@/app/_components/marketing/_motion';
import {
  LineRevealHeading,
  RevealBand,
  RevealList,
  HowItWorksPanel,
} from '@/app/_components/marketing/_pa-motion';

export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Pawebsite — Your Editorial Wedding Website · Setnayan';
const PAGE_DESCRIPTION =
  'Pawebsite is one beautiful home for your whole wedding — your save-the-date, your RSVP, your event details, and your love story, told like a magazine feature. One address you share once, and everything your guests need is there.';
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/pawebsite' },
  keywords: [
    'wedding website Philippines',
    'wedding website builder',
    'online wedding invitation',
    'wedding RSVP website',
    'save the date website',
    'editorial wedding website',
    'Pawebsite',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/pawebsite',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Pawebsite — your editorial wedding website' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// SoftwareApplication JSON-LD — no price (admin-managed + provisional);
// publisher references the site-wide Organization.
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Pawebsite — Editorial Wedding Website',
  url: `${SITE_URL}/pawebsite`,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'One home for your whole wedding — one address to share',
    'Save-the-date that announces the day beautifully',
    'RSVP your guests answer in seconds',
    'Event details: when, where, what to wear, how to get there',
    'Your love story, told like a magazine feature',
    'Looks designed, not templated — on every phone and laptop',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'What’s on the website?',
    a: 'Everything your guests need in one place: your save-the-date, your RSVP, the event details — when, where, dress code, directions — and your love story, told like an editorial feature. One address you share once.',
  },
  {
    q: 'Do I need to design or code anything?',
    a: 'No. You fill in your details and the website composes itself into something that looks designed, not templated. It reads beautifully on any phone or laptop without you touching a single setting.',
  },
  {
    q: 'How does the RSVP work?',
    a: 'Your guests tap a button on the site and they’re counted — no forms to print, no replies to chase. You see who’s coming in real time, right alongside your guest list and seating.',
  },
  {
    q: 'What makes it “editorial”?',
    a: 'Most wedding sites are a form with a photo on top. Yours reads like the front-page story of your life — your story laid out with the care of a magazine feature, not a fill-in template.',
  },
  {
    q: 'Can it grow with everything else?',
    a: 'Yes. The same website is where your guest gallery, your live stream, and your day-of details live too — so one address carries your whole wedding, before, during, and after.',
  },
];

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const STEPS = [
  {
    t: 'Tell your story once',
    d: 'Add your details and your story — how you met, your date, your venue, what to wear. No design work, no code; the website composes itself around you.',
  },
  {
    t: 'Share one address',
    d: 'Your save-the-date, RSVP, event details, and love story all live at one beautiful address. Send it once and your guests have everything they need.',
  },
  {
    t: 'Watch the replies roll in',
    d: 'Guests RSVP in a tap, and you see who’s coming in real time — right beside your guest list and seating, all in the same place.',
  },
];

const VS = [
  ['A separate site that expires', 'Your wedding’s permanent home'],
  ['A form with a photo on top', 'Your story, told like a feature'],
  ['Chase replies by message', 'Guests RSVP in a tap'],
  ['Five links for five things', 'One address for the whole day'],
];

export default function PawebsiteLandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:pt-14">
        {/* Hero */}
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8C6932]">In your wedding · editorial website</p>
          <LineRevealHeading
            as="h1"
            trigger="mount"
            className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[var(--m-ink)] sm:text-5xl"
          >
            One beautiful home for your whole wedding.
          </LineRevealHeading>
          <RevealBand stagger={0.08} y={14}>
            <p data-reveal-item className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
              Pawebsite brings your save-the-date, your RSVP, your event details, and your love story under one
              address — told like a magazine feature. Share it once, and everything your guests need is there.
            </p>
            <div data-reveal-item className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/onboarding/wedding?from=pawebsite"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[var(--m-mulberry)] px-7 py-3 text-sm font-semibold text-[var(--m-paper)] transition-opacity hover:opacity-90"
              >
                Start planning · free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[var(--m-ink)]/20 px-7 py-3 text-sm font-semibold text-[var(--m-ink)] transition-colors hover:bg-[var(--m-ink)]/[0.04]"
              >
                See pricing
              </Link>
            </div>
          </RevealBand>
        </header>

        {/* How it works — the one PanelThread panel. */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="How Pawebsite works">
          <HowItWorksPanel>
            <ol className="grid gap-6 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li
                  key={s.t}
                  data-premium-item
                  className="rounded-2xl border border-[var(--m-ink)]/10 bg-white/60 p-5"
                >
                  <span className="font-mono text-xs text-[#8C6932]">{String(i + 1).padStart(2, '0')}</span>
                  <h2 className="mt-2 font-serif text-lg text-[var(--m-ink)]">{s.t}</h2>
                  <p className="mt-1.5 text-sm text-[#5F5E5A]">{s.d}</p>
                </li>
              ))}
            </ol>
          </HowItWorksPanel>
        </section>

        {/* The differentiator */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="What makes Pawebsite different">
          <LineRevealHeading className="text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
            Not just a wedding form
          </LineRevealHeading>
          <p className="mx-auto mt-3 max-w-xl text-center text-base text-[#5F5E5A]">
            Most wedding sites are a date and a button. Yours reads like the front-page story of your life.
          </p>
          <RevealList
            className="mt-7 overflow-hidden rounded-2xl border border-[var(--m-ink)]/10"
            stagger={0.06}
            y={12}
          >
            {VS.map(([before, after], i) => (
              <li
                key={after}
                data-reveal-item
                className={`grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-6 ${i % 2 ? 'bg-white/40' : 'bg-white/70'}`}
              >
                <span className="text-sm text-[#9A8F86] line-through decoration-[#9A8F86]/40">{before}</span>
                <span className="text-sm font-medium text-[var(--m-ink)]">{after}</span>
              </li>
            ))}
          </RevealList>
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-16 max-w-2xl" aria-label="Pawebsite questions">
          <LineRevealHeading className="text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
            Questions, answered
          </LineRevealHeading>
          <dl className="mt-7 divide-y divide-[var(--m-ink)]/10 border-y border-[var(--m-ink)]/10">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 40}>
                <div className="py-5">
                  <dt className="font-serif text-base text-[var(--m-ink)]">{f.q}</dt>
                  <dd className="mt-1.5 text-sm text-[#5F5E5A]">{f.a}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </section>

        {/* CTA */}
        <Reveal>
          <section className="mx-auto mt-14 max-w-2xl rounded-3xl border border-[var(--m-orange)]/40 bg-[#FBF6EA] px-6 py-10 text-center">
            <h2 className="font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">Give your wedding its home</h2>
            <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
              Your wedding website lives inside your free Setnayan wedding — alongside your guest list, RSVP, seating,
              and gallery. Start planning free, and make it yours.
            </p>
            <Link
              href="/onboarding/wedding?from=pawebsite"
              className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[var(--m-mulberry)] px-7 py-3 text-sm font-semibold text-[var(--m-paper)] transition-opacity hover:opacity-90"
            >
              Start planning · free
            </Link>
          </section>
        </Reveal>
      </main>
    </>
  );
}
