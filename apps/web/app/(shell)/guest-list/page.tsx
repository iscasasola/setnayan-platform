/**
 * /guest-list — the public product page for the Guest List, the free guest
 * book every Setnayan event is planned from (www.setnayan.com/guest-list).
 *
 * ─── WHY IT EXISTS AT ALL ────────────────────────────────────────────────
 * Owner, 2026-09-05, after the spotlight pass on the Studio pages: *"Also add
 * the other services. Marketplace to search for vendors with compare,
 * Guestlist, Seatplan"* — and on how the rail behaves: *"when logged out or
 * logged in and not inside an event, these links will direct to the service
 * description page … when they enter the event, it will move to the different
 * control centers."* Asked where the rows live, the owner chose new Studio
 * rows. This page is what makes the Guest list row real for a stranger: the
 * rail hands them `StudioApp.href` verbatim, and an event-scoped address would
 * 404 for exactly the people a rail row exists to introduce the tool to. Same
 * shape as `/mood-board` on 2026-09-03.
 *
 * ─── NOTHING HERE IS NEWLY INVENTED COPY ─────────────────────────────────
 * Every claim was traced before it was written, to: `/features`'s planning
 * toolkit entry ("Guest list · every guest, every detail"); `lib/help.ts`'s
 * guest topics (personal link + QR, RSVP from the link, meals, plus-ones, the
 * Filipino roles, Import CSV, re-issuing a link); the Event Hub page's RSVP
 * answer; and the shipped guest list itself (`dashboard/[eventId]/guests` —
 * the capture bar, importance sort, filters, "Arrange the room", "Who came",
 * "the list is open"). Copy drafted with the Fable model against those and
 * nothing else.
 *
 * ⚠ THE DESCRIPTION IS NOT AUTHORED HERE. It comes from `lib/studio-apps.ts`,
 * the one place the Studio products are described, so this page's search
 * result and the rail's row cannot disagree. Do not re-inline it.
 *
 * ─── THE THINGS THIS PAGE MUST NEVER GROW ────────────────────────────────
 * 🔴 A PRICE, A TIER PILL, OR AN UPGRADE PROMPT. The guest list is free with
 * every account (`lib/help.ts` says so in public). The branded / monogram QR
 * is deliberately NOT claimed: `guests/page.tsx` treats it as the paid
 * CUSTOM_QR_GUEST upgrade while `lib/llms-txt.ts` calls it free — a conflict
 * surfaced to the owner, not resolved in copy. Only the per-guest personal QR
 * (which always renders, free) is described.
 * 🔴 PER-GUEST INVITATION SENDING. There is no per-guest send in this product —
 * the Invite stage hands out ONE link for everybody. Say "share one link" or
 * "copy a guest's link", never "send each guest their invitation".
 * 🔴 NUMBERS. No role counts, no import caps, no RSVP windows.
 */

import { DoorwayPage } from '@/app/_components/marketing/_doorway';
import { SpotlightSection, type Spotlight } from '@/app/_components/marketing/_spotlights';
import { studioDescription } from '@/lib/studio-apps';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Guest List — Every Guest, Every Detail · Setnayan';
/** The document title ONLY — the root layout appends the brand via its
 *  `template: '%s · Setnayan'`; the share cards and structured data are
 *  correct WITH the brand. */
