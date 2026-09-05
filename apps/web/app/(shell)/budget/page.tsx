/**
 * /budget — the public product page for the Budget, the free place a couple
 * decides what their day may cost and watches what it actually does
 * (www.setnayan.com/budget).
 *
 * ─── WHY IT EXISTS ───────────────────────────────────────────────────────
 * Owner, 2026-09-06, after the first three free tools got doorways: *"add
 * these"* — of the Budget and the Schedule, the two free workspace tools that
 * had no page while Marketplace, Guest list and Seat plan had one.
 *
 * Same shape as `/seat-plan` (2026-09-05): the rail hands a signed-out stranger
 * `StudioApp.href` verbatim, so a description page is what makes that row real.
 * And `doorwayOnly`, so the row leaves the Studio group the moment an event
 * opens — the event's own rail already carries Budget, and a second copy is the
 * "same destination, two names" defect `lib/free-tools-rail.ts` records.
 *
 * ─── NOTHING HERE IS NEWLY INVENTED COPY ─────────────────────────────────
 * Traced before it was written, to `/features`'s "Budget · the truth, in PHP"
 * entry; `lib/help.ts` (the free-workspace list, budget line items, exporting
 * due dates to a calendar); and the SHIPPED tool itself
 * (`dashboard/[eventId]/budget` — the setter's one question, the suggested
 * split with its Save/Standard/Splurge tilts, the Target/Agreed/Paid/Owed
 * tiles, the ledger, the next-payments list). Drafted with the Fable model
 * against those and nothing else.
 *
 * ⚠ THE DESCRIPTION IS NOT AUTHORED HERE. It comes from `lib/studio-apps.ts`.
 *
 * ─── THE THINGS THIS PAGE MUST NEVER GROW ────────────────────────────────
 * 🔴 A PRICE, A TIER PILL OR AN UPGRADE PROMPT — the Budget is free with every
 * account and `help.ts` says so in public.
 * 🔴 NUMBERS. No peso figures, no category counts, no percentages, no "next 30
 * days". A budget page is exactly where a stale number would look authoritative.
 * 🔴 A CLAIM THAT SETNAYAN MOVES MONEY. It does not: couples and suppliers
 * transact directly, off-platform (`llms-txt.ts`), and the ledger says in as
 * many words that nothing here moves your money. This page RECORDS.
 * 🔴 QUOTES. Owner ruling 2026-09-02 (`lib/budget-page-money.ts`): *"no quotes
 * here. we only add the finalized budgets. on the marketplace, this is where
 * they can add and subtract the other vendors."* Finalized money only.
 * 🔴 "Every payment ties back to a vendor and an OR" — that sentence is on the
 * old `/features` page and the shipped tool contradicts it: `event_costs` takes
 * costs with NO supplier (the rings, the licence, tips). Deliberately absent.
 */

import { DoorwayPage } from '@/app/_components/marketing/_doorway';
import { SpotlightSection, type Spotlight } from '@/app/_components/marketing/_spotlights';
import { studioDescription } from '@/lib/studio-apps';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Budget — The Truth, in PHP · Setnayan';
/** The document title ONLY — the root layout appends the brand via its
 *  `template: '%s · Setnayan'`. The share cards and structured-data name do NOT
 *  go through that template and are correct WITH the brand. */
const DOC_TITLE = PAGE_TITLE.replace(/ · Setnayan$/, '');
const PAGE_DESCRIPTION = studioDescription('budget');
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: DOC_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/budget' },
  keywords: [
    'wedding budget',
    'wedding budget Philippines',
    'wedding budget tracker',
    'free wedding budget planner',
    'wedding budget breakdown',
    'wedding cost categories Philippines',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/budget',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Budget — the truth, in PHP' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

/* `offers` at ₱0 is the honest machine-readable form of "free" — the form
   `/mood-board` established, and only a free doorway is entitled to it. */
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Budget — The Truth, in PHP',
  url: `${SITE_URL}/budget`,
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'PHP' },
  featureList: [
    'Set your total wedding budget in pesos, and change it anytime',
    'A suggested split across categories from typical Filipino wedding costs — a guide, not a rule',
    'Target, agreed, paid and owed — for the whole wedding and category by category',
    'Only finalized bookings count; suppliers you are still choosing between stay in the Marketplace',
    'Log payments against each booked supplier, and record costs with no supplier — the rings, the licence, tips',
    'Next payments listed with their due dates, and overdue ones called out',
    'Free with every Setnayan account',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'What is the Budget?',
    a: 'It is where you say what your wedding may cost, then watch what it actually does. Set your total in pesos, take a suggested split across categories — venue, catering, photography, attire, flowers, music — and as you book suppliers and log payments, it shows what you have agreed, what you have paid and what you still owe.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes. The Budget is included with every Setnayan account, beside your schedule, your guest list, your seat plan and your mood board. Nothing to buy.',
  },
  {
    q: 'Where do the suggested numbers come from?',
    a: 'From typical Filipino wedding costs, as a starting point. Each category shows a suggested amount and a typical range, and says plainly when a figure is only a rough estimate. Tap any category to choose Save, Standard or Splurge, or type your own amount — if you go below the cheapest price we have seen, it tells you, and lets you anyway. It is a guide, not a rule; your own number always wins.',
  },
  {
    q: 'A supplier sent us a quote. Does it show up here?',
    a: 'Not until you book them. The Budget shows finalized money only — what you have actually signed for. Suppliers you are still choosing between stay in the Marketplace, where you can add and subtract them to find the better option. The moment you contract one, its line items and payments appear here on their own.',
  },
  {
    q: 'Does Setnayan handle our payments?',
    a: 'No. You pay your suppliers directly, the way you already do; here you log each payment as the money moves, and your totals update. Setnayan records your budget — it never holds or moves your money.',
  },
  {
    q: 'Who can see our budget?',
    a: 'You, and anyone you give budget access to. Setting the target is yours alone. If you choose, a supplier you are talking to can see a rounded range for their own category — never your exact numbers, never other categories. That is off by default, and you can turn it on or off anytime.',
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
    t: 'Set your target',
    d: 'Answer one question — what is your total wedding budget, in pesos — and change it anytime. A suggested split appears from typical Filipino wedding costs; nudge any category, or set your own amount, then save the plan.',
  },
  {
    t: 'Book, then log',
    d: 'Once you contract a supplier, their line items appear on their own — from their catalogue if they are on Setnayan, or added by you if they are not. Log each payment as the money moves. Costs with no supplier — the rings, the licence, tips — have a place too.',
  },
  {
    t: 'See where you stand',
    d: 'Target, agreed, paid and owed — for the whole wedding and category by category, with a bar that shows the shape before you read the number. Next payments are listed with their due dates, overdue ones called out, and every unpaid due date can go straight into your calendar.',
  },
];

