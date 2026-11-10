/**
 * front-door-landing-data.ts — the words and photos of the signed-out front page's sections.
 *
 * PORTED FROM `prototypes/front_page_2026-11-04.html` (owner-approved 4 Nov 2026, DECISION_LOG
 * "THE THREE MARKETING PAGES GO TO CLOUD BUILD"). The copy is the prototype's, word for word, except
 * where a note below says why it is not. Kept apart from the markup so the sections read as layout.
 *
 * 🔑 WHAT IS NOT HERE, ON PURPOSE:
 *   • the event types — read from `event_type_vocab` (`getCreatableEventTypes`), never listed;
 *   • any peso figure or credit count — every price and every included-credit number is read from
 *     `platform_retail_catalog_v2` or not shown (see `front-door-landing.tsx`, the plans section);
 *   • the sample's names, date and guest keys — read from the Maria and Jose fixtures
 *     (`lib/sample-event/*`), never typed here.
 */

import { formatCount } from '@/lib/format-number';
import { FREE_THEMES } from '@/lib/invite-themes';

/* ─── HERO ───────────────────────────────────────────────────────────────────────────────────── */

/**
 * The six hero slides, in the prototype's order. `word` turns in the <h1>; `label` is the picker's.
 *
 * The hero rule (owner, "images are too cut", 4 Nov — for all three pages):
 *   • phone: `object-fit: cover` at `object-position: var(--px, 50%) 28%`;
 *   • from 1024px: the photo shows its full height, anchored right and pushed right by `--dr`.
 * Christening and birthday are portrait renders and carry neither value, exactly as drawn.
 */
export type HeroSlide = {
  key: string;
  word: string;
  label: string;
  photo: string;
  /** How far the photo is pushed past the right edge from 1024px. */
  dr?: string;
  /** The phone crop's horizontal focus. */
  px?: string;
};

export const HERO_SLIDES: readonly HeroSlide[] = [
  { key: 'wedding', word: 'wedding', label: 'Wedding', photo: 'hero-wedding', dr: '12%', px: '52%' },
  { key: 'debut', word: 'debut', label: 'Debut', photo: 'hero-debut', dr: '25%', px: '47%' },
  { key: 'christening', word: 'christening', label: 'Christening', photo: 'hero-christening' },
  { key: 'birthday', word: 'birthday', label: 'Birthday', photo: 'hero-birthday' },
  { key: 'reunion', word: 'reunion', label: 'Reunion', photo: 'hero-reunion', dr: '33%', px: '54%' },
  { key: 'company', word: 'company event', label: 'Company event', photo: 'hero-company', dr: '24%', px: '60%' },
];

/* ─── WHAT IT SOLVES ─────────────────────────────────────────────────────────────────────────── */

/**
 * One problem, then what happens instead.
 *
 * ⚠ WHERE "TRY IT" GOES. The prototype points most of these at `/sample/dashboard/…`. The owner ruled the marketing
 * pages carry no demo or sample buttons (CLOUD_BOARD, 5 Nov: "just do not add buttons"), so each row opens its
 * feature's own page (`/features/<slug>`), which ships.
 */
export type SolveTag = { kind: 'free' } | { kind: 'fine'; text: string } | null;

export type Solve = {
  photo: string;
  alt: string;
  title: string;
  pain: string;
  answer: string;
  action: string;
  /** The shipped feature page. */
  href: string;
  tag: SolveTag;
};

const FREE: SolveTag = { kind: 'free' };

