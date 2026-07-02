/**
 * /setnayan-ai — public marketing landing page for Setnayan AI, the planning
 * intelligence (www.setnayan.com/setnayan-ai).
 *
 * Part of the "lead with the media layer" public-surface pass (2026-06-20
 * demand-research verdict). Setnayan AI is the second proven differentiator
 * incumbents lack, and it had no indexable, citable landing page.
 *
 * ACCURACY GUARDRAIL (locked "Setnayan AI definition" + GTM content framework,
 * Setnayan_AI_GTM_Content_2026-07-02): it is a DETERMINISTIC matchmaking +
 * MONITORING + planning layer, NOT an LLM chatbot. Copy leads with "it watches /
 * keeps an eye on / flags" (the monitoring-engine positioning) plus "finds your
 * fit / a shortlist", and frames the difference as "a chatbot waits, this
 * watches" — never as a "conversation / generative" tool. HONESTY: only SHIPPED
 * features appear as live — the personalization ("learns your taste") and cohort
 * ("couples like you") layers are DORMANT (privacy sign-off pending) and may
 * appear ONLY in a future-tense "coming" line, never in the live feature list.
 *
 * Server component, statically rendered. Persistent SiteChrome nav renders
 * because '/setnayan-ai' is registered in NAV_ROUTES. Copy sells BENEFITS only
 * (public-surface hygiene) and quotes NO price (admin-managed + provisional —
 * links to /pricing). Framing per the locked free-vs-AI boundary: the planning
 * tools are free; Setnayan AI is the upgrade that does the finding for you.
 */

import { SiteFooter } from '@/app/features/_sections/_SiteFooter';
// Client motion island (the page itself stays a force-static Server Component;
// metadata + both JSON-LD scripts live here in the server file). The island
// renders the hero so the serif line-reveal ref sits on the real <h1>, and wraps
// the below-fold sections with the shared premium primitives. Additive-only: no
// copy / route / IA / CTA / metadata / JSON-LD change.
import {
  SetnayanAiHero,
  HowItWorks,
  Matchmaking,
  RevealBlock,
  CtaPanel,
} from './_setnayan-ai-motion';

export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Setnayan AI — the planner that watches your wedding for you · Setnayan';
const PAGE_DESCRIPTION =
  'Every other wedding AI waits for you to ask. Setnayan AI watches the vendors you’re eyeing and the ones you’ve booked — finding your best-fit Filipino vendors, then flagging a deposit due, a price that moved, or a date about to clash before it costs you. It doesn’t chat. It watches.';
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
    'Watches the vendors you shortlist and book — for price changes, availability and risk',
    'Finds and ranks verified vendors that fit your style, budget, date and guest count',
    'Guards your deadlines — deposits, contracts, and PH paperwork (marriage license, Pre-Cana, PSA)',
    'Flags a price hike, a double-booking, or an unverified vendor before it costs you',
    'Chases quiet vendors and lines up their quotes for you',
    'One calm weekly digest — it earns the interruption, never spams',
    'The planning tools stay free — Setnayan AI is the paid brain on top',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'Is Setnayan AI a chatbot?',
    a: 'No — that’s the whole point. A chatbot waits for you to ask. Setnayan AI watches your vendors and your dates in the background and taps you only when something needs you: a deposit due, a price that moved, a date about to clash.',
  },
  {
    q: 'Do I have to use it?',
    a: 'Never. All the planning tools — guest list, RSVP, seating, budget, your wedding website — are free and work on their own. Setnayan AI is the paid upgrade that does the finding and the watching for you.',
  },
  {
    q: 'What exactly does it watch?',
    a: 'The vendors you’re eyeing and the ones you’ve booked — for price changes, availability and reliability — plus your budget and your deadlines (including your marriage license, Pre-Cana and PSA windows). It also finds and ranks your best-fit verified vendors, chases the quiet ones, and lines up their quotes.',
  },
  {
    q: 'Will it spam me?',
    a: 'No. It’s built to earn the interruption. Most weeks it’s quiet and gathers what matters into one calm weekly digest; it speaks up only when something genuinely can’t wait. No fake countdowns, no manufactured panic.',
  },
  {
    q: 'Does it learn my taste or compare me to other couples?',
    a: 'Those personalized and “couples like you” insights are coming, once our privacy sign-off is complete. Today Setnayan AI focuses on what’s live: finding your fit, guarding your money and deadlines, and reassuring you with real evidence.',
  },
  {
    q: 'Is my information private?',
    a: 'Yes. Your details are used to find your fit and watch your back, never sold. Setnayan runs on a privacy-first model under the Philippine Data Privacy Act (RA 10173).',
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
    t: 'It finds your fit — then keeps watching',
    d: 'It ranks a shortlist of verified vendors that actually match — by style, budget, availability, and place — then keeps an eye on them and the market: prices, availability, and your date.',
  },
  {
    t: 'It taps you before anything slips',
    d: 'A deposit due, a price that moved, a double-booking, a paperwork deadline — it flags them early, while there’s still time to act calmly. Most weeks, it stays quiet.',
  },
];

const VS = [
  ['A chatbot you have to remember to go ask', 'An assistant that watches and taps you'],
  ['Finds vendors once, then forgets them', 'Keeps an eye on them — price, availability, dates'],
  ['You track every deposit and deadline yourself', 'It flags a deposit or clash before it bites'],
  ['Generic, one-size-fits-all', 'Tuned to Filipino weddings, your fit'],
];

export default function SetnayanAiLandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:pt-14">
        {/* Hero — the signature self-composing line-reveal lives in the client
            island so the ref sits on the real <h1>; eyebrow / subcopy / CTAs
            settle in one quiet beat after. Copy / CTAs verbatim. */}
        <SetnayanAiHero />

        {/* How it works — the one PanelThread section (champagne stitch + quiet
            card rise). 01/02/03 numerals + hover-lift preserved. */}
        <HowItWorks steps={STEPS} />

        {/* Not a generic chatbot — staggered row-rise only (no morph/collapse;
            the static struck-through → affirmed contrast carries the idea). */}
        <Matchmaking rows={VS} />

        {/* FAQ (backs the FAQPage schema) — one incidental whole-block fade, no
            per-row stagger (scannable reference). */}
        <section className="mx-auto mt-16 max-w-2xl" aria-label="Setnayan AI questions">
          <h2 className="text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">Questions, answered</h2>
          <RevealBlock>
            <dl className="mt-7 divide-y divide-[var(--m-ink)]/10 border-y border-[var(--m-ink)]/10">
              {FAQ.map((f) => (
                <div key={f.q} className="py-5">
                  <dt className="font-serif text-base text-[var(--m-ink)]">{f.q}</dt>
                  <dd className="mt-1.5 text-sm text-[#5F5E5A]">{f.a}</dd>
                </div>
              ))}
            </dl>
          </RevealBlock>
        </section>

        {/* CTA — headline line-reveal + button rise; gold stays a hairline
            border on cream (no fill / no glow). */}
        <CtaPanel />
      </main>
      <SiteFooter />
    </>
  );
}
