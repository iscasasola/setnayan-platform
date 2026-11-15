/**
 * 📊🎠 The one Analytics carousel's cards — order and fixed windows, pure (no React, no CSS), so guards and the carousel
 * read ONE list. The order is the prototype's option 3 (`prototypes/analytics_option_b_2026-11-11/analytics-option-b.html`).
 */

/** The carousel's order — the prototype's option 3, one card per fact. */
// 🎁 'gifts' — J5 (badge-unlock_v6): the graph Gifts given Bronze opens. "New graphs stay at the end of the carousel,
// marked New." A card here is drawn only when its badge has opened it (lib/graph-unlocks.ts).
export const CARD_ORDER = ['opened', 'asked', 'booked', 'sources', 'cardsell', 'reply', 'replyvs', 'quotes', 'split', 'calendar', 'lost', 'slow', 'rep', 'bench', 'price', 'gifts'] as const;
export type CardKey = (typeof CARD_ORDER)[number];

/**
 * Cards whose window is FIXED — a label, no switch. The five are the prototype's; "How fast you answer" joins them
 * because its read (the shop's reply median, `vendor_activity_stats`) exists only over the last 12 months — a switch
 * there would offer a 30-day number we do not have.
 */
export const FIXED_WINDOW: Readonly<Partial<Record<CardKey, string>>> = {
  reply: 'Last 12 months',
  calendar: 'Next 13 weeks',
  slow: 'Next 12 months',
  rep: 'All time',
  bench: 'Your category · region',
  price: 'Your service · region',
};

