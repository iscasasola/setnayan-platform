/**
 * /pa3d — public marketing landing page for Pa3D, the 3D reception-walkthrough
 * experience (www.setnayan.com/pa3d).
 *
 * Part of the "Pa-" public-surface wave (owner-approved 2026-06-27; Pa- naming
 * LOCKED). Mirrors the /papic + /setnayan-ai pattern exactly: force-static
 * Server Component, static `metadata`, SoftwareApplication + FAQPage JSON-LD,
 * hero + benefit sections + FAQ + a Mulberry-accent primary CTA, and the shared
 * SiteFooter. The persistent SiteChrome nav renders because '/pa3d' is
 * registered in NAV_ROUTES.
 *
 * POSITIONING (locked "seat plan stays free" + "3D seat-plan roadmap"): the 2D
 * seating plan is FREE and complete on its own; Pa3D is the premium tier that
 * lets a couple walk their reception in 3D before the day. Sell the value, not
 * the price (admin-managed + provisional — links to /pricing). Copy sells
 * BENEFITS only (public-surface hygiene).
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

const PAGE_TITLE = 'Pa3D — Walk Your Reception in 3D Before the Day · Setnayan';
const PAGE_DESCRIPTION =
  'Pa3D lets you stand in your reception before it’s built. See the room the way your guests will — the head table, the dance floor, every seat — and know it’s right while there’s still time to change it. The free seating plan gets you there; Pa3D lets you walk it.';
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/pa3d' },
  keywords: [
    '3D wedding seating plan',
    'wedding reception 3D',
    'visualize wedding reception',
    'wedding floor plan tool',
    '3D table layout wedding',
    'wedding seating chart Philippines',
    'Pa3D',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/pa3d',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Pa3D — walk your reception in 3D before the day' }],
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
  name: 'Pa3D — 3D Reception Walkthrough',
  url: `${SITE_URL}/pa3d`,
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'Walk your reception in 3D before the day',
    'See the room the way your guests will',
    'Built on your seating plan — no extra setup',
    'Catch a tight aisle or a blocked view in time to fix it',
    'Share the walkthrough with your coordinator and family',
    'The 2D seating plan stays free; the 3D walk is the upgrade',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'Do I need to build the room from scratch?',
    a: 'No. Pa3D builds on the seating plan you already make in Setnayan — your tables, your head table, your dance floor. Switch to the 3D view and your plan stands up into a room you can walk.',
  },
  {
    q: 'Isn’t the seating plan enough on its own?',
    a: 'The seating plan is free and complete — you can run your whole wedding on it. Pa3D is for when you want to feel the room before it’s real: how close the tables sit, what the lola at table 3 actually sees, whether the aisle has space to breathe.',
  },
  {
    q: 'What can I catch with it?',
    a: 'The things a flat chart hides — a sightline blocked by a pillar, a path too tight for the gown, a head table that reads smaller than you pictured. You see it while there’s still time to move things.',
  },
  {
    q: 'Can I show it to other people?',
    a: 'Yes. Walk your coordinator, your family, or your stylist through the exact room, so everyone pictures the same day before it arrives.',
  },
  {
    q: 'Does my guest need anything special to view it?',
    a: 'No special device and no install — it runs right in the browser. You explore on the same phone or laptop you plan everything else on.',
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
    t: 'Plan your tables — free',
    d: 'Lay out your reception in Setnayan’s seating plan: your tables, your head table, your dance floor, every guest in a seat. The whole tool is free.',
  },
  {
    t: 'Stand up the room',
    d: 'Switch to Pa3D and your flat plan rises into a room you can walk. See the space the way your guests will, from any seat in the house.',
  },
  {
    t: 'Get it right before the day',
    d: 'Spot the tight aisle, the blocked view, the head table that feels off — and fix it now, while it’s still just a plan. Walk in on the day to exactly what you pictured.',
  },
];

const VS = [
  ['A flat chart from above', 'A room you can stand inside'],
  ['Guess what each guest sees', 'See it from any seat'],
  ['Surprises on the day', 'Fixes while there’s still time'],
  ['Picture it in your head', 'Show everyone the same room'],
];

export default function Pa3DLandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:pt-14">
        {/* Hero */}
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8C6932]">In your wedding · 3D reception</p>
          <LineRevealHeading
            as="h1"
            trigger="mount"
            className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[var(--m-ink)] sm:text-5xl"
          >
            Walk your reception before it’s built.
          </LineRevealHeading>
          <RevealBand stagger={0.08} y={14}>
            <p data-reveal-item className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
              Pa3D lets you stand inside your reception before it’s real. See the room the way your guests will — the
              head table, the dance floor, every seat — and know it’s right while there’s still time to change it.
            </p>
            <div data-reveal-item className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/onboarding/wedding?from=pa3d"
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
        <section className="mx-auto mt-16 max-w-3xl" aria-label="How Pa3D works">
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
        <section className="mx-auto mt-16 max-w-3xl" aria-label="What makes Pa3D different">
          <LineRevealHeading className="text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
            More than a chart
          </LineRevealHeading>
          <p className="mx-auto mt-3 max-w-xl text-center text-base text-[#5F5E5A]">
            The free seating plan tells you who sits where. Pa3D shows you what it actually feels like.
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
        <section className="mx-auto mt-16 max-w-2xl" aria-label="Pa3D questions">
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
            <h2 className="font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">See the room before the day</h2>
            <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
              The seating plan is free inside every Setnayan wedding. Start planning free, lay out your tables, and add
              Pa3D when you want to walk the room.
            </p>
            <Link
              href="/onboarding/wedding?from=pa3d"
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
