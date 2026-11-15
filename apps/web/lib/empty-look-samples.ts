/**
 * 👻 THE EMPTY LOOK'S SAMPLE ROWS — the ONE fixture every greyed-out "Example" reads (owner 2026-11-09, DECISION_LOG
 * 🧱👻 ×2; Build 5 Lane H; approved prototype `prototypes/empty_looks_user_event_2026-11-10/`, its "Sample data lives
 * in one fixture" note).
 *
 * 🔑 WHY ONE FILE. Every empty part of the user dashboard and the event dashboard draws its REAL component with these
 * rows under `ExamplePreview` (`app/_components/states/empty-state.tsx`). Kept here, no page invents its own sample
 * names, the same couple ("Ana & Miguel") is the sample on every screen, and a guard can find every sample by name.
 *
 * ⚠ NOTHING HERE IS ANYBODY'S DATA. Invented names, round invented pesos. Never a real event, never a real supplier,
 * never a price a customer is charged (those are `platform_retail_catalog_v2`'s alone) — the figures only show what
 * the part LOOKS like once it fills, and they are drawn faded under an "Example" chip.
 *
 * 🖼 PHOTOS. The prototype names 29 photo slots under `public/dashboard/empty-looks-2026-11-10/` (Step 0c: the owner's
 * Higgsfield list). Until those files land, each slot wears an image the app already ships (`public/event-types`,
 * `public/marketing/2026-11-04`) — the plan's "sample photo until his files land". Swap a path here; nothing else moves.
 */

/** The sample couple — the one name every Example uses. */
export const SAMPLE_COUPLE = 'Ana & Miguel';

/* ─── USER DASHBOARD (`app/dashboard/(launcher)/page.tsx`) ───────────────────────────────────────────────────── */

export type SampleBoardEvent = {
  id: string;
  /** The event-type key (`public/event-types/<key>.webp`). */
  type: string;
  badge: string;
  name: string;
  /** "Saturday" · "12 December 2026" — the poster's two date lines. */
  weekday: string | null;
  date: string | null;
  place: string;
  /** The card's quiet meta line. */
  meta: string;
  photo: string;
  /** The planning ring, where the shelf draws one. */
  pct?: number;
  remainder?: string;
};

/** Planning — two upcoming events, soonest first (prototype "posterWedding" · "posterDebut"). */
export const SAMPLE_PLANNING: readonly SampleBoardEvent[] = [
  {
    id: 'sample-wedding',
    type: 'wedding',
    badge: 'Wedding',
    name: SAMPLE_COUPLE,
    weekday: 'Saturday',
    date: '12 December 2026',
    place: 'Tagaytay',
    meta: 'Wedding · Saturday 12 December 2026',
    photo: '/event-types/wedding.webp',
    pct: 42,
    remainder: '163 days to go',
  },
  {
    id: 'sample-debut',
    type: 'debut',
    badge: 'Debut',
    name: 'Sofia turns 18',
    weekday: 'Sunday',
    date: '7 March 2027',
    place: 'Quezon City',
    meta: 'Debut · Sunday 7 March 2027',
    photo: '/event-types/debut.webp',
    pct: 12,
    remainder: '248 days to go',
  },
];

/** Now happening · Ended (Untold) · Told — one card each (prototype frame "User · Now happening · Ended · Told"). */
export const SAMPLE_SHELF: Readonly<Record<'now' | 'ended' | 'told', SampleBoardEvent>> = {
  now: {
    id: 'sample-now',
    type: 'wedding',
    badge: 'Wedding · Today',
    name: SAMPLE_COUPLE,
    weekday: null,
    date: null,
    place: 'Tagaytay',
    meta: 'Today',
    photo: '/marketing/2026-11-04/hero-wedding.webp',
  },
  ended: {
    id: 'sample-ended',
    type: 'birthday',
    badge: 'Celebrated',
    name: 'Lolo Ben at 80',
    weekday: null,
    date: null,
    place: 'Cebu',
    meta: 'Jun 14',
    photo: '/marketing/2026-11-04/hero-birthday.webp',
  },
  told: {
    id: 'sample-told',
    type: 'christening',
    badge: 'Told',
    name: 'Our Christening Day',
    weekday: null,
    date: null,
    place: 'Pampanga',
    meta: 'Feb 2',
    photo: '/marketing/2026-11-04/hero-christening.webp',
  },
};

