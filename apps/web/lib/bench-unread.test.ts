/**
 * THE BADGE COUNTS SUPPLIERS, AND SAYS NOTHING WHEN IT DOES NOT KNOW.
 *
 * Two properties carry this slice, and both are the NEGATIVE kind — the sort a
 * badge can get wrong while looking perfectly correct on screen:
 *
 *   1. **One supplier on several cards is ONE count in the totals.** Unread is per
 *      thread, i.e. per supplier, but a venue package that covers catering, cake
 *      and accommodation renders as a linked copy in each tile. Summing per card
 *      turns one message into a folder total of 3 — and every number on the page
 *      still looks like a number.
 *   2. **A refused read draws NO badge, not a "0" badge.** This is the surface
 *      where "we could not check" and "your inbox is clear" are byte-identical.
 *
 * The dedupe rule is reused, not invented: `shortlist-taxonomy.ts` already says
 * "A linked copy is the same booking shown again — count suppliers, not cards"
 * and filters `includedWith == null`, and `vendors/page.tsx` does the same.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UNREAD_UNKNOWN,
  benchUnreadFrom,
  cardUnread,
  rollupUnread,
  unreadBadgeAria,
  unreadBadgeLabel,
} from './bench-unread';

const measured = (pairs: Array<[string, number]>) =>
  benchUnreadFrom({ countByThread: new Map(pairs), error: null, complete: true });

/** Seda covers three categories: one supplier, three cards, one thread. */
const SEDA_ON_THREE_CARDS = [
  { threadId: 'T-seda', includedWith: null }, // the home card
  { threadId: 'T-seda', includedWith: 'Venues' }, // linked copy in Catering & cake
  { threadId: 'T-seda', includedWith: 'Venues' }, // linked copy in Accommodation
];

test('🪤 one supplier on three cards is ONE count in the total', () => {
  const u = measured([['T-seda', 1]]);
  assert.equal(
    rollupUnread(SEDA_ON_THREE_CARDS, u),
    1,
    'summing per card would report 3 for a single message — the defect the drawing would have shipped',
  );
});

test('🪤 …but the badge STILL shows on the linked card — only totals dedupe', () => {
  // A couple looking at the Catering card should see there is something to read.
  const u = measured([['T-seda', 2]]);
  for (const card of SEDA_ON_THREE_CARDS) {
    assert.equal(cardUnread(u, card.threadId), 2, 'every card of that supplier shows its unread');
  }
  assert.equal(rollupUnread(SEDA_ON_THREE_CARDS, u), 2, 'the total still counts the supplier once');
});

test('the folder total equals the sum over SUPPLIERS across a 100-card fixture', () => {
  // 40 distinct suppliers, 1 unread each; every third also appears as a linked
  // copy, so the card count is well above the supplier count.
  const suppliers = Array.from({ length: 40 }, (_, i) => `T-${i}`);
  const cards: Array<{ threadId: string; includedWith: string | null }> = [];
  for (const [i, t] of suppliers.entries()) {
    cards.push({ threadId: t, includedWith: null });
    if (i % 3 === 0) cards.push({ threadId: t, includedWith: 'Venues' });
    if (i % 9 === 0) cards.push({ threadId: t, includedWith: 'Venues' });
  }
  const u = measured(suppliers.map((t) => [t, 1] as [string, number]));
  assert.ok(cards.length > 40, `fixture must have more cards than suppliers (has ${cards.length})`);
  assert.equal(rollupUnread(cards, u), 40, 'one per SUPPLIER, whatever the card count');
});

test('🪤 an UNMEASURED read produces null everywhere — never a zero', () => {
  for (const u of [
    UNREAD_UNKNOWN,
    benchUnreadFrom({ countByThread: new Map([['T-a', 5]]), error: 'permission denied', complete: true }),
    benchUnreadFrom({ countByThread: new Map([['T-a', 5]]), error: null, complete: false }),
  ]) {
    assert.equal(cardUnread(u, 'T-a'), null, 'a card must not claim a number it did not read');
    assert.equal(rollupUnread([{ threadId: 'T-a', includedWith: null }], u), null);
    assert.equal(unreadBadgeLabel(cardUnread(u, 'T-a')), null, 'and there is no string, so no badge');
    assert.equal(unreadBadgeAria(cardUnread(u, 'T-a')), null);
  }
});

test('🪤 a TRUNCATED read is unmeasured even though it carries rows', () => {
  // complete:false means the server had more than we fetched. The rows present
  // are real, but the total built from them is WRONG — worse than no total.
  const u = benchUnreadFrom({ countByThread: new Map([['T-a', 3]]), error: null, complete: false });
  assert.equal(u.measured, false);
  assert.equal(cardUnread(u, 'T-a'), null, 'a partial answer must not render as the answer');
});

test('a genuinely clear inbox is a MEASURED zero, and draws no badge either', () => {
  const u = measured([]);
  assert.equal(u.measured, true);
  assert.equal(cardUnread(u, 'T-a'), 0, 'zero is known here, unlike the unmeasured case');
  assert.equal(rollupUnread([{ threadId: 'T-a', includedWith: null }], u), 0);
  // 🔑 Same blank screen as the unmeasured case, reached honestly. The
  // difference is that nothing false was rendered in either.
  assert.equal(unreadBadgeLabel(0), null, 'a "0" badge is unrepresentable');
});

test('a supplier with no thread is a known zero, not an unknown', () => {
  const u = measured([['T-a', 4]]);
  assert.equal(cardUnread(u, null), 0, 'no thread → nothing can be unread in it');
  assert.equal(rollupUnread([{ threadId: null, includedWith: null }], u), 0);
});

test('the badge never renders a zero or a negative, whatever it is handed', () => {
  for (const n of [0, -1, -99, Number.NaN, null]) {
    assert.equal(unreadBadgeLabel(n as number | null), null, `unreadBadgeLabel(${String(n)})`);
  }
  assert.equal(unreadBadgeLabel(1), '1');
  assert.equal(unreadBadgeLabel(99), '99');
  assert.equal(unreadBadgeLabel(100), '99+', 'the corner badge caps rather than resizing the card');
  assert.equal(unreadBadgeLabel(4821), '99+');
});

test('the screen-reader text agrees with the badge, and pluralises', () => {
  assert.equal(unreadBadgeAria(1), '1 unread message');
  assert.equal(unreadBadgeAria(2), '2 unread messages');
  // Past the cap the aria text keeps the TRUE number — a screen reader has no
  // width limit, and "99+ unread" tells someone less than "134 unread" does.
  assert.equal(unreadBadgeAria(134), '134 unread messages');
  assert.equal(unreadBadgeAria(0), null, 'no badge → nothing announced');
});

test('opening one thread clears that supplier everywhere they appear', () => {
  // The clearing act is opening the conversation, which marks the notifications
  // read; the next render simply has no rows for that thread. Modelled here as
  // the map losing the key — every card of that supplier must go quiet at once.
  const before = measured([['T-seda', 2], ['T-other', 1]]);
  assert.equal(rollupUnread(SEDA_ON_THREE_CARDS, before), 2);
  const after = measured([['T-other', 1]]);
  for (const card of SEDA_ON_THREE_CARDS) {
    assert.equal(cardUnread(after, card.threadId), 0, 'all three of that supplier’s cards clear together');
  }
  assert.equal(rollupUnread(SEDA_ON_THREE_CARDS, after), 0);
});
