/**
 * ⏳ WHAT THE BADGES & SEALS PAGE CANNOT SHOW YET — ONE LIST (slice 1, 15 Nov 2026; carried from #7827 into
 * Money › Offers & gifts by the admin reorg, 17 Nov — the five badges' tiers now read through #7807's adapter).
 *
 * Each row names the engine it waits on, so the page says "not yet built" instead of drawing sample shops, a guessed
 * rank or a ₱0. When an engine lands, its entry here is DELETED and the page reads the real thing — the guard
 * (`the-badge-page-is-honest.test.ts`) fails while an entry stays here after its engine is on `main`, and fails if the
 * page ever renders a sample shop from the drawing.
 *
 * Engines (controller 15 Nov): J0 ladder & firing #7753 · J4's one adapter #7807 · J2 seals · J3 card badges. PURE.
 */
export type BadgeLedgerView = 'seals' | 'shops' | 'rewards';

type Row = { key: string; title: string; line: string };

export const NOT_YET_BUILT = {
  seals: [
    { key: 'top10', title: 'Top 10 & No. 1', line: 'Not yet built — the seals engine (J2). Ranked by review score among shops with 10+ events this year.' },
    { key: 'clients-choice', title: 'Clients’ Choice', line: 'Not yet built — the seals engine (J2). The most second bookings this year, among shops with 10+ events.' },
    { key: 'most-in-demand', title: 'Most In-Demand', line: 'Not yet built — the seals engine (J2). The top 10% of shops by completed bookings this year.' },
    { key: 'verified-partner', title: 'Verified Partner', line: 'Not yet built — the seals engine (J2). Given the day all its checks hold; kept for life.' },
  ] as readonly Row[],
  lock: {
    line: 'Not yet built — the 18 Dec lock waits on the seals engine (J2), and on a write door for holds (asked on the PR).',
  },
  shops: [
    { key: 'medals', title: 'Card medals', line: 'Not yet built — the six service-card medals over the last 30 days (J3).' },
  ] as readonly Row[],
  queue: {
    short: 'per shop',
    line: 'Per shop — pick a shop under Shops to see the rewards it has earned and not yet been given.',
  },
  holds: {
    short: 'not yet built',
    line: 'Not yet built — holding a reward or a Top 10 place needs a write door (asked on the PR).',
  },
} as const;
