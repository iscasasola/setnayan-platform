import type { CardSell, LostDates, MonthCount, QuoteStates, ReplyVsBooked } from '@/lib/vendor-analytics-graphs';
import type { SourceRow } from './growth-view';

/**
 * 🧪 THE EXAMPLE PICTURES (Build 5 Lane H's empty state, carried into Build 6 Lane I's tiles) — what an EMPTY graph
 * draws, faded and marked "Example", so a new shop sees the shape of what will fill in. Never a real shop's number,
 * never drawn for a refused read (that says "Couldn’t load"), never fed to a recommendation (`RecBox` only reads a
 * rule on an `ok` tile). 🔒 performance/every-graph-is-a-tile.test.ts
 */
const LOST: LostDates = {
  byWeekday: [
    { closed: 0, full: 0 },
    { closed: 0, full: 0 },
    { closed: 0, full: 1 },
    { closed: 1, full: 0 },
    { closed: 1, full: 2 },
    { closed: 4, full: 3 },
    { closed: 2, full: 1 },
  ],
  closed: 8,
  full: 7,
  total: 15,
  topClosedDay: 'Saturday',
};

const CARDSELL: CardSell[] = [
  { serviceId: 'ex-1', name: 'Full-day coverage', asked: 14, booked: 4 },
  { serviceId: 'ex-2', name: 'Half-day coverage', asked: 9, booked: 1 },
  { serviceId: 'ex-3', name: 'Same-day edit', asked: 5, booked: 2 },
];

const REPLYVS: ReplyVsBooked = { fast: { n: 12, booked: 5 }, slow: { n: 10, booked: 1 } };

const SLOW: MonthCount[] = [
  ['Nov', 3],
  ['Dec', 5],
  ['Jan', 2],
  ['Feb', 0],
  ['Mar', 4],
  ['Apr', 3],
  ['May', 1],
  ['Jun', 0],
  ['Jul', 1],
  ['Aug', 2],
  ['Sep', 3],
  ['Oct', 4],
].map(([label, count], i) => ({ key: `ex-${i}`, label: label as string, count: count as number }));

const QUOTES: QuoteStates = { accepted: 4, waiting: 3, expired: 2, declined: 1, sent: 10 };

export const GRAPH_SAMPLE = {
  sources: [
    { key: 'ex-search', label: 'Setnayan search', count: 42 },
    { key: 'ex-link', label: 'Your shop link', count: 18 },
    { key: 'ex-browse', label: 'Browsing a category', count: 11 },
  ] as SourceRow[],
  cardsell: CARDSELL,
  reply: { minutes: 38, answered: 3 },
  replyvs: REPLYVS,
  quotes: QUOTES,
  split: { setnayan: 6, own: 3 },
  calendar: {
    booked: [
      { at: 5, many: false },
      { at: 12, many: true },
      { at: 26, many: false },
      { at: 40, many: false },
      { at: 54, many: true },
    ],
    waiting: [12, 33, 54],
  },
  lost: LOST,
  slow: SLOW,
  rep: { rating: 4.8, count: 12 },
  bench: [
    { title: 'Reply rate', pct: 72, word: 'Top quarter' },
    { title: 'Reply time', pct: 55, word: 'Above the middle' },
    { title: 'Inquiry → booking', pct: 40, word: 'Below the middle' },
  ],
  price: { at: 58 },
};
