/**
 * /mood-board — the public product page for the Mood Board, the free place a
 * couple decides how their day looks (www.setnayan.com/mood-board).
 *
 * ─── WHY IT EXISTS AT ALL ────────────────────────────────────────────────
 * Owner, 2026-09-03, looking at the Studio group in the front-door rail:
 * *"i do not see it."*
 *
 * The mood board was reachable — Studio → All services → Mood Board — because
 * the 2026-08-21 rail structure put the NAMED PRODUCTS in the Studio group and
 * left the free parts on the services hub. That collided with the older
 * 2026-07-17/18 lock naming the mood board one of six "always free" FIRST-CLASS
 * doorways that must stay directly reachable, and the collision sharpened once
 * the board became the thing the paid 3D Plan reads from. The owner resolved it
 * in favour of the older lock: the row is promoted into the Studio group.
 *
 * 🔑 SO THIS PAGE IS NOT OPTIONAL SCENERY — IT IS WHAT MAKES THAT ROW REAL.
 * `front-door-invariants.test.ts` requires every signed-out Studio row to
 * resolve to `app/(shell)/<href>/page.tsx`, and a signed-out stranger is handed
 * `StudioApp.href` verbatim. The other candidate — pointing the row straight at
 * `/dashboard/[eventId]/studio/mood-board` — has no eventId to substitute for a
 * stranger, so it would have 404'd for exactly the people a rail row exists to
 * introduce the product to. Same shape as `/pakanta` on 2026-08-21: the page
 * lands first, and the row lands with it.
 *
 * ─── NOTHING HERE IS NEWLY INVENTED COPY ─────────────────────────────────
 * The claims are the ones the product already ships. `add-ons-detail.ts` has
 * carried the Mood Board's hero, tagline and highlights since the App Store
 * detail pages were built — *"Your colors, everywhere."*, *"your save-the-date,
 * page, monogram, and QRs all dress to match"* — and `lib/help.ts` and
 * `lib/llms-txt.ts` have both said in public, for months, that it is free. A
 * second account of one product is the paid-twice mistake in miniature.
 *
 * ⚠ THE DESCRIPTION IS NOT AUTHORED HERE. It comes from `lib/studio-apps.ts`,
 * the one place the Studio products are described, so this page's search result
 * and the rail's row for it cannot disagree. Do not re-inline it.
 *
 * ─── THE ONE THING THIS PAGE MUST NEVER GROW ─────────────────────────────
 * 🔴 A PRICE, A TIER PILL, OR AN UPGRADE PROMPT. Every other doorway sells a
 * benefit and links to /pricing; this one has nothing to sell. The board is
 * free with every account (`add-ons-catalog.ts`: `tier: 'free'`, no
 * `serviceKey`), and the free claim is already indexed in `llms.txt` under "The
 * mood board is free". Putting a price path on this page would make that
 * published claim false.
 *
 * ⚠ AND NO CLAIM THE BOARD DOES NOT KEEP. Everything asserted below is shipped
 * and was read before it was written: the palette families and starter themes
 * (`_components/palette-section`, `_components/theme-studio`), the inspiration
 * board, the reception design (`lib/reception-scene`), the one-page printable
 * (`lib/moodboard-printable.ts`), "Share with vendors" (`actions.ts` →
 * `shareMoodBoardWithVendors`, which notifies every BOOKED marketplace vendor),
 * and the palette reaching the 3D room's attire (`resolveAttirePaletteColor`)
 * and the Event Hub's template gradient (`lib/site-palette.ts`).
 */

import { DoorwayPage } from '@/app/_components/marketing/_doorway';
import { SpotlightSection, type Spotlight } from '@/app/_components/marketing/_spotlights';
import { studioDescription } from '@/lib/studio-apps';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Mood Board — Your Colors, Everywhere · Setnayan';
/** The document title ONLY — the root layout appends the brand via its
 *  `template: '%s · Setnayan'`, and a PAGE_TITLE that already ends in the brand
 *  came out as "… · Setnayan · Setnayan" on 11 live pages once. The share cards
 *  and the structured-data name do NOT go through that template and are correct
 *  WITH the brand, which is why this strips it here and nowhere else. */
