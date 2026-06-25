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