const VS = [
  ['A spreadsheet only you remember to update', 'Agreed, paid and owed, refreshed as each payment is logged'],
  ['A quote you are still deciding on, counted as spent', 'Only what you have signed for counts'],
  ['Guessing what catering should cost', 'A suggested split from typical Filipino wedding costs, yours to nudge'],
  ['Remembering when each balance is due', 'Next payments listed, and overdue called out'],
] as const;

/*
 * ─── THE FEATURE SPOTLIGHTS ──────────────────────────────────────────────
 * One idea · one picture · one sentence. Photographs only — the Budget has no
 * demo scene of its own, and a screenshot of somebody's money would need
 * numbers this page may not print.
 */
const SPOTLIGHTS: readonly Spotlight[] = [
  {
    chip: 'Your target',
    t: 'Say the number once',
    d: 'What is your total wedding budget? Type it in pesos and change it anytime — it is your stated target, not a limit anyone sets for you.',
    media: { kind: 'photo', src: '/demo/maria-jose/vendor-photo.webp', alt: 'A bride in a lace gown and veil, eyes lowered, beside a tall window' },
  },
  {
    chip: 'Suggested split',
    t: 'What each part usually costs',
    d: 'A starting point from typical Filipino wedding costs, category by category, with a typical range beside each amount. Choose Save, Standard or Splurge, or set your own — a guide, not a rule.',
    media: { kind: 'photo', src: '/demo/maria-jose/vendor-catering.webp', alt: 'A catering buffet laid out along a long white table at a reception' },
  },
  {
    chip: 'Signed for',
    t: 'Only finalized money counts',
    d: 'Agreed, paid and owed — what you have actually signed for, never a quote. Suppliers you are still choosing between stay in the Marketplace until you book one.',
    media: { kind: 'photo', src: '/demo/maria-jose/vendor-florist.webp', alt: 'White roses and greenery running along a head table, with lit candles' },
  },
  {
    chip: 'Next payments',
    t: 'What is due, and when',
    d: 'Every unpaid line item with a due date lines up under your progress bar, overdue ones called out — and you can send them all to Google Calendar, Apple Calendar or Outlook.',
    media: { kind: 'photo', src: '/demo/maria-jose/ceremony.webp', alt: 'A bride and groom kneeling before a candlelit altar in a stone church' },
  },
  {
    chip: 'Every peso',
    t: 'The rings, the licence, tips',
    d: 'Booked suppliers bring their own line items — from their catalogue, or added by you for suppliers off Setnayan. Costs with nobody on the other side have a place of their own, so nothing you pay for is left out.',
    media: { kind: 'photo', src: '/demo/maria-jose/moodboard.webp', alt: 'A ring, a printed program, a compact and a pale ribbon laid out on linen' },
  },
  {
    chip: 'Free',
    t: 'Complete, and nothing to buy',
    d: 'The Budget is free with every Setnayan account, beside your guest list, your schedule, your seat plan and your mood board. Setnayan records your money; it never holds or moves it.',
    media: { kind: 'photo', src: '/demo/maria-jose/wall-3.webp', alt: 'A couple dancing under strings of lights at dusk, seen between two guests' },
  },
];

export default function BudgetLandingPage() {
  return (
    <DoorwayPage
      title={'The truth, in PHP.'}
      /* The secondary is /features, not /pricing — this tool is free, and
         /features is where the rest of the free workspace is described. */
      primary={{ href: '/onboarding/wedding?from=budget', label: 'Start planning · free' }}
      secondary={{ href: '/features', label: 'See what else is free' }}
      productName="Budget"
      studioKey="budget"
      steps={STEPS}
      differentiator={{
        heading: 'A budget that counts only what you have signed for',
        lede: 'Suppliers you are still choosing between stay in the Marketplace, where you add and subtract them to find the better option. The moment you contract one, its line items and payments appear here on their own.',
        rows: VS,
      }}
      faq={FAQ}
      closing={{
        heading: 'Start with the number',
        body: 'The Budget is free with every Setnayan wedding — beside your guest list, your schedule, your seat plan and your mood board. Set your target once, and every payment you log tells you where you stand.',
        href: '/onboarding/wedding?from=budget',
        label: 'Start planning · free',
      }}
      structuredData={[APP_LD, FAQ_LD]}
    >
      <SpotlightSection
        productName="Budget"
        heading="Set the target, then watch it hold"
        lede="Free with every Setnayan account."
        items={SPOTLIGHTS}
      />
    </DoorwayPage>
  );
}
