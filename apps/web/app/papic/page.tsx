/**
 * /papic — public marketing landing page for Papic, the guest photo-gallery
 * experience (www.setnayan.com/papic).
 *
 * Part of the "lead with the media layer" public-surface pass (2026-06-20
 * demand-research verdict): Papic is one of the two proven differentiators that
 * incumbents (BridalPod, the ₱699 "photo wall" apps) don't have, and it had no
 * indexable, citable landing page. This is that page — the SEO/GEO surface for
 * "wedding photo sharing Philippines" / "guest photo gallery".
 *
 * Server component, statically rendered. The interactive guest tooling lives at
 * /papic/guest (auth/QR-scoped); this root route is pure marketing. The
 * persistent SiteChrome nav renders because '/papic' is registered in
 * NAV_ROUTES (site-chrome.tsx). Copy sells BENEFITS only (public-surface
 * hygiene) and quotes NO price (prices are admin-managed + provisional — the
 * page links to /pricing instead).
 */

import Link from 'next/link';
import { Reveal } from '@/app/_components/marketing/_motion';
import {
  LineRevealHeading,
  RevealBand,
  RevealList,
  HowItWorksPanel,
  SettleTiles,
} from './_papic-motion';

export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Papic — Guest Photo Gallery for Weddings · Setnayan';
const PAGE_DESCRIPTION =
  'Papic turns your guests into your photo crew. Everyone shoots, every photo finds the people in it, and each guest goes home with their own gallery — plus a personal video reel set to music. The candid wedding moments one photographer can’t be everywhere for, delivered to everyone. Philippines-first.';
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/papic' },
  keywords: [
    'wedding photo sharing Philippines',
    'guest photo gallery',
    'wedding photo app',
    'QR wedding photos',
    'shared wedding gallery',
    'wedding video reel',
    'candid wedding photos',
    'Papic',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/papic',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Papic — guest photo gallery for weddings' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// SoftwareApplication JSON-LD — names the moat for AI answer engines. No price
// (admin-managed + provisional); publisher references the site-wide Organization
// (@id in app/layout.tsx).
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Papic — Guest Photo Gallery',
  url: `${SITE_URL}/papic`,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'Guests become the photo crew — everyone contributes',
    'Every photo automatically finds the people in it',
    'Each guest gets their own personal gallery',
    'Personal souvenir video reels set to music',
    '5-second candid clips, not just photos',
    'Lives on the couple’s own wedding website',
    'The couple receives every photo, tagged or not',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'Do my guests need to download an app?',
    a: 'No. Guests open a link or scan a QR code at the reception — their gallery and reel work right in the browser, no install and no account needed.',
  },
  {
    q: 'How does each guest get their own photos?',
    a: 'Papic recognises faces, so every photo a guest appears in is gathered into their personal gallery automatically. No one has to scroll through thousands of photos to find themselves.',
  },
  {
    q: 'Isn’t this just a shared photo album?',
    a: 'No. A shared album is one big pile everyone digs through. Papic gives each guest their own tagged gallery and a personal video reel — and you, the couple, still receive every single photo, tagged or not.',
  },
  {
    q: 'What is a personal reel?',
    a: 'A short, vertical souvenir video. A guest picks a few favourite moments and Papic renders a polished reel set to music, ready to share — no editing skills required.',
  },
  {
    q: 'Who takes the photos?',
    a: 'Your choice. A handful of designated friends or family can be your crew (Papic 5 Seats), or every guest can capture their own night (Papic Guest — like handing each table a digital disposable camera).',
  },
  {
    q: 'Will we get all the photos?',
    a: 'Always. Every photo lands in your gallery in full quality, whether or not it was tagged. That is a promise — no moment is left behind.',
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
    t: 'Your guests become the crew',
    d: 'Designated friends and family — or every guest — shoot all night from their own phones. The candids, the laughter, the dance floor: the moments one photographer can never be everywhere for.',
  },
  {
    t: 'Every photo finds its people',
    d: 'As photos come in, Papic recognises faces and sorts each one to the guests in it — automatically, in real time. No tagging marathon, no lost photos.',
  },
  {
    t: 'Everyone goes home with theirs',
    d: 'Each guest gets their own gallery and can render a personal souvenir reel set to music. And you, the couple, receive every single photo — tagged or not.',
  },
];

const VS = [
  ['A shared link everyone digs through', 'Each guest’s own gallery, sorted by face'],
  ['Photos only', 'Photos and 5-second candid clips'],
  ['You scroll to find yourself', 'Your photos find you'],
  ['A separate site that expires', 'Lives on your own wedding website'],
  ['Some moments get lost', 'The couple receives every photo, guaranteed'],
];

