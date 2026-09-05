/**
 * /seat-plan — the public product page for the Seat Plan, the free seating
 * chart in every Setnayan wedding (www.setnayan.com/seat-plan).
 *
 * ─── WHY IT EXISTS AT ALL ────────────────────────────────────────────────
 * Owner, 2026-09-05: *"Also add the other services. Marketplace to search for
 * vendors with compare, Guestlist, Seatplan"* — with the rail rule *"when
 * logged out or logged in and not inside an event, these links will direct to
 * the service description page … when they enter the event, it will move to
 * the different control centers."* The owner chose new Studio rows. This page
 * is what makes the Seat plan row real for a stranger — the same shape as
 * `/mood-board` (2026-09-03); see that file's docblock.
 *
 * ⚠ 3D PLAN IS A DIFFERENT PRODUCT. It is paid, it has its own page (`/pa3d`),
 * and it reads FROM this free plan. This page names it exactly once, in the
 * words `studio-apps.ts` already uses ("the free seating plan gets you there;
 * 3D Plan lets you walk it") — never as an upgrade, never with a price.
 *
 * ─── NOTHING HERE IS NEWLY INVENTED COPY ─────────────────────────────────
 * Every claim was traced before it was written, to: `/features`'s toolkit
 * entry ("Seating chart · drag, drop, done"); `lib/help.ts` (free, the guest's
 * own page shows their table); the `pa3d` record and page (free-2D sentences
 * only); and the shipped editor (`dashboard/[eventId]/seating` — room presets
 * and the venue's own size, the Add menu, the drop bubble, Auto Arrange, the
 * Seating Guide's keep-apart rule and "Only you see this", Keep groups
 * together, Seating Priority, the PDF / print / caterer routes, the one-editor
 * lock and take-over). Copy drafted with the Fable model against those and
 * nothing else.
 *
 * ⚠ THE DESCRIPTION IS NOT AUTHORED HERE. It comes from `lib/studio-apps.ts`.
 *
 * ─── THE THINGS THIS PAGE MUST NEVER GROW ────────────────────────────────
 * 🔴 A PRICE, A TIER PILL, OR AN UPGRADE PROMPT — the plan is free and
 * complete (`/pa3d`'s own FAQ: "you can run your whole wedding on it").
 * 🔴 THE 3D SEGMENT AS A FEATURE. The shipped segment is List | 2D | 3D and
 * the 3D half is the paid product; this page names only the list and the plan.
 * 🔴 "FLAGS AWKWARD PAIRINGS" — the shipped mechanism is a keep-apart rule
 * the couple writes, not automatic detection. Say what the editor says.
 * 🔴 NUMBERS — table-type counts, sign caps, room sizes, timings.
 * 🔴 THE GUIDED SEAT-FINDER (Indoor Blueprint) — a separate free tool that
 * rides on this plan; its claims are its own.
 */

import { DoorwayPage } from '@/app/_components/marketing/_doorway';
import { SpotlightSection, type Spotlight } from '@/app/_components/marketing/_spotlights';
import { studioDescription } from '@/lib/studio-apps';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Seat Plan — Drag, Drop, Done · Setnayan';
/** The document title ONLY — the root layout appends the brand via its
 *  `template: '%s · Setnayan'`; the share cards and structured data are
 *  correct WITH the brand. */
const DOC_TITLE = PAGE_TITLE.replace(/ · Setnayan$/, '');
const PAGE_DESCRIPTION = studioDescription('seat-plan');
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: DOC_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/seat-plan' },
  keywords: [
    'wedding seating chart',
    'wedding seating chart Philippines',
    'wedding seat plan',
    'free wedding seating plan',
    'reception table plan',
    'reception floor plan',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/seat-plan',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Seat Plan — drag, drop, done' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

/* SoftwareApplication JSON-LD. `offers` at ₱0 is the honest machine-readable
   form of "free" — `/mood-board`'s form, and only a free doorway's. */
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Seat Plan — Drag, Drop, Done',
  url: `${SITE_URL}/seat-plan`,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'PHP' },
  featureList: [
    'Lay out your tables, stage, dance floor and entrance on a floor plan',
    'Drag any guest into a chair, or let Auto Arrange seat everyone',
    'Keep guests apart, and keep groups together',
    'Decide which roles sit nearest the stage',
    'Print the chart as a PDF, with table signs and place cards',
    'Share it with your coordinator, who can re-arrange right up until the day',
    'Free with every Setnayan account',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'What is the Seat Plan?',
    a: 'It is where you lay out your reception and decide where everyone sits. You draw the room — the tables, the stage, the entrance, the dance floor — then drag each guest into a chair, or let Auto Arrange seat them for you.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes. The Seat Plan is included with every Setnayan account, beside your guest list, your schedule, your budget and your mood board. It is free and complete — you can run your whole wedding on it. It is also what 3D Plan reads from: the free seating plan gets you there; 3D Plan lets you walk it.',
  },
  {
    q: 'Do we have to seat everyone by hand?',
    a: 'No. Build a seating draft and the whole floor is laid out in one tap, then Auto Arrange seats everyone who has not declined. As guests confirm, new ones get a provisional seat, and a change of role or group re-seats them. Drag anyone you want to move yourself.',
  },
  {
    q: 'What about people who should not sit together?',
    a: 'Tell the plan to keep two guests apart and it seats them — and their whole groups — at different tables. Only you see that rule. Keep groups together with one switch, and put your roles in the order you want so the right people sit nearest the stage.',
  },
  {
    q: 'Can our coordinator work on it?',
    a: 'Yes. Hand the plan to your coordinator and they can re-arrange right up until the day. One person edits at a time — anyone else who opens it sees the plan as it changes, and can take over when the editor steps away.',
  },
  {
    q: 'What can we print or hand over?',
    a: 'A PDF of the floor and tables, in your mood-board colours or as a clean blueprint. Printable table signs and place cards. And a meal count per table for your caterer, with every dietary note called out by name. On the day, each guest’s own page shows them their table.',
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
    t: 'Lay out the room',
    d: 'Pick a room size — or take the one your booked venue gave — then add your tables, the stage, the entrance and the dance floor. Vendor booths are there too, for the suppliers you have booked.',
  },
  {
    t: 'Seat every guest',
    d: 'Drag a guest onto a table and confirm the drop, or let Auto Arrange do it. Keep the ones who should not sit together apart, keep groups together, and decide who sits nearest the stage.',
  },
  {
    t: 'Hand it over',
    d: 'Print the chart as a PDF, with table signs and place cards, and give your caterer the meal counts. Your coordinator can keep re-arranging right up until the day, and each guest’s own page shows them their table.',
  },
];