export const SOLVES: readonly Solve[] = [
  {
    photo: 'problem-rsvp',
    alt: 'A phone showing a long family group chat',
    title: 'Who’s coming?',
    pain: 'You ask in the group chat who’s coming, and the answers get buried.',
    answer: 'Every guest gets their own link. They tap yes or no, and your list fills itself.',
    action: 'Open the guest list',
    href: '/features/guest-list',
    tag: FREE,
  },
  {
    photo: 'problem-02-phones',
    alt: 'Guests holding up phones at a reception',
    title: 'Your guests’ photos',
    pain: 'Your guests’ photos stay on their phones. You never see most of them.',
    answer: 'Every photo lands in one album for you, and each guest gets the ones they’re in.',
    action: 'See the shared album',
    href: '/features/papic',
    tag: { kind: 'fine', text: 'Free cameras · photos use Papic credits' },
  },
  {
    photo: 'problem-03-door',
    alt: 'A usher at a venue door with a clipboard',
    title: 'Who actually came',
    pain: 'On the day, nobody really knows who came, and the caterer counts plates by guessing.',
    answer: 'Guests show their QR at the door. You see who is in, and the caterer gets the real count.',
    action: 'See door check-in',
    href: '/features/guest-list',
    tag: FREE,
  },
  {
    photo: 'problem-seatplan',
    alt: 'A paper seat plan full of crossed-out names',
    title: 'The seat plan',
    pain: 'The seat plan is on paper, changed ten times, and the meal counts come out wrong.',
    answer: 'Move tables on your phone. Every guest finds their seat, and the meal counts fix themselves.',
    action: 'Open the seat plan',
    href: '/features/seat-plan',
    tag: FREE,
  },
  {
    photo: 'problem-receipts',
    alt: 'A couple at a kitchen table with receipts and a calculator',
    title: 'The money',
    pain: 'Costs are everywhere — receipts, chats, a notebook — and you find out you overspent too late.',
    answer: 'One page shows what you planned, what you agreed to, what you’ve paid, and what you still owe.',
    action: 'Open the budget',
    href: '/features/budget',
    tag: FREE,
  },
  {
    photo: 'problem-06-coordinator',
    alt: 'A coordinator checking her watch backstage',
    title: 'The day’s timeline',
    pain: 'The plan for the day lives in one person’s head. When they’re busy, everyone waits.',
    answer: 'One shared schedule, part by part. Everyone — suppliers too — sees it live on the day.',
    action: 'Open the schedule',
    href: '/features/schedule',
    tag: FREE,
  },
  {
    photo: 'problem-suppliers-bed',
    alt: 'A woman scrolling supplier posts in a Facebook group late at night',
    title: 'Finding suppliers you can trust',
    pain: 'You hunt for suppliers in Facebook groups, with no way to know who is real or fair.',
    answer: 'Verified suppliers by city, compared side by side. Chat, ask for a quote and book, all here.',
    action: 'Browse suppliers',
    href: '/features/marketplace',
    tag: FREE,
  },
  {
    photo: 'problem-08-invites',
    alt: 'A desk with a Canva invitation on a laptop and a pile of printed cards',
    title: 'Invitations and the event page',
    // The quoted “wedding website” names the other products the Event Hub replaces — allowed by
    // `app/public-copy-says-the-house-words.test.ts`, the same exemption /pawebsite carries.
    pain: 'You make the invitation in Canva, send it one by one, and the “wedding website” is foreign and expensive.',
    answer: 'One Event Hub with your invitation, your QR and your details — free, with three free themes.',
    action: 'See an Event Hub',
    href: '/features/event-hub',
    tag: FREE,
  },
  {
    photo: 'problem-09-entourage',
    alt: 'Ninongs and ninangs lining up before the march',
    title: 'Ninong, ninang and the entourage',
    pain: 'Sponsors and the entourage are tracked in chats. Nobody knows their call time or where they walk.',
    answer: 'Each one sees their role, dress code, call time and their place in the march.',
    action: 'See the entourage page',
    href: '/features/wedding-march',
    tag: FREE,
  },
  {
    photo: 'problem-10-family-abroad',
    alt: 'A lola abroad watching the ceremony on a tablet',
    title: 'Family who can’t be there',
    pain: 'Relatives abroad hunt for a stream link and miss the moment.',
    answer: 'The live stream plays right on your Event Hub, where they already are.',
    action: 'Watch a live stream',
    href: '/features/live-watch',
    tag: { kind: 'fine', text: 'Add-on · price in the app' },
  },
  {
    photo: 'problem-11-five-apps',
    alt: 'A host switching between many apps on a laptop and phone',
    title: 'Five apps for one event',
    pain: 'A Filipino event runs on five to eight apps — a spreadsheet, Canva, group chats, a photo app, Facebook Live.',
    answer: 'One link and one account, from the Save the Date to the day after.',
    action: 'See every feature',
    href: '/features',
    tag: FREE,
  },
  {
    photo: 'problem-12-para-kanino',
    alt: 'A daughter planning her parents’ anniversary',
    title: 'Planning for someone else',
    pain: 'The one paying is rarely the one celebrated, and most apps assume it’s your own wedding.',
    answer: 'Plan for yourself, your partner, your kids, your parents, someone who passed — even your business.',
    action: 'See who you can plan for',
    href: '/features',
    tag: FREE,
  },
  {
    photo: 'problem-13-retyping-family',
    alt: 'A mother retyping a family list by hand',
    title: 'The same family, typed again',
    pain: 'Every new event, you type the same family again.',
    answer: 'Save your people once. Every next event starts filled in.',
    action: 'See saved guests',
    href: '/features/guest-list',
    tag: FREE,
  },
  {
    photo: 'problem-14-parts',
    alt: 'Guests at a ceremony and a separate after-party',
    title: 'Not everyone is invited to everything',
    pain: 'Some guests are for the ceremony only, some for the after-party — and the invitation says the same thing to all.',
    answer: 'Each guest sees only the parts they’re invited to.',
    action: 'See invite-by-part',
    href: '/features/guest-list',
    tag: FREE,
  },
  {
    photo: 'problem-15-paperwork',
    alt: 'A couple at a parish office with documents',
    title: 'The papers for your faith',
    pain: 'You find out what the church, civil, INC or Muslim rite needs when it’s almost too late.',
    answer: 'The steps and papers for your faith and your rite, in order.',
    action: 'See the faith steps',
    href: '/features',
    tag: null,
  },
  {
    photo: 'problem-16-face',
    alt: 'A guest covering her face from a phone camera',
    title: 'Guests who don’t want their face shared',
    pain: 'Some guests don’t want their face in anyone’s album.',
    answer: 'They turn on face blur, and their face is blurred everywhere. Never sold.',
    action: 'See face blur',
    href: '/features/papic',
    tag: FREE,
  },
  {
    photo: 'problem-17-live-wall',
    alt: 'A reception screen showing guests’ photos',
    title: 'Photos stuck on phones during the party',
    pain: 'During the party, everyone’s photos stay on their phones.',
    answer: 'Guests’ photos appear on the venue screen as they’re taken.',
    action: 'See the live photo wall',
    href: '/features/papic',
    tag: null,
  },
  {
    photo: 'problem-18-cash-gifts',
    alt: 'A stack of gift envelopes on a reception table',
    title: 'Cash gifts in envelopes',
    pain: 'Envelopes get lost, and family abroad can’t give at all.',
    answer: 'Gifts go straight to your own GCash, Maya, bank or PayPal.',
    action: 'See e-gifts',
    href: '/features/e-gifts',
    tag: FREE,
  },
  {
    photo: 'problem-19-plain-invitation',
    alt: 'A guest opening an invitation on her phone',
    title: 'An invitation that feels like a form',
    pain: 'A link opens to a plain page. There is no moment.',
    answer: 'Guests tap to unveil your invitation, and your music starts.',
    action: 'See the Event Hub',
    href: '/features/event-hub',
    tag: null,
  },
  {
    photo: 'problem-20-wake',
    alt: 'Candles and white flowers at a quiet wake',
    title: 'A wake is not a party',
    pain: 'Event apps feel wrong when a family is grieving.',
    answer: 'A quiet page: no countdown, no games — the family’s words, the nights and the mass. One QR for everyone.',
    action: 'See a wake page',
    href: '/features/event-hub',
    tag: FREE,
  },
];

