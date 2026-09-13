/**
 * /marketplace — the public product page for the Marketplace: finding verified
 * Filipino vendors, saving them, and comparing two side by side
 * (www.setnayan.com/marketplace).
 *
 * ─── WHY IT EXISTS AT ALL ────────────────────────────────────────────────
 * Owner, 2026-09-05: *"Also add the other services. Marketplace to search for
 * vendors with compare, Guestlist, Seatplan"* — with the rail rule *"when
 * logged out or logged in and not inside an event, these links will direct to
 * the service description page … when they enter the event, it will move to
 * the different control centers."* The owner chose new Studio rows. This page
 * DESCRIBES the marketplace; the marketplace itself is `/explore` (and compare
 * is `/explore/compare`), which every door on this page opens. Inside an event
 * the rail row opens the event's own vendors desk instead.
 *
 * ⚠ THE SHELL ALSO HAS ITS OWN "Marketplace" DESTINATION ROW (→ /explore). The
 * owner chose a Studio row knowing that; whether the destination row then goes
 * is an open owner decision recorded in the corpus DECISION_LOG, not made here.
 *
 * ─── NOTHING HERE IS NEWLY INVENTED COPY ─────────────────────────────────
 * Every claim was traced before it was written, to: `/explore`'s own page
 * (its metadata — "Free to discover. 0% commission on bookings." — its hero,
 * the category folders and city browsing, the save button, the compare banner,
 * the VERIFIED-only gate); `/explore/compare` (two saved vendors side by side —
 * location, rating, services, faith fit, distance from your venue; "the 2-way
 * A-vs-B framing forces a clear decision"); `/features`'s vendor ledger entry;
 * `lib/help.ts` and `lib/llms-txt.ts` (verification = a business check plus a
 * video call with a Setnayan admin; real business name shown from day one;
 * couples transact directly and Setnayan never touches the money; vendors do
 * not see your email); and `lib/compat-score.ts` (the free fit preview never
 * hides a vendor; demand starts at the inquiry, never at search). Copy drafted
 * with the Fable model against those and nothing else.
 *
 * ⚠ THE DESCRIPTION IS NOT AUTHORED HERE. It comes from `lib/studio-apps.ts`.
 *
 * ─── THE THINGS THIS PAGE MUST NEVER GROW ────────────────────────────────
 * 🔴 A VENDOR COUNT, A CATEGORY COUNT, A PRICE OR A VENDOR'S NAME. The
 * catalogue is sparse today and every one of those would rot on an indexed
 * page.
 * 🔴 "SEE WHO ELSE IS LOOKING" / "IN DEMAND". Demand is counted at the inquiry
 * and NEVER at search (owner 2026-06-02: counting browsing as competition is
 * manufactured scarcity), and the public grid carries no such lens.
 * 🔴 "NOTHING HERE IS PAID PLACEMENT" — false: paid tiers buy prominence among
 * already-qualified results. The claim this page makes is 0% commission, and
 * only that.
 * 🔴 SELLING SETNAYAN AI. One boundary sentence: the fit preview is free; the
 * paid planner picks a suggested team. Nothing more.
 */

import { DoorwayPage } from '@/app/_components/marketing/_doorway';
import { SpotlightSection, type Spotlight } from '@/app/_components/marketing/_spotlights';
import { studioDescription } from '@/lib/studio-apps';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Marketplace — Find Your Vendors, Side by Side · Setnayan';
/** The document title ONLY — the root layout appends the brand via its
 *  `template: '%s · Setnayan'`; the share cards and structured data are
 *  correct WITH the brand. */
