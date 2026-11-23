/**
 * 📊🎠 The one Analytics carousel's cards — order and fixed windows, pure (no React, no CSS), so guards and the carousel
 * read ONE list. The order is the prototype's option 3 (`prototypes/analytics_option_b_2026-11-11/analytics-option-b.html`).
 */

import { STORE_FIXED_WINDOW } from '@/lib/vendor-store-graphs';

/** The carousel's order — the prototype's option 3, one card per fact. */
// 🎁 'gifts' · 🤝 'invites' — J5 (badge-unlock_v6; specs 7fbff0cd): the graphs Gifts given and Invites Bronze open. "New
// graphs stay at the end of the carousel, marked New." Drawn only when its badge has opened it (lib/graph-unlocks.ts).
// 🛍 'followers' … 'replied' — the Store's twelve new graphs (owner 23 Nov 2026, Supplier Store drawing v10; specs 5a8c6bf3 ·
// 022681cf), appended at the end, marked New (store-graphs.tsx). "Albums opened" has no reader, so it is not here.
export const CARD_ORDER = ['opened', 'asked', 'booked', 'sources', 'cardsell', 'reply', 'replyvs', 'quotes', 'split', 'calendar', 'lost', 'slow', 'rep', 'bench', 'price', 'gifts', 'invites', 'followers', 'saved', 'photos', 'whenask', 'missed', 'value', 'owed', 'lead', 'types', 'revmonth', 'substars', 'replied'] as const;
export type CardKey = (typeof CARD_ORDER)[number];

/**
 * 📌 THE GRAPHS A SHOP HAS WITHOUT ARRANGING — an EXPLICIT list, never a reference to `CARD_ORDER` (owner 23 Nov via the
 * controller and Ship: "nothing a shop sees today disappears"; a NEW graph is "New · Recommended" in the Toolkit and
 * lands on a shop's Analytics only when the shop installs it). These are the 17 a shop saw on 23 Nov. A graph added to
 * `CARD_ORDER` later is NOT added here — so a growing `CARD_ORDER` can never install anything by itself.
 * Every fallback for a missing `store_layout.graphs` reads this (the carousel, `analyticsGraphs`).
 * 🔒 lib/supplier-store.test.ts (1c).
 */
export const DEFAULT_INSTALLED_GRAPHS: readonly CardKey[] = [
  'opened', 'asked', 'booked', 'sources', 'cardsell', 'reply', 'replyvs', 'quotes', 'split',
  'calendar', 'lost', 'slow', 'rep', 'bench', 'price', 'gifts', 'invites',
];

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
  // Month by month (specs 7fbff0cd (10)) — one fixed window, a bar group per month.
  invites: 'Last 12 months',
  // 🛍 The Store's new graphs whose read has one window (the drawing's table) — the one list, lib/vendor-store-graphs.ts.
  ...STORE_FIXED_WINDOW,
};