export default function PapicLandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:pt-14">
        {/* Hero — text-led; the line-reveal headline + quiet rise are the only
            motion here, so the step-02 sort stays the page's one spectacle. */}
        <header className="mx-auto max-w-2xl text-center">
          <LineRevealHeading
            as="h1"
            trigger="mount"
            className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[var(--m-ink)] sm:text-5xl"
          >
            Every guest goes home with their own photos.
          </LineRevealHeading>
          <RevealBand stagger={0.08} y={14}>
            <p data-reveal-item className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
              Papic turns your guests into your photo crew. Everyone shoots, every photo finds the people in it, and each
              guest gets their own gallery — plus a personal video reel. The candids your photographer can’t be everywhere
              for, delivered to everyone.
            </p>
            <div data-reveal-item className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/onboarding/wedding?from=papic"
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

        {/* How it works — the SECTION is the one PanelThread panel; step 02 hosts
            the signature tile-settle (its own useSettle ref, scoped separately
            from this panel root so the two IO entrances don't double-fire). */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="How Papic works">
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
                  {/* Step 02 · "Every photo finds its people" → the tile sort. */}
                  {i === 1 ? <SettleTiles /> : null}
                </li>
              ))}
            </ol>
          </HowItWorksPanel>
        </section>

        {/* Not a photo wall — the differentiator. Rows rise in a quiet ~60ms
            stagger; the strikethroughs are NOT animated. */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="What makes Papic different">
          <LineRevealHeading className="text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
            Not a shared photo dump
          </LineRevealHeading>
          <p className="mx-auto mt-3 max-w-xl text-center text-base text-[#5F5E5A]">
            A photo wall gives everyone one pile to scroll. Papic gives each guest their own night back.
          </p>
          <RevealList
            className="mt-7 overflow-hidden rounded-2xl border border-[var(--m-ink)]/10"
            stagger={0.06}
            y={12}
          >
            {VS.map(([wall, papic], i) => (
              <li
                key={papic}
                data-reveal-item
                className={`grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-6 ${i % 2 ? 'bg-white/40' : 'bg-white/70'}`}
              >
                <span className="text-sm text-[#9A8F86] line-through decoration-[#9A8F86]/40">{wall}</span>
                <span className="text-sm font-medium text-[var(--m-ink)]">{papic}</span>
              </li>
            ))}
          </RevealList>
        </section>

        {/* Two ways to run it — paired stagger-rise; clearProps:transform keeps
            any CSS hover-lift alive. */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="Two ways to use Papic">
          <LineRevealHeading className="text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
            Two ways to run it
          </LineRevealHeading>
          <RevealBand className="mt-7 grid gap-6 sm:grid-cols-2" stagger={0.08}>
            <div data-reveal-item className="rounded-2xl border border-[var(--m-ink)]/10 bg-white/60 p-6">
              <h3 className="font-serif text-lg text-[var(--m-ink)]">Papic 5 Seats</h3>
              <p className="mt-2 text-sm text-[#5F5E5A]">
                A handful of designated friends or family become your candid crew — so the rest of your guests can put
                their phones down and just be there. They catch the reactions one camera can’t.
              </p>
            </div>
            <div data-reveal-item className="rounded-2xl border border-[var(--m-ink)]/10 bg-white/60 p-6">
              <h3 className="font-serif text-lg text-[var(--m-ink)]">Papic Guest</h3>
              <p className="mt-2 text-sm text-[#5F5E5A]">
                Every guest gets their own capture — like handing each table a digital disposable camera. The whole room
                shares its view of the night, and everyone keeps their own.
              </p>
            </div>
          </RevealBand>
        </section>

        {/* FAQ (backs the FAQPage schema) — incidental zero-dep fade-up. */}
        <section className="mx-auto mt-16 max-w-2xl" aria-label="Papic questions">
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

        {/* CTA — incidental fade; gold capped to a single --m-orange hairline
            border (no glow, no new gold fill). */}
        <Reveal>
          <section className="mx-auto mt-14 max-w-2xl rounded-3xl border border-[var(--m-orange)]/40 bg-[#FBF6EA] px-6 py-10 text-center">
            <h2 className="font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">Give every guest the photos</h2>
            <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
              Papic lives inside your free Setnayan wedding — alongside your guest list, RSVP, seating, and website. Start
              planning free, and add Papic when you’re ready.
            </p>
            <Link
              href="/onboarding/wedding?from=papic"
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