const DOC_TITLE = PAGE_TITLE.replace(/ · Setnayan$/, '');
const PAGE_DESCRIPTION = studioDescription('marketplace');
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: DOC_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/marketplace' },
  keywords: [
    'Filipino wedding vendors',
    'wedding marketplace Philippines',
    'verified wedding vendors Philippines',
    'compare wedding vendors',
    'find wedding suppliers Philippines',
    'wedding vendor shortlist',
    'Setnayan marketplace',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/marketplace',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Marketplace — find your vendors, side by side' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

/* SoftwareApplication JSON-LD. `offers` at ₱0: browsing is free and the
   platform takes 0% commission — the honest machine-readable form, the same
   one the other free doorways use. */
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Marketplace — Find Your Vendors, Side by Side',
  url: `${SITE_URL}/marketplace`,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'PHP' },
  featureList: [
    'Search verified Filipino wedding vendors and Setnayan’s own services from one box',
    'Browse by category and by city',
    'Every vendor listed passed a business check and a video call with a Setnayan admin',
    'Save the vendors you like to your shortlist',
    'Compare two saved vendors side by side — location, rating, services, faith fit',
    'A free preview of how well each vendor fits your wedding',
    'Free to browse, 0% commission on bookings',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'What is the Marketplace?',
    a: 'It is where you find the vendors for your day. Search verified Filipino vendors — photographers, videographers, caterers, coordinators, hair and makeup, cake and more — or browse by category and city. Save the ones you like, put two side by side, and decide.',
  },
  {
    q: 'Is it free? Do we need an account?',
    a: 'Browsing is free and open to anyone. Saving a vendor and comparing two are tied to your wedding, so you start an event when you want to keep one — that is free too. Setnayan takes 0% commission on bookings: nothing you pay a vendor comes back to us.',
  },
  {
    q: 'What does “verified” mean?',
    a: 'Every vendor you see completed a business-legitimacy check and a short video call with a Setnayan admin. Their real business name is shown from the first day, and you can always see who they are and message them for free.',
  },
  {
    q: 'How does compare work?',
    a: 'Save two vendors, then open the comparison. It lays them side by side — location, rating, services, faith fit, and distance from your reception venue if you have set one. It is two at a time on purpose: an A-or-B view leads to a decision, a wide table leads to more browsing.',
  },
  {
    q: 'Is the match preview the same as Setnayan AI?',
    a: 'No. The preview of how well a vendor fits your wedding is free, once you have an event to match against — it reads your ceremony, venue, budget and date, and never hides anyone. Setnayan AI is the separate, paid planner that picks a suggested team for you and keeps watching them. You never need it to use the Marketplace.',
  },
  {
    q: 'What happens after we pick someone?',
    a: 'Message them from Setnayan — a vendor sees your event’s display name and date, never your email. Inside your event, every vendor you choose sits in one ledger with their contact, contract, packages, payment schedule and notes. The payment itself happens directly between you and the vendor; Setnayan never touches the money.',
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
    t: 'Search, or browse by category',
    d: 'Type what you need — a photographer, a caterer, a coordinator — or open a category and browse by city. Verified Filipino vendors and Setnayan’s own services, all from one search box.',
  },
  {
    t: 'Save the ones you like',
    d: 'Every vendor shows their services, location and rating. Keep the ones you are considering in your shortlist, and once you have added your wedding, see a preview of how well each one fits it.',
  },
  {
    t: 'Put two side by side, then decide',
    d: 'Open any two saved vendors in one view — location, rating, services, faith fit, and distance from your venue if you have set one. Choose, message them, and they move into your event’s vendor ledger.',
  },
];

const VS = [
  ['Vendors found in group chats and comment threads', 'Verified vendors, one search'],
  ['Guessing who is legitimate', 'Every listing passed a business check and a video call'],
  ['Weighing quotes in your head', 'Two vendors side by side, spec for spec'],
  ['A referral fee hiding in your price', '0% commission — Setnayan never takes a cut'],
] as const;

/*
 * ─── THE FEATURE SPOTLIGHTS ──────────────────────────────────────────────
 * One idea · one picture · one sentence (`_components/marketing/_spotlights.tsx`).
 * Photographs only — the marketplace has no demo scenes; these are our own
 * demo celebration's vendors and rooms.
 */