/** Worth planning — two days that come around (prototype "Mama’s 60th" · "Our 10th"). */
export const SAMPLE_MOMENTS: ReadonlyArray<{ label: string; dateLabel: string; countdownLabel: string }> = [
  { label: 'Mama’s 60th birthday', dateLabel: 'Aug 21', countdownLabel: 'in ~9 months' },
  { label: 'Your 10th wedding anniversary', dateLabel: 'Oct 3', countdownLabel: 'in ~11 months' },
];

/* ─── EVENT DASHBOARD (`app/dashboard/[eventId]/…`) ──────────────────────────────────────────────────────────── */

/** Today › To do — three dated tasks (prototype `todo([...])`). */
export const SAMPLE_TODO: ReadonlyArray<{ title: string; when: string }> = [
  { title: 'Book the venue', when: 'due Dec 1' },
  { title: 'Send save-the-dates', when: 'due Jan 10' },
  { title: 'Decide the caterer', when: 'due Jan 20' },
];

/** Today's tiles — each empty tile's NEXT face (prototype "Event · Today", Proposed). */
export const SAMPLE_FACES = {
  guests: { big: '128', unit: 'coming', sm: 'of 180 on the list' },
  hub: { big: 'Save the Date', unit: 'live', sm: 'guests see it' },
  suppliers: { big: '4', unit: 'of 6 booked', sm: '2 still to book' },
  plan: { big: '62%', unit: 'done', sm: 'of the plan', meter: 62 },
  budget: { big: '₱312,000', unit: 'owing', sm: '48% paid · ₱288,000 of ₱600,000', meter: 48 },
  schedule: [
    { k: 'Ceremony · 2:00 PM', v: 'Our Lady of Lourdes · 45 min' },
    { k: 'Reception · 6:00 PM', v: 'Casa Verde Gardens' },
  ],
} as const;

/** Today › Who's here — the team on the dashboard (prototype faces AM · MS · TL). */
export const SAMPLE_TEAM: ReadonlyArray<{ name: string; role: string }> = [
  { name: 'Miguel Santos', role: 'Host' },
  { name: 'Tita Lu', role: 'Coordinator' },
];

/** Guests — two sides of the roster with their reply pills (prototype `guestRows()`). */
export const SAMPLE_GUESTS: ReadonlyArray<{
  section: string;
  side: 'bride' | 'groom';
  rows: ReadonlyArray<{ initials: string; name: string; reply: 'attending' | 'pending' | 'toinvite'; note?: string }>;
}> = [
  {
    section: 'Bride’s side',
    side: 'bride',
    rows: [
      { initials: 'LN', name: 'Lola Nena', reply: 'attending', note: 'Ninang' },
      { initials: 'TB', name: 'Tito Boy & Tita Mely', reply: 'toinvite' },
      { initials: 'MS', name: 'Maria Santos', reply: 'attending', note: 'Maid of honour' },
    ],
  },
  {
    section: 'Groom’s side',
    side: 'groom',
    rows: [
      { initials: 'RD', name: 'Ramon Dizon', reply: 'pending', note: 'Best man' },
      { initials: 'JD', name: 'Joy Dizon', reply: 'attending' },
    ],
  },
];

/** Suppliers › Booked — three booked rows (prototype `bookedRows()`). */
export const SAMPLE_BOOKED: ReadonlyArray<{ initials: string; name: string; service: string; line: string; pill: string }> = [
  { initials: 'CV', name: 'Casa Verde Gardens', service: 'Venue', line: '₱180,000 · first payment paid', pill: 'Booked' },
  { initials: 'LS', name: 'Lumina Studio', service: 'Photo & video', line: '₱85,000', pill: 'Booked' },
  { initials: 'KT', name: 'Kusina ni Tita', service: 'Catering', line: 'no price yet', pill: 'Booked' },
];

/** Schedule › Event Day — three chapters and the time between (prototype `rail([...])`). */
export const SAMPLE_CHAPTERS: ReadonlyArray<{ time: string; name: string; place: string; gap?: string }> = [
  { time: '2:00 PM', name: 'Ceremony', place: 'Our Lady of Lourdes · 45 min', gap: '1 h 15 free' },
  { time: '4:00 PM', name: 'Cocktails', place: 'Garden lawn · 90 min' },
  { time: '6:00 PM', name: 'Reception', place: 'Casa Verde Gardens · 4 h' },
];

/**
 * Budget — the prototype's own sample books (`figures('₱600,000','₱282,899','₱192,899','₱90,000',32)` + `budgetRows()`),
 * kept as numbers so the Example draws through the page's real `BudgetFigures` and `Peso`. They add up: agreed =
 * 180,000 + 85,000 + 2,899 + 15,000; paid = 90,000 + 85,000 + 2,899 + 15,000; owed = the venue's other half.
 * A SAMPLE, never a price: nothing here is read by checkout (`platform_retail_catalog_v2` is the only price).
 */