/** How many problems show before "See all" — the prototype's top five. */
export const SOLVES_SHOWN_FIRST = 5;

/* ─── FOR COORDINATORS ───────────────────────────────────────────────────────────────────────── */

/**
 * The coordinator's day-of tools, and whether each is free TODAY.
 *
 * ⚖ The owner ruled the day-of desks free with no end date (DECISION_LOG 2026-11-04, "DAY-OF DESKS STAY FREE").
 * But the code still paywalls the coordinator's floor kit — the live schedule, the requests inbox, the seat
 * scanner — behind Solo while the free-until date is unset (`lib/vendor-specialization-gate.ts`; CLOUD_BOARD
 * "TRUE-CLAIMS CHECK", 5 Nov). So a row marked `floorKit` says "Free" only while that same gate makes it free
 * (`specializationFreeWindowActive`, read by the caller); the page never promises what the app does not do.
 *
 * ⛔ The prototype's fourth row, "Free voice and video calls — talk to the couple inside the chat", is NOT here:
 * calls left chat on 28 Oct, and a test enforces it.
 */
export const COORDINATOR_TOOLS: readonly { title: string; line: string; floorKit: boolean }[] = [
  { title: 'One login for every event you run', line: 'Each client’s event opens from your dashboard.', floorKit: false },
  { title: 'One schedule, each supplier sees their part', line: 'Suppliers ask for time changes. You approve.', floorKit: true },
  { title: 'Door check-in and the seat scanner', line: 'Scan a pass, see the guest, send them to their seat.', floorKit: true },
];

