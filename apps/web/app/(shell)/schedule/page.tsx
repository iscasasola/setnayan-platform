/**
 * /schedule — the public product page for the Schedule, the free day-of
 * timeline (www.setnayan.com/schedule).
 *
 * ─── WHY IT EXISTS ───────────────────────────────────────────────────────
 * Owner, 2026-09-06: *"add these"* — of the Budget and the Schedule, the two
 * free workspace tools left without a doorway. Same shape as `/seat-plan`; the
 * row is `doorwayOnly`, so it leaves the Studio group once an event is open
 * (the event's own rail carries Schedule).
 *
 * ─── TWO CLAIMS FROM `/features` ARE DELIBERATELY ABSENT ─────────────────
 * 🔴 ".ics SUBSCRIBE / CALENDAR SYNC" and 🔴 "WHEN YOU ADJUST A BLOCK, EVERY
 * VENDOR ON THAT BLOCK GETS A NOTIFICATION". Both are printed on the older
 * `/features` page and NEITHER IS SHIPPED for the schedule — checked before
 * writing, not assumed:
 *   · the only `.ics` in the repo is the save-the-date link, the budget
 *     due-date feed and a single vendor appointment; nothing under
 *     `dashboard/[eventId]/schedule` or `lib/schedule*` emits a VCALENDAR;
 *   · the only `emitNotification` on that route fires when the COUPLE resolves
 *     a vendor's suggestion — `updateScheduleBlock` and
 *     `bulkRetimeScheduleBlocks` notify nobody, and `ros-p2.tsx` says in as
 *     many words that nothing there sends anything.
 * What replaced them is what the code actually does: a filtered slice per
 * vendor, and suggestions the couple accepts or declines. Do not restore the
 * originals from `/features` — that page is older marketing copy, not the
 * product.
 *
 * ⚠ THE DESCRIPTION IS NOT AUTHORED HERE. It comes from `lib/studio-apps.ts`.
 *
 * ─── THE THINGS THIS PAGE MUST NEVER GROW ────────────────────────────────
 * 🔴 A PRICE OR AN UPGRADE PROMPT — free with every account.
 * 🔴 NUMBERS — no block counts, no minute deltas, no timings.
 * 🔴 SMS. Email only in V1, owner-locked.
 * 🔴 A PROMISE THAT EDITING NOTIFIES ANYONE. See above.
 */

import { DoorwayPage } from '@/app/_components/marketing/_doorway';
import { SpotlightSection, type Spotlight } from '@/app/_components/marketing/_spotlights';
import { studioDescription } from '@/lib/studio-apps';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Schedule — The Day, Minute by Minute · Setnayan';
/** The document title ONLY — see the sibling doorways. */
const DOC_TITLE = PAGE_TITLE.replace(/ · Setnayan$/, '');
const PAGE_DESCRIPTION = studioDescription('schedule');
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: DOC_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/schedule' },
  keywords: [
    'wedding day timeline',
    'wedding run of show',
    'wedding day schedule Philippines',
    'wedding program timeline',
    'free wedding timeline',
    'day-of timeline',
    'emcee script',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/schedule',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Schedule — the day, minute by minute' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Schedule — The Day, Minute by Minute',
  url: `${SITE_URL}/schedule`,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'PHP' },
  featureList: [
    'Build your day-of timeline block by block — ceremony, cocktails, reception, dinner, dancing, send-off',
    'Give each block a time, a place, notes, and who is responsible',
    'Show a block to guests or keep it hidden — public blocks appear on every guest’s invitation site',
    'A live “happening now” on the invitation site as the day unfolds',
    'Running late? Shift a block and everything after it in one move, durations kept',
    'Booked vendors see the blocks they carry, and can suggest changes you accept or decline',
    'Turn the timeline into a ready-to-read emcee or host script',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'What is the Schedule?',
    a: 'It is your day-of timeline — the run-of-show for the wedding itself. You add blocks — pre-ceremony, ceremony, cocktails, reception, dinner, the program, dancing, send-off, an after-party — and give each one a time, a place, notes and who is responsible. Or load a run-of-show template into an empty schedule and reshape every block.',
  },
  {
    q: 'Is it free?',
    a: 'Yes. The Schedule is included with every Setnayan account, beside your guest list, seat plan, budget and mood board.',
  },
  {
    q: 'Do our guests see it?',
    a: 'Only what you choose. Each block has a Show to guests switch. Public blocks appear on every guest’s invitation site with a live “happening now” highlight as the day unfolds, so they always know what is next and roughly when. Drafts stay private until you flip them visible.',
  },
  {
    q: 'What happens when the day runs late?',
    a: 'Shift a block and everything after it by the same amount — later or earlier — and every duration is kept. As you run the day, start the next block from the timeline and the header shows whether you are ahead, behind or on time, on every screen that has it open.',
  },
  {
    q: 'Do our vendors work from it too?',
    a: 'Tag a booked vendor on a block and that row shows up in their own run-of-show. Vendors never edit your timeline directly — they can suggest a change or a new entry, you accept or decline, and they hear back either way.',
  },
  {
    q: 'Who reads the program on the night?',
    a: 'Turn the timeline into a ready-to-read emcee or host script — copy it, or download it. If you have booked a host, you can also send them a note mid-service, straight from the schedule.',
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
    t: 'Lay out the day',
    d: 'Start with the ceremony, then layer cocktails, reception, dinner, dancing and send-off — or load a run-of-show template into an empty schedule and reshape every block. Each block gets a time, a place and notes.',
  },
  {
    t: 'Say who does what, and who sees what',
    d: 'Name the responsible party on each block and tag the booked vendors who carry it. Flip Show to guests on the blocks that belong on the invitation site; keep the crew logistics hidden.',
  },
  {
    t: 'Run the day from it',
    d: 'On the day, start the next block from the timeline and everyone with it open sees what is happening now. Running late? Shift a block and everything after it in one move. Hand your emcee a script compiled from the same program.',
  },
];

