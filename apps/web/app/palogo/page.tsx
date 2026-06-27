/**
 * /palogo — public marketing landing page for Palogo, the animated monogram
 * (the Animated Monogram) carried across the whole wedding
 * (www.setnayan.com/palogo).
 *
 * Part of the "Pa-" public-surface wave (owner-approved 2026-06-27; Pa- naming
 * LOCKED). Mirrors the /papic + /setnayan-ai pattern exactly: force-static
 * Server Component, static `metadata`, SoftwareApplication + FAQPage JSON-LD,
 * hero + benefit sections + FAQ + a Mulberry-accent primary CTA, and the shared
 * SiteFooter. The persistent SiteChrome nav renders because '/palogo' is
 * registered in NAV_ROUTES.
 *
 * ACCURACY GUARDRAIL (locked "AI-content disclosure" + public-surface hygiene):
 * the underlying image model is NEVER named — the brand-facing name is the
 * Animated Monogram. Sell the BENEFIT (one mark, your initials, alive across
 * everything) and quote NO price (admin-managed + provisional — links to
 * /pricing). A free no-signup monogram preview already lives at /monogram, so
 * the secondary CTA points there.
 */

import Link from 'next/link';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';
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

const PAGE_TITLE = 'Palogo — Your Animated Wedding Monogram · Setnayan';
const PAGE_DESCRIPTION =
  'Palogo gives your wedding one mark of its own — your initials, drawn into a monogram that comes alive. It opens your save-the-date, signs your website, glows on the screen at the reception, and closes every video. One signature, carried beautifully across your whole day.';
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/palogo' },
  keywords: [
    'wedding monogram',
    'animated wedding logo',
    'custom wedding monogram Philippines',
    'wedding initials design',
    'monogram for wedding website',
    'animated monogram',
    'Palogo',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/palogo',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Palogo — your animated wedding monogram' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// SoftwareApplication JSON-LD — no model name, no price (admin-managed +
// provisional); publisher references the site-wide Organization.
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Palogo — Animated Wedding Monogram',
  url: `${SITE_URL}/palogo`,
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'A custom monogram drawn from your initials',
    'Animated — your mark comes alive, not just a static logo',
    'Carries across your save-the-date, website, reception screens, and videos',
    'Refine it until it feels like yours',
    'Tuned to your wedding’s colours and feel',
    'One signature for the whole day',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'What exactly do I get?',
    a: 'A monogram of your own — your initials drawn into a single mark, with a short animation that brings it to life. It becomes the signature of your whole wedding, the same way a brand has its logo.',
  },
  {
    q: 'Where does it show up?',
    a: 'Everywhere that matters. It opens your save-the-date, signs your wedding website, glows on the screen at the reception, marks your signage, and closes every Setnayan video you make for the day.',
  },
  {
    q: 'Can I make it look the way I want?',
    a: 'Yes. You describe the feel you’re after and refine it until it’s right — no design skills needed. It’s shaped around your initials, your colours, and your wedding’s mood.',
  },
  {
    q: 'Is it really animated, or just an image?',
    a: 'Both. You get the still mark for print and small spaces, and a living version that draws itself in for screens, your website, and your videos.',
  },
  {
    q: 'Can I try one first?',
    a: 'Yes — you can preview a monogram for your initials free, no sign-up, before you decide. The animated version that follows you across the whole wedding is the upgrade.',
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
    t: 'Start from your initials',
    d: 'Tell Setnayan your initials and the feel you’re after — classic, modern, playful, grand. Your mark begins to take shape around the two of you.',
  },
  {
    t: 'Refine it until it’s yours',
    d: 'Nudge the look until it’s exactly right — no design skills required. When it clicks, it becomes the signature of your whole wedding.',
  },
  {
    t: 'It follows you everywhere',
    d: 'Your monogram opens your save-the-date, signs your website, glows at the reception, and closes every video — one mark, carried beautifully across the day.',
  },
];

const VS = [
  ['A stock template everyone uses', 'A mark drawn from your initials'],
  ['A flat, static logo', 'A monogram that comes alive'],
  ['Different look on every piece', 'One signature across the day'],
  ['Stuck on the invite only', 'On screens, website, and videos too'],
];

export default function PalogoLandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:pt-14">
        {/* Hero */}
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8C6932]">In your wedding · animated monogram</p>
          <LineRevealHeading
            as="h1"
            trigger="mount"
            className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[var(--m-ink)] sm:text-5xl"
          >
            One mark, alive across your whole wedding.
          </LineRevealHeading>
          <RevealBand stagger={0.08} y={14}>
            <p data-reveal-item className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
              Palogo gives your wedding a signature of its own — your initials, drawn into a monogram that comes alive.
              It opens your save-the-date, signs your website, glows at the reception, and closes every video.
            </p>
            <div data-reveal-item className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/onboarding/wedding?from=palogo"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[var(--m-mulberry)] px-7 py-3 text-sm font-semibold text-[var(--m-paper)] transition-opacity hover:opacity-90"
              >
                Start planning · free
              </Link>
              <Link
                href="/monogram"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[var(--m-ink)]/20 px-7 py-3 text-sm font-semibold text-[var(--m-ink)] transition-colors hover:bg-[var(--m-ink)]/[0.04]"
              >
                Preview yours · free
              </Link>
            </div>
          </RevealBand>
        </header>

        {/* How it works — the one PanelThread panel. */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="How Palogo works">
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
        <section className="mx-auto mt-16 max-w-3xl" aria-label="What makes Palogo different">
          <LineRevealHeading className="text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
            Not a clip-art logo
          </LineRevealHeading>
          <p className="mx-auto mt-3 max-w-xl text-center text-base text-[#5F5E5A]">
            A template looks like everyone else’s. Palogo looks like you — and it moves.
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
        <section className="mx-auto mt-16 max-w-2xl" aria-label="Palogo questions">
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
            <h2 className="font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">Give your wedding its signature</h2>
            <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
              Palogo lives inside your free Setnayan wedding — alongside your save-the-date, website, and videos. Start
              planning free, and add your animated monogram when you’re ready.
            </p>
            <Link
              href="/onboarding/wedding?from=palogo"
              className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[var(--m-mulberry)] px-7 py-3 text-sm font-semibold text-[var(--m-paper)] transition-opacity hover:opacity-90"
            >
              Start planning · free
            </Link>
          </section>
        </Reveal>
      </main>
      <SiteFooter />
    </>
  );
}