export const SAMPLE_BUDGET = {
  targetPhp: 600_000,
  agreedPhp: 282_899,
  paidPhp: 192_899,
  owedPhp: 90_000,
  next: { amountPhp: 45_000, name: 'Casa Verde Gardens', dueDate: '2027-01-15' },
  suppliers: [
    { initials: 'CV', name: 'Casa Verde Gardens', service: 'Venue', agreedPhp: 180_000, paidPhp: 90_000, owedPhp: 90_000, dueDate: '2027-01-15' },
    { initials: 'LS', name: 'Lumina Studio', service: 'Photo & video', agreedPhp: 85_000, paidPhp: 85_000, owedPhp: 0, dueDate: null },
  ],
  orders: [{ name: 'Papic 300', bookedOn: '2026-11-02', amountPhp: 2_899 }],
  expenses: [{ initials: 'CD', name: 'Church donation', category: 'Paid outside Setnayan', amountPhp: 15_000 }],
} as const;

/** Memories — eight grid tiles (prototype `memGrid(true)`, slots 21–28), until the owner's files land. */
export const SAMPLE_MEMORIES: readonly string[] = [
  '/marketing/2026-11-04/hero-wedding.webp',
  '/event-types/wedding.webp',
  '/marketing/2026-11-04/real-sister.webp',
  '/event-types/debut.webp',
  '/marketing/2026-11-04/real-cousin.webp',
  '/marketing/2026-11-04/hero-debut.webp',
  '/event-types/anniversary.webp',
  '/marketing/2026-11-04/hero-reunion.webp',
];

/** The Hub — the miniature of the couple's own page while no address exists (prototype slot 29). */
export const SAMPLE_HUB = {
  photo: '/event-types/wedding.webp',
  title: SAMPLE_COUPLE,
  line: 'Save the date · 12 · 12 · 2026',
  address: 'setnayan.com/ana-and-miguel',
  /** The four facts as the prototype's sample stage prints them — inside the Example only, never in the real facts. */
  facts: [
    ['Address', 'setnayan.com/ana-and-miguel'],
    ['Date', 'Dec 12'],
    ['Guests', '180'],
    ['Replied', '128'],
  ],
} as const;

/* ─── SUPPLIER PORTFOLIO (`app/vendor-dashboard/collections/_components/collections-list.tsx`) ─────────────────────── */

/**
 * 🖼 PORTFOLIO — one sample tile per collection section, drawn under an "Example" chip while that section is EMPTY
 * (owner 11 Nov, "SUPPLIER ASKS b–e ANSWERED" (c) "yes": every collection kept, a placeholder / Example tile when empty;
 * approved prototype `shop_discounts_bundle_card_open_2026-11-09/portfolio.html`). Invented names, shipped stock photos.
 */
export type SamplePortfolioTile = { name: string; sub: string; photo: string };

export const SAMPLE_PORTFOLIO: Readonly<Record<string, SamplePortfolioTile>> = {
  best: { name: 'Most viewed', sub: 'Your best work', photo: '/marketing/2026-11-04/hero-wedding.webp' },
  page: { name: 'Cover', sub: '14 photos', photo: '/marketing/2026-11-04/hero-wedding.webp' },
  cards: { name: 'Wedding photo & video', sub: '6 photos', photo: '/event-types/wedding.webp' },
  albums: { name: SAMPLE_COUPLE, sub: '48 photos · 12 Dec', photo: '/marketing/2026-11-04/real-sister.webp' },
  own: { name: 'Your own shots', sub: '18 photos', photo: '/event-types/debut.webp' },
  delivered: { name: SAMPLE_COUPLE, sub: '60 photos', photo: '/marketing/2026-11-04/real-cousin.webp' },
  instagram: { name: 'Instagram', sub: '24 posts', photo: '/marketing/2026-11-04/hero-debut.webp' },
  moodboard: { name: 'Garden gold', sub: '2 looks', photo: '/event-types/anniversary.webp' },
  inspiration: { name: 'Reception styling', sub: '5 photos', photo: '/event-types/birthday.webp' },
  songs: { name: 'Your repertoire', sub: '24 songs', photo: '/event-types/concert.webp' },
  stories: { name: SAMPLE_COUPLE, sub: 'Tagaytay · Dec 2026', photo: '/marketing/2026-11-04/hero-reunion.webp' },
  video: { name: 'Same-day edit', sub: 'YouTube', photo: '/event-types/wedding.webp' },
};