const VS = [
  ['A program pasted into a group chat', 'A master timeline every view reads from'],
  ['Guests asking what time the ceremony starts', 'Public blocks on the invitation site, with “happening now”'],
  ['Re-typing every time after the ceremony runs late', 'Shift a block and everything after it, durations kept'],
  ['Vendors keeping their own copy of your day', 'Vendors see their blocks, suggest changes, and you decide'],
] as const;

/*
 * ─── THE FEATURE SPOTLIGHTS ──────────────────────────────────────────────
 * One idea · one picture · one sentence. Photographs only — no demo scene
 * exists for the schedule, and each picture is the MOMENT its block is for.
 */
const SPOTLIGHTS: readonly Spotlight[] = [
  {
    chip: 'Blocks',
    t: 'Ceremony, cocktails, dinner, send-off',
    d: 'Add a block and give it a time, a place and notes. Start with the ceremony, then layer cocktails, reception, dinner, dancing and send-off.',
    media: { kind: 'photo', src: '/demo/maria-jose/ceremony.webp', alt: 'A bride and groom kneeling before the altar of a candlelit stone church' },
  },
  {
    chip: 'Show to guests',
    t: 'What guests see, and what they don’t',
    d: 'Public blocks appear on every guest’s invitation site with a live “happening now” as the day unfolds. Drafts stay private until you flip them visible.',
    media: { kind: 'photo', src: '/demo/maria-jose/toast.webp', alt: 'Guests raising a toast at their table' },
  },
  {
    chip: 'Who is responsible',
    t: 'Every block has a name on it',
    d: 'Name the responsible party — the HMUA team, a ninong, your coordinator — and tag the booked vendors who carry the block. Tagged vendors get that row in their own run-of-show.',
    media: { kind: 'photo', src: '/demo/maria-jose/details.webp', alt: 'Table details and place settings at a reception' },
  },
  {
    chip: 'Running late',
    t: 'Move the day, not every block',
    d: 'Shift a block and everything after it by the same amount, durations kept. As you run the day, start the next block and the header shows whether you are ahead, behind or on time.',
    media: { kind: 'photo', src: '/demo/maria-jose/firstdance.webp', alt: 'A couple’s first dance on the reception floor' },
  },
  {
    chip: 'Vendors',
    t: 'They suggest, you decide',
    d: 'Booked vendors can ask for a timeline change or propose a new entry. Accepting applies it; vendors never edit your timeline directly, and they hear back either way.',
    media: { kind: 'photo', src: '/demo/maria-jose/reception.webp', alt: 'A laid reception table set for a Filipino wedding' },
  },
  {
    chip: 'Emcee',
    t: 'A script your host can read from',
    d: 'Turn the timeline into a ready-to-read emcee or host script, then copy or download it. If you have booked a host, send them a note mid-service from the same page.',
    media: { kind: 'photo', src: '/demo/maria-jose/hero.webp', alt: 'A bride and groom on a garden terrace above a lake at sunset' },
  },
];

export default function ScheduleLandingPage() {
  return (
    <DoorwayPage
      title={'The day, minute by minute.'}
      primary={{ href: '/onboarding/wedding?from=schedule', label: 'Start planning · free' }}
      secondary={{ href: '/features', label: 'See what else is free' }}
      productName="Schedule"
      studioKey="schedule"
      steps={STEPS}
      differentiator={{
        heading: 'One timeline that guests, vendors and your emcee all read from',
        lede: 'Every view is a live filter over the same master — what guests see on the invitation site, what each vendor is responsible for, what the emcee reads — so you edit the master and each slice updates itself.',
        rows: VS,
      }}
      faq={FAQ}
      closing={{
        heading: 'Start with the day itself',
        body: 'The Schedule is free with every Setnayan wedding — beside your guest list, seat plan, budget and mood board. Nothing to buy, and it is the timeline the invitation site, your vendors and your emcee all read from.',
        href: '/onboarding/wedding?from=schedule',
        label: 'Start planning · free',
      }}
      structuredData={[APP_LD, FAQ_LD]}
    >
      <SpotlightSection
        productName="Schedule"
        heading="Build the day, then run it"
        lede="Free with every Setnayan account."
        items={SPOTLIGHTS}
      />
    </DoorwayPage>
  );
}