const DOC_TITLE = PAGE_TITLE.replace(/ · Setnayan$/, '');
const PAGE_DESCRIPTION = studioDescription('guest-list');
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: DOC_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/guest-list' },
  keywords: [
    'wedding guest list',
    'wedding guest list Philippines',
    'wedding RSVP tracker',
    'ninong ninang list',
    'principal sponsors list',
    'plus-one RSVP',
    'free wedding guest list',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/guest-list',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Guest List — every guest, every detail' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

/* SoftwareApplication JSON-LD. `offers` at ₱0 is the honest machine-readable
   form of "free" — the same form `/mood-board` uses, and only a free doorway
   is entitled to it. */
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Guest List — Every Guest, Every Detail',
  url: `${SITE_URL}/guest-list`,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'PHP' },
  featureList: [
    'Every guest is one row — RSVP, plus-one, meal preference, role and table',
    'Filipino wedding roles — principal sponsors, candle, veil, cord and coin sponsors, ninong, ninang, bearers',
    'A personal link and QR code for every guest',
    'Guests RSVP in a tap and your list updates in real time',
    'Paste your spreadsheet, or type a name and press Enter',
    'One join link you can share with everyone',
    'Free with every Setnayan account',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'What is the Guest List?',
    a: 'It is your guest book, one row per guest. Each row carries their RSVP, their plus-one, their meal preference, their role in the wedding and their table — all in the same place your invitations and your gallery read from, so there is no Google Sheet, Notes app and group chat to keep in step.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes. The Guest List is free with every Setnayan account, beside your schedule, your budget, your seat plan and your mood board. There is nothing to buy to use it.',
  },
  {
    q: 'How do guests RSVP?',
    a: 'Each guest opens their personal link or scans their QR, taps RSVP and picks Yes, No or Maybe. If you are asking about meals, they pick theirs there too, with a note for allergies, and it feeds the count your caterer works from. You see who is coming in real time, right beside your guest list and seating.',
  },
  {
    q: 'What about plus-ones?',
    a: 'Tick “Allow plus-one” on a guest and Setnayan adds a second row linked to theirs. The plus-one has their own QR and can RSVP on their own. If you do not know who it is yet, the guest names them on their reply, or the plus-one names themselves the first time they open the invitation.',
  },
  {
    q: 'Does it know Filipino wedding roles?',
    a: 'Yes. Principal sponsors, candle, veil, cord and coin sponsors, ninong and ninang, ring, bible and coin bearers, flower girl, maid or matron of honor, best man, bridesmaids, groomsmen, officiant, readers and soloists are all there to assign. The list arranges itself by importance — the bride first, then the groom, then everyone by their role — and you can filter to just the sponsors, the wedding party or the bearers.',
  },
  {
    q: 'Do we have to type everyone in?',
    a: 'No. Type a name and press Enter — “Ana Cruz +1 groom vip #Barkada” lands as a row with her side, her plus-one, her role and her group. Or paste your spreadsheet with Import CSV, or pick from the people already in your account. Anyone who joins from your shared invite link shows up for you to confirm.',
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
    t: 'Build the list',
    d: 'Type a name and press Enter, paste your spreadsheet, or pick from the people already in your account. Each guest gets a side, a role, a group and, if you allow it, a plus-one.',
  },
  {
    t: 'Invite, and let them answer',
    d: 'Every guest has a personal link and QR code, and there is one join link you can share with everyone. They tap RSVP, pick Yes, No or Maybe and their meal, and your list updates in real time.',
  },
  {
    t: 'Seat them, then count who came',
    d: 'Give each guest a table, arrange the room, and on the day check in who actually walked in. Afterwards the list stays open — for the cousin who turned up unannounced, and for your thank-yous.',
  },
];

const VS = [
  ['A Google Sheet, a Notes app and a WhatsApp thread', 'One row per guest, in one place'],
  ['Chasing replies by message', 'Guests answer in a tap and you see it live'],
  ['A roles column you fill in by hand', 'Ninong, ninang, sponsors and bearers, ready to assign'],
  ['Counting meals from screenshots', 'Meal preferences your caterer can count on'],
] as const;

/*
 * ─── THE FEATURE SPOTLIGHTS ──────────────────────────────────────────────
 * One idea · one picture · one sentence (`_components/marketing/_spotlights.tsx`).
 *
 * 🔴 PHOTOGRAPHS ONLY, AND THAT IS A CORRECTION. The first draft illustrated
 * three of these with stills of the `custom-qr-guest` demo scenes, on the
 * reasoning that only scene 1 showed the "Default — free / Upgrade" pill. THE
 * PICTURES WERE OPENED AND LOOKED AT, and every one of them is the PAID
 * product: scene 0 reads "CUSTOM QR PER GUEST" over the couple's monogram,
 * scene 2 "Your branded QR cards are ready", scene 3 the branded print pack.
 * Dodging the frame with the price pill left three frames of the same upsell
 * with the pill out of shot — a picture of the paid branded QR standing in for
 * the free per-guest QR this page is allowed to claim.
 *
 * 🔑 A PICTURE IS A CLAIM. Reading a scene's caption is not the same as
 * looking at what the frame shows; `spotlights-are-real.test.ts` now bans
 * these three files by name, with the reason, so the shortcut cannot be
 * retaken. The photographs below are our own demo celebration.
 */