const DOC_TITLE = PAGE_TITLE.replace(/ · Setnayan$/, '');
const PAGE_DESCRIPTION = studioDescription('mood-board');
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: DOC_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/mood-board' },
  keywords: [
    'wedding mood board',
    'wedding color palette Philippines',
    'wedding motif colors',
    'entourage dress code colors',
    'reception design planner',
    'free wedding mood board',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/mood-board',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Mood Board — your colors, everywhere' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

/*
  SoftwareApplication JSON-LD. Every other doorway omits `offers` because the
  price is admin-managed and moves. This one omits it for the opposite reason
  and says so: there is no price. `offers` with a ₱0 `price` is the honest
  machine-readable form of "free", and it is the only doorway entitled to it.
*/
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Mood Board — Your Colors, Everywhere',
  url: `${SITE_URL}/mood-board`,
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'PHP' },
  featureList: [
    'Start from a curated theme or build your own palette',
    'Colors for the ceremony, the reception and the venue',
    'A dress code for each role — entourage, sponsors, guests',
    'Gather the rooms, flowers and details you love in one place',
    'A one-page printable you can hand a supplier',
    'Share it with your booked suppliers in one press',
    'Free with every Setnayan account',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'What is the Mood Board?',
    a: 'It is where your wedding decides how it looks. You pick the colors, gather the rooms and details you love, and set the dress code for each part of the entourage — all in one place, so there is a single answer when a supplier asks what your motif is.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes. The Mood Board is included with every Setnayan account, like your guest list, your schedule, your budget and your seat plan. There is nothing to buy and nothing that expires.',
  },
  {
    q: 'Do we have to be good at design?',
    a: 'No. Start from a curated theme and it fills your palette for you — the dominant color, the supporting one, the accent and the neutral — then change anything you do not like. Building one from scratch is there if you want it, not required.',
  },
  {
    q: 'Where do our colors actually show up?',
    a: 'Everywhere Setnayan makes something for you. Your save-the-date, your Event Hub, your monogram and your QR codes all dress to match, and the people in your 3D Plan wear the colors you set for their role — so what you see in the room is what you chose here.',
  },
  {
    q: 'Can our suppliers see it?',
    a: 'Yes. Suppliers you have booked through Setnayan can open a read-only copy of your board, and one press tells all of them it is ready. There is also a one-page printable you can hand to anyone else — your florist, your caterer, your seamstress.',
  },
  {
    q: 'Can we change our minds later?',
    a: 'As often as you like. Nothing here is locked, and everything that reads from your board picks up the change the next time you open it.',
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
    t: 'Pick your colors',
    d: 'Start from a curated theme or build your own. Colors for the ceremony and the reception, colors for the two of you, and a dress code for every role — the entourage, the sponsors, the guests.',
  },
  {
    t: 'Gather what you love',
    d: 'The rooms, the flowers, the table you keep coming back to. Plus the reception itself — the ceiling, the backdrop, the stage, the entrance — so the look is a decision, not a folder of screenshots.',
  },
  {
    t: 'Everything else dresses to match',
    d: 'Your save-the-date, your Event Hub, your monogram, your QR codes and the people in your 3D Plan. Your booked suppliers read the same board, and there is a one-page printable for everyone else.',
  },
];

const VS = [
  ['Colors living in a group chat', 'One board everybody works from'],
  ['Telling each supplier your motif again', 'They open the board themselves'],
  ['A screenshot folder nobody agrees on', 'Named colors for every role'],
  ['Finding out at the reception', 'Seeing it in your 3D Plan first'],
] as const;

/*
 * ─── THE FEATURE SPOTLIGHTS (2026-09-05) ─────────────────────────────────
 * One idea · one picture · one sentence — the shape the owner approved for
 * `/papic` and asked for on every Studio page (`_components/marketing/
 * _spotlights.tsx`). Every sentence is traceable to copy already on this
 * page, the product record, or the demo scenes' captions. Left out on
 * purpose: the scene's "one vision every vendor pulls from" (the page
 * promises BOOKED suppliers, not every vendor), and any line that Setnayan AI
 * picks or suggests colours — the palette engine is deterministic and
 * unrelated to that product. Still no price, tier pill or upgrade prompt: see
 * the docblock at the top of this file. The stills are frames of the
 * board's own demo scenes, captured by `scripts/capture-demo-stills.mjs`.
 */