const VS = [
  ['A spreadsheet of names and table numbers', 'Every guest in a chair you can see'],
  ['Remembering who must not sit together', 'A rule only you can see, honored every time'],
  ['Redrawing the chart every time someone confirms', 'New guests get a seat as they confirm'],
  ['Printed once, then out of date', 'Re-arranged right up until the day'],
] as const;

/*
 * ─── THE FEATURE SPOTLIGHTS ──────────────────────────────────────────────
 * One idea · one picture · one sentence (`_components/marketing/_spotlights.tsx`).
 * Photographs only — the seat plan has no demo scenes of its own, and the
 * guided seat-finder's scenes belong to a different tool (see the docblock).
 */
const SPOTLIGHTS: readonly Spotlight[] = [
  {
    chip: 'Your room',
    t: 'Lay out the room you actually have',
    d: 'Pick a room size or take the one your booked venue gave, then add your tables, the stage, the entrance and the dance floor.',
    media: { kind: 'photo', src: '/demo/maria-jose/reception.webp', alt: 'A laid reception table set for a Filipino wedding' },
  },
  {
    chip: 'Drag and drop',
    t: 'Every guest, in a chair',
    d: 'Drag a guest onto a table and confirm the drop, or tap Auto Arrange and it seats everyone who has not declined.',
    media: { kind: 'photo', src: '/demo/maria-jose/toast.webp', alt: 'Guests raising a toast at their table' },
  },
  {
    chip: 'Seating guide',
    t: 'Who should not sit together',
    d: 'Keep two guests apart and the plan seats them — and their whole groups — at different tables. Only you see the rule. Keep groups together with one switch.',
    media: { kind: 'photo', src: '/demo/maria-jose/details.webp', alt: 'Table details and place settings at a reception' },
  },
  {
    chip: 'Nearest the stage',
    t: 'Decide who sits closest',
    d: 'Put your roles in the order you want and Auto Arrange fills the tables nearest the stage from the top down.',
    media: { kind: 'photo', src: '/demo/maria-jose/firstdance.webp', alt: 'A couple’s first dance on the reception floor' },
  },
  {
    chip: 'Print and hand over',
    t: 'A chart your coordinator can hold',
    d: 'Export the plan as a PDF in your mood-board colours or as a clean blueprint, print table signs and place cards, and give your caterer the meal counts per table. Your coordinator can keep re-arranging right up until the day.',
    media: { kind: 'photo', src: '/demo/maria-jose/wall-6.webp', alt: 'A place setting with a folded napkin and a printed band on dark linen' },
  },
  {
    chip: 'Free',
    t: 'Complete, and nothing to buy',
    d: 'The Seat Plan is free with every Setnayan account, beside your guest list, your schedule, your budget and your mood board. You can run your whole wedding on it — and it is the floor your 3D Plan stands up from.',
    media: { kind: 'photo', src: '/demo/maria-jose/hero.webp', alt: 'A bride and groom on a garden terrace above a lake at sunset' },
  },
];

export default function SeatPlanLandingPage() {
  return (
    <DoorwayPage
      title={'Drag, drop, done.'}
      /* The secondary is /features, not /pricing — this tool is free, and
         /features is where the rest of the free workspace is described. */
      primary={{ href: '/onboarding/wedding?from=seat-plan', label: 'Start planning · free' }}
      secondary={{ href: '/features', label: 'See what else is free' }}
      productName="Seat plan"
      studioKey="seat-plan"
      steps={STEPS}
      differentiator={{
        heading: 'Seating that respects who should not sit next to whom',
        lede: 'Every guest is one row on your guest list, and the plan reads from the same list — so who has confirmed, who is a plus-one and who is a sponsor is already there when you seat them.',
        rows: VS,
      }}
      faq={FAQ}
      closing={{
        heading: 'Start with where everyone sits',
        body: 'The Seat Plan is free with every Setnayan wedding — beside your guest list, your schedule, your budget and your mood board. Nothing to buy, and it is the floor everything else stands on.',
        href: '/onboarding/wedding?from=seat-plan',
        label: 'Start planning · free',
      }}
      structuredData={[APP_LD, FAQ_LD]}
    >
      <SpotlightSection
        productName="Seat plan"
        heading="Seat everyone, then hand it over"
        lede="Free with every Setnayan account."
        items={SPOTLIGHTS}
      />
    </DoorwayPage>
  );
}
