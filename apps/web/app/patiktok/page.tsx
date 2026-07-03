/**
 * /patiktok — public marketing landing page for Patiktok, the short-form
 * highlight reels from the wedding day (www.setnayan.com/patiktok).
 *
 * Part of the "Pa-" public-surface wave (owner-approved 2026-06-27; Pa- naming
 * LOCKED). Mirrors the /papic + /setnayan-ai pattern exactly: force-static
 * Server Component, static `metadata`, SoftwareApplication + FAQPage JSON-LD,
 * hero + benefit sections + FAQ + a Mulberry-accent primary CTA, and the shared
 * SiteFooter. The persistent SiteChrome nav renders because '/patiktok' is
 * registered in NAV_ROUTES.
 *
 * POSITIONING: short, vertical highlight reels of your day, ready to share —
 * the moments that travel, made the moment they happen. Music is Setnayan-owned
 * (never named, never implied to be major-label). Sell the BENEFIT (shareable
 * reels, no editing) and quote NO price (admin-managed + provisional — links to
 * /pricing). Copy sells BENEFITS only (public-surface hygiene).
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

const PAGE_TITLE = 'Patiktok — Short-Form Highlight Reels From Your Day · Setnayan';
const PAGE_DESCRIPTION =
  'Patiktok turns your wedding moments into short, vertical highlight reels — set to music, ready to share, no editing required. The first dance, the entrance, the toast: the moments that travel, made the moment they happen.';
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/patiktok' },
  keywords: [
    'wedding highlight reel',
    'short wedding video',
    'vertical wedding reel',
    'wedding video for social',
    'wedding reel maker Philippines',
    'shareable wedding video',
    'Patiktok',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/patiktok',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Patiktok — short-form highlight reels from your day' }],
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
  name: 'Patiktok — Short-Form Wedding Reels',
  url: `${SITE_URL}/patiktok`,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'Turns your wedding moments into short, vertical reels',
    'Set to music, ready to share — no editing skills needed',
    'The moments that travel, made the moment they happen',
    'Pick your favourite beats and a reel composes itself',
    'Perfect for sharing the day with everyone, fast',
    'Lives alongside your gallery and wedding website',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'What is a Patiktok reel?',
    a: 'A short, vertical highlight video of your day — the entrance, the first dance, the toast — set to music and ready to share. The kind of clip made to fly around your group chats the same night.',
  },
  {
    q: 'Do I need to edit anything?',
    a: 'No. You pick the moments you love and a polished reel composes itself, music and all. No timeline, no editing app, no skills required.',
  },
  {
    q: 'Where do the clips come from?',
    a: 'From your wedding — the photos and short clips captured on the day. Patiktok pulls your favourite moments together into something shareable, right inside Setnayan.',
  },
  {
    q: 'What about the music?',
    a: 'Every reel is set to music that’s cleared for sharing, so you can post it anywhere without worry — no surprise takedowns, no licensing headaches.',
  },
  {
    q: 'Does this replace our wedding film?',
    a: 'No. Your videographer still makes the keepsake film. Patiktok is the fast, shareable version — the highlights that go out the same night while the big film takes its time.',
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
    t: 'The day gets captured',
    d: 'Photos and short clips from your wedding gather inside Setnayan — the entrance, the dance floor, the toast, the laughter.',
  },
  {
    t: 'Pick your moments',
    d: 'Choose the beats you love most. A short, vertical reel composes itself around them, set to music — no editing, no timeline, no skills needed.',
  },
  {
    t: 'Share it the same night',
    d: 'Out it goes — to the group chat, to your stories, to everyone who wants to relive the day. The highlights travel while the big film takes its time.',
  },
];

const VS = [
  ['Wait weeks for the final film', 'Highlights ready the same night'],
  ['Edit it yourself in an app', 'A reel composes itself'],
  ['Music you can’t safely post', 'Set to music cleared to share'],
  ['One long video few rewatch', 'Short reels made to fly around'],
];

export default function PatiktokLandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:pt-14">
        {/* Hero */}
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8C6932]">In your wedding · highlight reels</p>
          <LineRevealHeading
            as="h1"
            trigger="mount"
            className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[var(--m-ink)] sm:text-5xl"
          >
            The moments that travel, ready the same night.
          </LineRevealHeading>
          <RevealBand stagger={0.08} y={14}>
            <p data-reveal-item className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
              Patiktok turns your wedding moments into short, vertical highlight reels — set to music, ready to share,
              no editing required. The entrance, the first dance, the toast: made the moment they happen.
            </p>
            <div data-reveal-item className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/onboarding/wedding?from=patiktok"
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
        <section className="mx-auto mt-16 max-w-3xl" aria-label="How Patiktok works">
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
        <section className="mx-auto mt-16 max-w-3xl" aria-label="What makes Patiktok different">
          <LineRevealHeading className="text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
            Made to be shared
          </LineRevealHeading>
          <p className="mx-auto mt-3 max-w-xl text-center text-base text-[#5F5E5A]">
            The keepsake film is for keeping. Patiktok is for sharing — fast, vertical, and ready the same night.
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
        <section className="mx-auto mt-16 max-w-2xl" aria-label="Patiktok questions">
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
            <h2 className="font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">Share the day, the day it happens</h2>
            <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
              Patiktok lives inside your free Setnayan wedding — alongside your gallery, website, and guest list. Start
              planning free, and add your highlight reels when you’re ready.
            </p>
            <Link
              href="/onboarding/wedding?from=patiktok"
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