/* ─── FOR SUPPLIERS ──────────────────────────────────────────────────────────────────────────── */

export const SUPPLIER_TILES: readonly { photo: string; alt: string; label: string; focus: string }[] = [
  { photo: 'supplier-florist', alt: 'A florist arranging orchids for a reception', label: 'Florists', focus: '68% 40%' },
  { photo: 'supplier-caterer', alt: 'Chefs plating a dinner', label: 'Caterers', focus: '50% 50%' },
  { photo: 'supplier-photographer', alt: 'A photographer at a grand entrance', label: 'Photographers', focus: '22% 45%' },
  { photo: 'supplier-makeup', alt: 'A make-up artist with a bride', label: 'Make-up artists', focus: '62% 45%' },
  { photo: 'supplier-videographer', alt: 'A videographer filming from a ladder', label: 'Videographers', focus: '24% 40%' },
  { photo: 'supplier-team', alt: 'A coordinating team checking a booking', label: 'Coordinators', focus: '44% 40%' },
];

export const SUPPLIER_STAGES: readonly { term: string; line: string }[] = [
  { term: 'Just starting?', line: 'Open a shop in two steps — free.' },
  { term: 'New?', line: 'Be found by hosts already planning here.' },
  { term: 'Experienced?', line: 'Keep your clients. Add ours.' },
];

/* ─── WHAT YOU GET ───────────────────────────────────────────────────────────────────────────── */

/**
 * What the three plan cards may say, READ by the caller (Build 6 Lane J — "the plan tables tell the truth"):
 *   · `plusCredits` / `proCredits` — the catalogue's `included_papic_credits` for EVENT_PLUS / COUPLE_WEBSITE_PRO, the
 *     number the activation hook actually tops the event up to (`activateEventPlan`); null = unread → no number said;
 *   · `freePapic` — the live free-credit sentence (`papicFreeCreditPromise`), null when the free grant is off.
 * The theme count is `FREE_THEMES.length` (lib/invite-themes.ts), never typed.
 */
export type PlanFacts = { plusCredits: number | null; proCredits: number | null; freePapic: string | null };