const SPOTLIGHTS: readonly Spotlight[] = [
  {
    chip: 'One search',
    t: 'Everything for your day, in one search',
    d: 'Search verified Filipino vendors and Setnayan’s own services — photo, video, livestream, save-the-dates and more — all from one place, or browse by category and city.',
    media: { kind: 'photo', src: '/demo/maria-jose/vendor-photo.webp', alt: 'A bride in a lace gown and veil, eyes closed, standing beside a tall window' },
  },
  {
    chip: 'Verified',
    t: 'Every vendor here was checked first',
    d: 'Each one completed a business-legitimacy check and a short video call with a Setnayan admin, and their real business name is shown from the first day — so you always know who you are talking to.',
    media: { kind: 'photo', src: '/demo/maria-jose/vendor-catering.webp', alt: 'A catering buffet laid out on a white tablecloth at a reception' },
  },
  {
    chip: 'Your shortlist',
    t: 'Keep the ones you like',
    d: 'Save a vendor to your event picks the moment you find them. Once your wedding is on Setnayan, you also see a free preview of how well each one fits it — your ceremony, venue, budget and date — and no one is ever hidden from you.',
    media: { kind: 'photo', src: '/demo/maria-jose/vendor-florist.webp', alt: 'A cascade of white roses, peonies and greenery along a candlelit reception table' },
  },
  {
    chip: 'Compare',
    t: 'Two vendors, side by side',
    d: 'Put two saved vendors next to each other — location, rating, services, faith fit, and distance from your reception venue if you have set one. Two at a time on purpose: an A-or-B view leads to a decision.',
    media: { kind: 'photo', src: '/demo/maria-jose/reception.webp', alt: 'A long candlelit reception table under strings of lights in a garden at night' },
  },
  {
    chip: 'Inside your event',
    t: 'Chosen here, kept in one ledger',
    d: 'Message a vendor from Setnayan — they see your event’s name and date, never your email. Once you choose them, their contact, contract, packages, payment schedule and notes sit against a single row in your event, and you pay them directly: 0% commission, so what fits you is never what pays us.',
    media: { kind: 'photo', src: '/demo/maria-jose/details.webp', alt: 'A wedding invitation with two gold rings, beside a bouquet of white roses' },
  },
];

export default function MarketplaceLandingPage() {
  return (
    <DoorwayPage
      title={'Every vendor for your day, in one search.'}
      /*
        THE PRIMARY GOES TO THE MARKETPLACE ITSELF. Every other doorway sends a
        stranger to onboarding because its product needs an event to exist;
        the marketplace can be browsed by anyone, right now, so the honest
        first door is the thing itself. Starting a wedding is the second door.
      */
      primary={{ href: '/explore', label: 'Browse the marketplace' }}
      secondary={{ href: '/onboarding/wedding?from=marketplace', label: 'Start planning · free' }}
      productName="Marketplace"
      studioKey="marketplace"
      steps={STEPS}
      differentiator={{
        heading: 'Free to browse, and nothing taken out of your booking',
        lede: 'Setnayan never touches money between you and a vendor. You find them here, you compare them here, and you deal with them directly.',
        rows: VS,
      }}
      faq={FAQ}
      closing={{
        heading: 'Start with who you need',
        body: 'The Marketplace is free to browse, with 0% commission on bookings. Find your vendors here, save the ones you like, compare two — and when you start your wedding on Setnayan, they carry into your event’s vendor ledger, beside your guest list, budget and schedule.',
        href: '/explore',
        label: 'Browse the marketplace',
      }}
      structuredData={[APP_LD, FAQ_LD]}
    >
      <SpotlightSection
        productName="Marketplace"
        heading="Find them, keep them, compare them"
        lede="Free to browse. 0% commission on bookings."
        items={SPOTLIGHTS}
      />
    </DoorwayPage>
  );
}
