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
 *
 * ─── PORTED ONTO THE SHARED DOORWAY KIT (design#6) ───────────────────────
 * This page used to carry `_setnayan-ai-motion.tsx`: a private re-implementation
 * of the hero, the how-it-works panel, the differentiator rows and the closing
 * CTA — i.e. the whole archetype, written a second time, differing from the kit
 * only in copy strings. Its spine mapped onto `DoorwayPage` one-for-one, so the
 * fork is deleted rather than kept in step by hand. Every string below is
 * VERBATIM from that file; nothing about this page's words, routes, CTAs,
 * metadata or JSON-LD changed. What changed is that its colours are now the
 * locked tokens, because they arrive from the kit.
 */

import { DoorwayPage, type DoorwayVersus } from '@/app/_components/marketing/_doorway';
import { SpotlightSection, type Spotlight } from '@/app/_components/marketing/_spotlights';
import { studioDescription } from '@/lib/studio-apps';


const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Setnayan AI — the planner that watches your wedding for you · Setnayan';
/** The document title ONLY. `metadata.title` is rendered through the root
 *  layout's `template: '%s · Setnayan'`, so a PAGE_TITLE that already ends in
 *  the brand came out as "… · Setnayan · Setnayan" on 11 live pages. The share
 *  cards and the structured-data name do NOT go through that template and are
 *  correct WITH the brand — which is why this strips it here and nowhere else. */
const DOC_TITLE = PAGE_TITLE.replace(/ · Setnayan$/, '');
/*
 * 🔑 THE DESCRIPTION IS NOT AUTHORED HERE ANY MORE — it is read from
 * `lib/studio-apps.ts`, the ONE place the seven Studio products are
 * described, so this page's search result and the rail's row for it can
 * never disagree about what the product does. The string itself is
 * UNCHANGED (moved verbatim); rewording it would have quietly rewritten a
 * live, indexed search result.
 * ⚠ Do not re-inline it. Two hand-typed strings that must agree is not a
 * mechanism, it is a future drift.
 */
const PAGE_DESCRIPTION = studioDescription('setnayan-ai');
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

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
  title: DOC_TITLE,
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
    a: 'Never. All the planning tools — guest list, RSVP, seating, budget, your Event Hub — are free and work on their own. Setnayan AI is the paid upgrade that does the finding and the watching for you.',
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

const VS: readonly DoorwayVersus[] = [
  ['A chatbot you have to remember to go ask', 'An assistant that watches and taps you'],
  ['Finds vendors once, then forgets them', 'Keeps an eye on them — price, availability, dates'],
  ['You track every deposit and deadline yourself', 'It flags a deposit or clash before it bites'],
  ['Generic, one-size-fits-all', 'Tuned to Filipino weddings, your fit'],
];

/*
 * ─── "24-HOUR SECRETARY" — THE FEATURE SPOTLIGHTS ───────────────────────
 * Owner, 2026-09-05: sell it as *"having a 24 hour secretary to run your
 * errands inside your event"*, in the one-idea · one-picture · one-sentence
 * shape `/papic` already ships (`_components/marketing/_spotlights.tsx`).
 *
 * 🔒 EVERY SENTENCE IS TRACEABLE. Each block is a rewording of copy already on
 * this page, this product's record in `studio-apps.ts`, its demo scenes'
 * captions, or a capability in `setnayan-ai-value-copy.ts` (the in-app,
 * "no fake doors" list) — nothing here is a new claim. Left out on purpose,
 * so nobody adds them back: "chases quiet vendors / lines up quotes" (the
 * value-copy file removed `chase` as never having reached a person); the
 * "3 couples inquired" chip (a number nothing on this page hand-writes);
 * "one calm weekly digest" (no message path behind it); "learns your taste"
 * and "couples like you" (dormant, per the guardrail above); and any Mood
 * Board / colour-recommendation line — there is no shipped link between
 * Setnayan AI and the mood board's palette engine (`lib/palette-styles.ts`
 * is deterministic and unrelated to this product).
 *
 * 📷 The stills are frames of this product's OWN demo scenes (the ones the
 * Studio card plays), captured by `scripts/capture-demo-stills.mjs` — the
 * real UI, not a drawing. The two photographs are our demo celebration.
 */
const SPOTLIGHTS: readonly Spotlight[] = [
  {
    chip: 'One brief',
    t: 'Tell it about your wedding once',
    d: 'Your style, your budget, your date, your guest count, where you’re celebrating. No forms to repeat, no questions asked twice.',
    media: { kind: 'still', src: '/add-ons/demo/stills/setnayan-ai-0.jpg', alt: 'Setnayan AI — stop guessing who to hire' },
  },
  {
    chip: 'Ranked shortlist',
    t: 'Your best vendors, sorted to the top',
    d: 'It turns the whole vendor directory into a shortlist of verified vendors ranked by how well they fit your day — style, budget, availability and place. Your suggested team is picked by best fit, never cheapest first.',
    media: { kind: 'still', src: '/add-ons/demo/stills/setnayan-ai-1.jpg', alt: 'Setnayan AI — your best vendors, sorted to the top' },
  },
  {
    chip: 'Your date',
    t: 'Lock in the right team before it’s gone',
    d: 'Your vendor list marks anyone another couple starts looking at for your date, so you can choose first. And when a vendor you’re considering gets booked — or frees up — you hear it from us, not from a reply three days later.',
    media: { kind: 'still', src: '/add-ons/demo/stills/setnayan-ai-2.jpg', alt: 'Setnayan AI — book the right team before it’s gone' },
  },
  {
    chip: 'Deadlines',
    t: 'It tells you the one next thing',
    d: 'It watches every category’s booking window, and the paperwork a Philippine wedding actually needs — marriage license, Pre-Cana, PSA — then tells you the single most urgent thing to do next, instead of a to-do pile to stare at.',
    media: { kind: 'still', src: '/add-ons/demo/stills/setnayan-ai-3.jpg', alt: 'Setnayan AI — every decision, with deadlines that nudge you' },
  },
  {
    chip: 'Your money',
    t: 'It catches the slips that cost money',
    d: 'A deposit coming due. A total creeping past your budget while there’s still room to trim. A vendor you’re watching who quietly changes their price — it keeps the figure you were quoted and checks it against what they charge now. Each one flagged before it costs you.',
    media: { kind: 'photo', src: '/demo/maria-jose/vendor-catering.webp', alt: 'A catering buffet laid out on a white tablecloth at a reception' },
  },
  {
    chip: 'Quiet weeks',
    t: 'Most weeks, it stays quiet',
    d: 'It speaks up only when something genuinely can’t wait — a deposit due, a price that moved, two things clashing on the day — while there’s still time to act calmly. No fake countdowns, no manufactured panic.',
    media: { kind: 'photo', src: '/demo/maria-jose/ceremony.webp', alt: 'A couple kneeling at a candlelit church altar during their ceremony' },
  },
];

export default function SetnayanAiLandingPage() {
  return (
    <DoorwayPage
      title="It doesn’t chat. It watches your wedding for you."
      primary={{ href: '/onboarding/wedding?from=setnayan-ai', label: 'Start planning · free' }}
      secondary={{ href: '/pricing', label: 'See pricing' }}
      productName="Setnayan AI"
      studioKey="setnayan-ai"
      steps={STEPS}
      differentiator={{
        heading: 'A chatbot waits. Setnayan AI watches.',
        lede: 'Like a price watcher for flights or a home-search alert — but for your actual vendors, not the whole internet. It comes to you.',
        rows: VS,
      }}
      faq={FAQ}
      closing={{
        heading: 'Let it watch your back',
        body: 'Planning on Setnayan is free to start — guest list, RSVP, seating, budget, and your Event Hub. Setnayan AI is the paid brain that watches your vendors so you don’t have to — a job you’d otherwise need a small team for. Add it when you want it; 0% vendor commission, so it recommends what fits you, never what pays us.',
        href: '/onboarding/wedding?from=setnayan-ai',
        label: 'Start planning · free',
      }}
      structuredData={[APP_LD, FAQ_LD]}
    >
      <SpotlightSection
        productName="Setnayan AI"
        heading="A 24-hour secretary, working inside your wedding."
        lede="It doesn’t wait to be asked — it runs the errands for you, finding, tracking, and flagging, so the next thing on your plate is always the one that actually matters."
        items={SPOTLIGHTS}
      />
    </DoorwayPage>
  );
}