const creditsLine = (n: number | null): string[] =>
  n !== null && n > 0 ? [`${formatCount(n)} Papic credits — ${formatCount(n)} photos from your guests’ phones`] : [];

/** The Free plan's tools, in the four groups the Features hub uses. The count on the card is this list's length. */
export function freeGroups(f: PlanFacts): readonly { name: string; items: readonly string[] }[] {
  return [
    {
      name: 'Plan it',
      items: [
        'Budget',
        'Guest list',
        'Seat plan in 2D and 3D',
        'Schedule',
        'Date picker',
        'Mood board',
        'Find, compare and book suppliers',
      ],
    },
    {
      name: 'Invite & gather',
      items: [
        `Your Event Hub, ${formatCount(FREE_THEMES.length)} themes`,
        'A QR ticket and Apple Wallet pass for every guest',
        'What everyone wears',
        'Wedding march and entourage',
        'E-Gifts',
        'Groups',
        'Your logo and prints',
      ],
    },
    {
      name: 'The day',
      items: [
        'Check-in at the door',
        'The schedule, live',
        f.freePapic ? `Papic cameras on every guest’s phone — ${f.freePapic}` : 'Papic cameras on every guest’s phone',
      ],
    },
    { name: 'Keep the memories', items: ['Memories, kept for life', 'Real Stories'] },
  ];
}

export const FREE_PEEK: readonly string[] = [
  'Guest list, seat plan, budget and schedule',
  'Your Event Hub with a QR pass for every guest',
  'Papic cameras on every guest’s phone',
];

/**
 * Event Plus: what the card shows first, then what it adds beyond Free — ONLY what a paid Event Plus order unlocks in
 * the app today (`activateEventPlan`: Setnayan AI + the included credits; `hubOwnershipFrom`: what was paid counts
 * toward Event Pro). ⚠ Until Lane J the card also sold "All 10 themes · Your own music · Your own web address ·
 * Entrance animation · Only a small Setnayan mark" — a Plus order unlocks none of them (themes, music and the address
 * are Event Hub Pro parts; the watermark comes off with Event Pro only). They come back the day the app grants them.
 */
export function plusPeek(f: PlanFacts): readonly string[] {
  return ['Setnayan AI — tells you what’s next and flags what’s at risk', ...creditsLine(f.plusCredits)];
}
export const PLUS_MORE: readonly string[] = ['What you pay counts toward Event Pro — upgrade for the difference'];

/** Event Pro: what the card shows first, then what it adds beyond Plus. */
export const PRO_PEEK: readonly string[] = [
  'Design every part of your Event Hub — the reveal, background, photos, style, motion, logo & QR, music, prints, the after-the-event page and your address',
  'Your own scenes, your own reveal',
];
/**
 * ⚠ Was "No Setnayan marks — fully yours": today Event Pro takes the watermark off the Event Hub page, while the seat
 * and find-my-table pages still print "Powered by Setnayan" (Lane L builds the marks by plan). Says what is true now.
 */
export function proMore(f: PlanFacts): readonly string[] {
  return ['No Setnayan watermark on your Event Hub', ...creditsLine(f.proCredits)];
}

/** The add-on tiles. Each opens its own feature page, which reads the live price. */
export const ADD_ONS: readonly { photo: string; title: string; line: string; href: string }[] = [
  {
    photo: 'addon-papic',
    title: 'Papic credits',
    line: 'More photos and clips from your guests’ phones — one credit a photo, never expire.',
    href: '/features/papic',
  },
  {
    photo: 'addon-live',
    title: 'Live Watch',
    line: 'Stream the day on your Event Hub, for family who can’t be there.',
    href: '/features/live-watch',
  },
  { photo: 'addon-music', title: 'Music Maker', line: 'A song of your own, made for your event.', href: '/features/music-maker' },
  { photo: 'addon-patiktok', title: 'Patiktok', line: 'Short reels made from your day.', href: '/features/patiktok' },
];