const SPOTLIGHTS: readonly Spotlight[] = [
  {
    chip: 'Your palette',
    t: 'Pick the colors of your day',
    d: 'Start from a curated theme or build your own — colors for the ceremony and the reception, colors for the two of you, and a dress code for every role. Set your palette once, and see it everywhere.',
    media: { kind: 'still', src: '/add-ons/demo/stills/mood-board-0.jpg', alt: 'Mood Board — pick the colors of your day' },
  },
  {
    chip: 'In your colors',
    t: 'See your colors on every part',
    d: 'One picture for each color decision — the bouquet, the ceremony, the bride, the party — and every card repaints to match the palette you set.',
    media: { kind: 'still', src: '/add-ons/demo/stills/mood-board-1.jpg', alt: 'Mood Board — see your colors on every part' },
  },
  {
    chip: 'The reception',
    t: 'Style the reception room itself',
    d: 'Tap a part of the room — the ceiling, the tables, the stage — and decide how it looks, so the look is a decision, not a folder of screenshots.',
    media: { kind: 'still', src: '/add-ons/demo/stills/mood-board-2.jpg', alt: 'Mood Board — style your reception room' },
  },
  {
    chip: 'Everywhere',
    t: 'Everything else dresses to match',
    d: 'Your save-the-date, your Event Hub, your monogram, your QR codes and the people in your 3D Plan all wear the colors you set here. What you see in the room is what you chose.',
    media: { kind: 'photo', src: '/demo/maria-jose/details.webp', alt: 'A wedding invitation with two gold rings, beside a bouquet of white roses' },
  },
  {
    chip: 'Your suppliers',
    t: 'One board, and everyone is looking at it',
    d: 'Suppliers you have booked through Setnayan open a read-only copy of your board, and one press tells all of them it is ready. For everyone else — your florist, your caterer, your seamstress — there is a one-page printable, with palette, reception and attire in one PDF.',
    media: { kind: 'still', src: '/add-ons/demo/stills/mood-board-3.jpg', alt: 'Mood Board — one vision your whole team shares' },
  },
  {
    chip: 'Free',
    t: 'Nothing to buy, nothing that expires',
    d: 'The Mood Board is free with every Setnayan account, beside your guest list, your schedule and your seat plan. Change your mind as often as you like — nothing here is locked, and everything that reads from your board picks up the change.',
    media: { kind: 'photo', src: '/demo/maria-jose/moodboard.webp', alt: 'A flat lay of a ribbon, a ring, a compact and a bouquet on linen' },
  },
];

export default function MoodBoardLandingPage() {
  return (
    <DoorwayPage
      title={'Your colors, everywhere.'}
      /*
        ⚠ THE SECONDARY IS /features, NOT /pricing, AND THAT IS THE POINT.
        Every other doorway points at the price list because it is selling
        something. This one is free — sending a reader to a price list to find
        out what a free tool costs is a small false promise, and /features is
        where the rest of the free workspace (guest list, schedule, budget, seat
        plan) is actually described.
      */
      primary={{ href: '/onboarding/wedding?from=mood-board', label: 'Start planning · free' }}
      secondary={{ href: '/features', label: 'See what else is free' }}
      productName="Mood Board"
      studioKey="mood-board"
      steps={STEPS}
      differentiator={{
        heading: 'One board, and everyone is looking at it',
        lede: 'The motif is the thing every supplier asks about and the thing hardest to say twice the same way. Decide it once, in a place they can all open.',
        rows: VS,
      }}
      faq={FAQ}
      closing={{
        heading: 'Start with how it should feel',
        body: 'The Mood Board is free with every Setnayan wedding — beside your guest list, your schedule and your seat plan. Nothing to buy, and your colors carry into everything you make afterwards.',
        href: '/onboarding/wedding?from=mood-board',
        label: 'Start planning · free',
      }}
      structuredData={[APP_LD, FAQ_LD]}
    >
      <SpotlightSection
        productName="Mood Board"
        heading="Decide it once, and it shows up everywhere"
        lede="Free with every Setnayan account."
        items={SPOTLIGHTS}
      />
    </DoorwayPage>
  );
}
