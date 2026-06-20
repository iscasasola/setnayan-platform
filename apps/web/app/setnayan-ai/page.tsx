/**
 * /setnayan-ai — public marketing landing page for Setnayan AI, the planning
 * intelligence (www.setnayan.com/setnayan-ai).
 *
 * Part of the "lead with the media layer" public-surface pass (2026-06-20
 * demand-research verdict). Setnayan AI is the second proven differentiator
 * incumbents lack, and it had no indexable, citable landing page.
 *
 * ACCURACY GUARDRAIL (locked "Setnayan AI definition"): it is a DETERMINISTIC
 * matchmaking + planning layer, NOT an LLM chatbot. Copy must say "finds your
 * fit / matchmaking / a shortlist", never "chatbot / conversation / generative".
 *
 * Server component, statically rendered. Persistent SiteChrome nav renders
 * because '/setnayan-ai' is registered in NAV_ROUTES. Copy sells BENEFITS only
 * (public-surface hygiene) and quotes NO price (admin-managed + provisional —
 * links to /pricing). Framing per the locked free-vs-AI boundary: the planning
 * tools are free; Setnayan AI is the upgrade that does the finding for you.
 */

import Link from 'next/link';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';

export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Setnayan AI — the planner that finds your perfect vendors · Setnayan';
const PAGE_DESCRIPTION =
  'A thousand vendor choices, the same questions over and over. Setnayan AI learns what matters to your wedding — your style, budget, date, and guest count — and finds the verified Filipino vendors that actually fit. Then it builds your plan and keeps it on track. Say it once, find your perfect fit.';
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/setnayan-ai' },
  keywords: [
    'AI wedding planner Philippines',
    'wedding vendor matchmaking',
    'find wedding vendors Philippines',
    'wedding planning assistant',
    'Filipino wedding planner app',
    'Setnayan AI',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/setnayan-ai',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Setnayan AI — the planner that finds your perfect vendors' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// SoftwareApplication JSON-LD — names the moat for AI answer engines. No price
// (admin-managed + provisional). Publisher references the site-wide Organization.
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Setnayan AI — wedding planning intelligence',
  url: `${SITE_URL}/setnayan-ai`,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'Matches you to verified vendors that fit your style, budget, date and guest count',
    'Ranks a shortlist instead of a thousand listings',
    'Tuned to Filipino weddings — faith, event type, and regional pricing',
    'Builds your checklist and timeline',
    'Keeps your plan on track with deadline nudges',
    'The planning tools stay free — the intelligence does the finding',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'Is Setnayan AI a chatbot?',
    a: 'No. It’s matchmaking, not a chat. Tell it about your wedding once and it finds real, verified vendors that fit — you get a ranked shortlist, not a conversation to manage.',
  },
  {
    q: 'Do I have to use it?',
    a: 'Never. All the planning tools — guest list, RSVP, seating, budget, your wedding website — are free and work on their own. Setnayan AI is the upgrade that does the finding and planning for you.',
  },
  {
    q: 'How does it pick vendors?',
    a: 'It weighs what actually matters for a fit: your style and theme, your budget, your date and the vendor’s availability, your location, your guest count, and your event type. It only ever recommends verified Filipino vendors.',
  },
  {
    q: 'What does it plan for me?',
    a: 'It builds your checklist and timeline around your date, surfaces what to book and when, and nudges you before deadlines slip — so nothing important is left to the last minute.',
  },
  {
    q: 'Is my information private?',
    a: 'Yes. Your details are used to find your fit, never sold. Setnayan runs on a privacy-first model under the Philippine Data Privacy Act (RA 10173).',
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
    t: 'Tell it about your wedding — once',
    d: 'Your style, your budget, your date, your guest count, where you’re celebrating. No forms to repeat, no questions asked twice.',
  },
  {
    t: 'It finds your fit',
    d: 'Instead of a thousand listings to sift, Setnayan AI ranks a shortlist of verified vendors that actually match — by style, budget, availability, and place.',
  },
  {
    t: 'It keeps you on track',
    d: 'It builds your checklist and timeline around your date and nudges you before anything important slips. The thinking is done; you decide.',
  },
];

const VS = [
  ['A thousand listings to sift', 'A ranked shortlist that fits you'],
  ['You repeat your details everywhere', 'Say it once'],
  ['Generic, one-size-fits-all', 'Tuned to Filipino weddings'],
  ['You track every deadline yourself', 'It nudges you before they slip'],
];

export default function SetnayanAiLandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:pt-14">
        {/* Hero — echoes the homepage promise, which Setnayan AI is the answer to */}
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8C6932]">Planning intelligence</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[#1E2229] sm:text-5xl">
            Say it once. Find your perfect fit.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
            A thousand vendor choices, the same questions over and over. Setnayan AI learns what matters to your wedding
            and finds the verified Filipino vendors that actually fit — then builds your plan and keeps it on track.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/onboarding/wedding?from=setnayan-ai"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#5C2542] px-7 py-3 text-sm font-semibold text-[#FBFBFA] transition-opacity hover:opacity-90"
            >
              Start planning · free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[#1E2229]/20 px-7 py-3 text-sm font-semibold text-[#1E2229] transition-colors hover:bg-[#1E2229]/[0.04]"
            >
              See pricing
            </Link>
          </div>
        </header>

        {/* How it works */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="How Setnayan AI works">
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.t} className="rounded-2xl border border-[#1E2229]/10 bg-white/60 p-5">
                <span className="font-mono text-xs text-[#8C6932]">{String(i + 1).padStart(2, '0')}</span>
                <h2 className="mt-2 font-serif text-lg text-[#1E2229]">{s.t}</h2>
                <p className="mt-1.5 text-sm text-[#5F5E5A]">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Not a generic chatbot — the differentiator */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="What makes Setnayan AI different">
          <h2 className="text-center font-serif text-2xl text-[#1E2229] sm:text-3xl">Matchmaking, not a chatbot</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-base text-[#5F5E5A]">
            It doesn’t hand you a search box and a thousand results. It does the finding.
          </p>
          <ul className="mt-7 overflow-hidden rounded-2xl border border-[#1E2229]/10">
            {VS.map(([before, after], i) => (
              <li
                key={after}
                className={`grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-6 ${i % 2 ? 'bg-white/40' : 'bg-white/70'}`}
              >
                <span className="text-sm text-[#9A8F86] line-through decoration-[#9A8F86]/40">{before}</span>
                <span className="text-sm font-medium text-[#1E2229]">{after}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ (backs the FAQPage schema) */}
        <section className="mx-auto mt-16 max-w-2xl" aria-label="Setnayan AI questions">
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
          <h2 className="font-serif text-2xl text-[#1E2229] sm:text-3xl">Let it find your fit</h2>
          <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
            Planning on Setnayan is free to start — guest list, RSVP, seating, budget, and your wedding website. Add
            Setnayan AI when you want the finding and planning done for you.
          </p>
          <Link
            href="/onboarding/wedding?from=setnayan-ai"
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