const SPOTLIGHTS: readonly Spotlight[] = [
  {
    chip: 'Your list',
    t: 'Type a name, press Enter',
    d: 'Type “Ana Cruz +1 groom vip #Barkada” and she lands as a row with her side, her plus-one, her role and her group. Or paste your spreadsheet, or pick from the people already in your account.',
    media: { kind: 'photo', src: '/demo/maria-jose/toast.webp', alt: 'A bride and groom raising their glasses in a toast, surrounded by guests and candlelight' },
  },
  {
    chip: 'Roles',
    t: 'Every Filipino role, already there',
    d: 'Principal sponsors, candle, veil, cord and coin sponsors, ninong and ninang, bearers and the wedding party are all there to assign — and the list arranges itself by importance, the bride first, then the groom, then everyone by their role.',
    media: { kind: 'photo', src: '/demo/maria-jose/wall-4.webp', alt: 'Two guests embracing at a wedding' },
  },
  {
    chip: 'RSVP',
    t: 'Guests answer in a tap',
    d: 'They open their link, pick Yes, No or Maybe and their meal, and you see who is coming in real time — right beside your guest list and seating. A plus-one can answer on their own, and name themselves if you did not know who they were.',
    media: { kind: 'photo', src: '/demo/maria-jose/ceremony.webp', alt: 'A bride and groom kneeling before the altar of a stone church, with an officiant beside them' },
  },
  {
    chip: 'Personal QR',
    t: 'A link and a code for every guest',
    d: 'Each guest gets a personal link with their own QR code, and there is one join link for everyone else. When a guest opens theirs, your list updates in real time.',
    media: { kind: 'photo', src: '/demo/maria-jose/wall-6.webp', alt: 'A printed place card on a table setting' },
  },
  {
    chip: 'Print',
    t: 'Print the whole set at once',
    d: 'Print the QR sheet for everyone in one go, one code per guest, or copy a single guest’s link straight from the table. If a guest loses their link, re-issue it and the old one stops working.',
    media: { kind: 'photo', src: '/demo/maria-jose/details.webp', alt: 'A wedding invitation with two gold rings, beside a bouquet of white roses' },
  },
  {
    chip: 'Seats and the day',
    t: 'From the list to the room to the door',
    d: 'Give each guest a table and arrange the room from the same list. On the day, check in who came — and afterwards the list stays open for anyone who turned up unannounced.',
    media: { kind: 'photo', src: '/demo/maria-jose/reception.webp', alt: 'A long candlelit reception table under strings of lights in a garden at night' },
  },
];

export default function GuestListLandingPage() {
  return (
    <DoorwayPage
      title={'Every guest, every detail, one row each.'}
      /* The secondary is /features, not /pricing — this tool is free, and
         /features is where the rest of the free workspace is described. */
      primary={{ href: '/onboarding/wedding?from=guest-list', label: 'Start planning · free' }}
      secondary={{ href: '/features', label: 'See what else is free' }}
      productName="Guest list"
      studioKey="guest-list"
      steps={STEPS}
      differentiator={{
        heading: 'One list your whole wedding reads from',
        lede: 'Your invitations, your seat plan and your gallery all read the same guest book — so when a guest answers, everything that depends on that answer already knows.',
        rows: VS,
      }}
      faq={FAQ}
      closing={{
        heading: 'Start with who is coming',
        body: 'The Guest List is free with every Setnayan account — beside your schedule, your budget, your seat plan and your mood board. Add the first name, and the rest of your planning reads from it.',
        href: '/onboarding/wedding?from=guest-list',
        label: 'Start planning · free',
      }}
      structuredData={[APP_LD, FAQ_LD]}
    >
      <SpotlightSection
        productName="Guest list"
        heading="One row per guest, and everything reads from it"
        lede="Free with every Setnayan account."
        items={SPOTLIGHTS}
      />
    </DoorwayPage>
  );
}
