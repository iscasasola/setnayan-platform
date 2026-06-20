/**
 * /why-setnayan — public comparison / "how Setnayan is different" page
 * (www.setnayan.com/why-setnayan).
 *
 * The GEO/SEO surface for the differentiation frame that, before this, only
 * lived in llms.txt. Part of the 2026-06-20 "lead with the media layer" pass.
 *
 * GUARDRAILS:
 *  - Non-disparaging + truthful: frames the moat as "three apps' worth in one"
 *    (planning app + photo app + vendor directory), NOT a competitor scorecard.
 *    Names NO competitor and makes no blanket claim about a named rival
 *    (public-surface hygiene + legal safety).
 *  - Benefits only; no hardcoded prices (0% commission + free-to-plan are stated
 *    facts, not SKU amounts — those live on /pricing).
 *
 * Server component, statically rendered. Registered in NAV_ROUTES. /monogram
 * design pattern.
 */

import Link from 'next/link';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';

export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Why Setnayan — three apps’ worth of wedding, in one · Setnayan';
const PAGE_DESCRIPTION =
  'To get what Setnayan does, you’d normally juggle three things: a planning app, a separate guest photo app, and a vendor directory — none of which talk to each other. Setnayan brings them together, free to start, and adds what none of them have: a live per-guest photo gallery, personal video reels, and an AI that finds your vendors. Filipino-first, 0% commission.';
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/why-setnayan' },
  keywords: [
    'wedding planning app Philippines',
    'best wedding app Philippines',
    'all-in-one wedding platform',
    'free wedding planning Philippines',
    'wedding app comparison',
    'Filipino wedding planner',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/why-setnayan',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Why Setnayan — three apps’ worth of wedding, in one' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const FAQ = [
  {
    q: 'How is Setnayan different from other wedding apps?',
    a: 'Most tools do one job — planning, or photo-sharing, or a vendor list. Setnayan does all three in one place, free to start, and adds what the others don’t have: a live per-guest photo gallery, personal video reels, and an AI that finds the vendors that fit you.',
  },
  {
    q: 'Do I need a separate app for guest photos?',
    a: 'No — that’s the point. A standalone photo app gives everyone one shared pile that expires. Setnayan’s Papic gives each guest their own face-tagged gallery and a personal reel, right on your wedding site, and you keep every photo.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes — the planning is free to start: guest list, RSVP, seating, budget, and a 4-in-1 wedding website. You only pay for the premium experiences (like Papic or Setnayan AI) if and when you want them.',
  },
  {
    q: 'Does it work for Filipino weddings specifically?',
    a: 'Setnayan is built Philippines-first — it understands Filipino customs, ceremony types, and local vendors, and books at 0% commission. It’s not a generic planner with a PHP price tag bolted on.',
  },
  {
    q: 'What does Setnayan bring that I can’t get elsewhere?',
    a: 'The media layer: every guest goes home with their own photos and a souvenir reel, and an AI shortlist of vendors that actually fit — woven into the same free platform that handles your whole plan.',
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

const PAGE_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: PAGE_TITLE,
  url: `${SITE_URL}/why-setnayan`,
  description: PAGE_DESCRIPTION,
  about: { '@id': `${SITE_URL}/#organization` },
  isPartOf: { '@id': `${SITE_URL}/#website` },
  inLanguage: 'en-PH',
};

const JUGGLE = [
  {
    label: 'A planning app',
    line: 'Guest list, budget, seating — but no live guest gallery, and no AI that finds your vendors.',
  },
  {
    label: 'A photo-sharing app',
    line: 'One shared pile of photos that expires in weeks — no per-guest galleries, no reels, and nothing to do with your plan.',
  },
  {
    label: 'A vendor directory',
    line: 'A list to scroll through yourself — no matching, and rarely 0% commission.',
  },
];

const BRINGS = [
  ['All your planning, free', 'Guest list, RSVP, seating, budget, and a 4-in-1 wedding website — free to start.'],
  ['A live guest photo gallery', 'Papic: every guest gets their own face-tagged photos and a personal video reel.'],
  ['An AI that finds your vendors', 'Setnayan AI ranks a shortlist that fits your style, budget, and date — not a thousand listings.'],
  ['0% commission, Filipino-first', 'Built for Filipino weddings and customs; book your vendors at zero commission, always.'],
];

export default function WhySetnayanPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(PAGE_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:pt-14">
        {/* Hero */}
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8C6932]">Why Setnayan</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[#1E2229] sm:text-5xl">
            Three apps&rsquo; worth of wedding, in one.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
            To do what Setnayan does, you&rsquo;d normally juggle a planning app, a separate guest-photo app, and a
            vendor directory — none of which talk to each other. Setnayan brings them together, free to start, and adds
            what none of them have.
          </p>
        </header>

        {/* What you'd otherwise juggle */}
        <section className="mx-auto mt-16 max-w-4xl" aria-label="What you would otherwise juggle">
          <h2 className="text-center font-serif text-2xl text-[#1E2229] sm:text-3xl">What you&rsquo;d otherwise juggle</h2>
          <div className="mt-7 grid gap-6 sm:grid-cols-3">
            {JUGGLE.map((j) => (
              <div key={j.label} className="rounded-2xl border border-[#1E2229]/10 bg-white/50 p-5">
                <h3 className="font-serif text-lg text-[#9A8F86]">{j.label}</h3>
                <p className="mt-2 text-sm text-[#5F5E5A]">{j.line}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-5 max-w-xl text-center text-sm text-[#8C6932]">
            Three logins, three bills, and nothing that remembers your wedding once it&rsquo;s over.
          </p>
        </section>

        {/* What Setnayan brings together */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="What Setnayan brings together">
          <h2 className="text-center font-serif text-2xl text-[#1E2229] sm:text-3xl">What Setnayan brings together</h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            {BRINGS.map(([title, line]) => (
              <div key={title} className="rounded-2xl border border-[#C5A059]/30 bg-[#FBF8F1] p-6">
                <h3 className="font-serif text-lg text-[#1E2229]">{title}</h3>
                <p className="mt-2 text-sm text-[#5F5E5A]">{line}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The part no one else has */}
        <section className="mx-auto mt-16 max-w-2xl text-center" aria-label="The part no one else has">
          <h2 className="font-serif text-2xl text-[#1E2229] sm:text-3xl">The part no one else has</h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-[#5F5E5A]">
            Every guest goes home with their own photos and a souvenir reel, and an AI shortlist of vendors that
            actually fit — woven into the same free platform that handles your whole plan. That combination doesn&rsquo;t
            exist anywhere else.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/papic"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#1E2229]/20 px-5 py-2.5 text-sm font-medium text-[#1E2229] transition-colors hover:bg-[#1E2229]/[0.04]"
            >
              Explore Papic
            </Link>
            <Link
              href="/setnayan-ai"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#1E2229]/20 px-5 py-2.5 text-sm font-medium text-[#1E2229] transition-colors hover:bg-[#1E2229]/[0.04]"
            >
              Explore Setnayan AI
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-16 max-w-2xl" aria-label="Why Setnayan questions">
          <h2 className="text-center font-serif text-2xl text-[#1E2229] sm:text-3xl">Questions, answered</h2>
          <dl className="mt-7 divide-y divide-[#1E2229]/10 border-y border-[#1E2229]/10">
            {FAQ.map((f) => (
              <div key={f.q} className="py-5">
                <dt className="font-serif text-base text-[#1E2229]">{f.q}</dt>
                <dd className="mt-1.5 text-sm text-[#5F5E5A]">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* CTA */}
        <section className="mx-auto mt-14 max-w-2xl rounded-3xl border border-[#C5A059]/40 bg-[#FBF6EA] px-6 py-10 text-center">
          <h2 className="font-serif text-2xl text-[#1E2229] sm:text-3xl">One place for all of it</h2>
          <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
            Your plan, your vendors, and your memories — together, free to start. Set na &rsquo;yan.
          </p>
          <Link
            href="/onboarding/wedding?from=why-setnayan"
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#5C2542] px-7 py-3 text-sm font-semibold text-[#FBFBFA] transition-opacity hover:opacity-90"
          >
            Start planning · free
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
