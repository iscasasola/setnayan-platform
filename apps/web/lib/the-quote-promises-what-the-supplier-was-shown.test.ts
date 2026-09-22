/**
 * the-quote-promises-what-the-supplier-was-shown.test.ts — ONE RULE, BOTH
 * SCREENS. The photo count the supplier reads while writing a quote is the
 * photo count the couple reads while deciding on it.
 *
 * ── THE DEFECT, MEASURED ON origin/main 2026-09-22 ─────────────────────────
 * The per-quote gift switch (migration 20271240324859) is read by SQL
 * `setnayan_gift_offered_on` only once the quote is ACCEPTED — correctly, since
 * the BILL must follow what the couple actually accepted. But the couple's
 * quote page asked that same question, so:
 *
 *   status=sent    switch=ON card=OFF → offered_on=false → arm card_says_no
 *                                     → the page said NOTHING
 *
 * while the composer, which applies the switch itself, read *"Includes your
 * Setnayan gift — N free Papic photos"*. Two screens, one quote, opposite
 * answers, and neither errored.
 *
 * ⚖ Owner 2026-09-09: *"the NUMBER appears on the QUOTE … a gift named at the
 * moment of decision closes; a gift revealed after booking is only a
 * thank-you."* The product was shipping the thank-you.
 *
 * ── WHY THIS FILE IS SHAPED LIKE THIS ──────────────────────────────────────
 * `lib/setnayan-gift.server.ts` carries `server-only`, which a plain
 * `node:test` cannot import. So the part that can be got wrong — which arm a
 * switch leaves behind, and whether a basis reaches the couple — lives in the
 * PURE pair `standingForGiftArm` → `standingForQuoteSwitch` → `giftBasisFrom`,
 * and is EXECUTED below across the whole matrix. The server file and the
 * composer are then pinned to that same pair by name, so neither can grow a
 * second spelling of the rule.
 *
 * 🛡 Sabotages watched red (listed per test).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  standingForGiftArm,
  standingForQuoteSwitch,
  giftBasisFrom,
  type PapicQuoteStanding,
} from './papic-on-a-quote';
import { BOOKING_FEE } from './booking-fee';
import type { GiftQuoteBasis } from './setnayan-gift';

const LADDER = [
  { credits: 1_000, priceCentavos: 70_000 },
  { credits: 2_000, priceCentavos: 140_000 },
  { credits: 50_000, priceCentavos: 1_500_000 },
];
const BASIS: GiftQuoteBasis = { schedule: BOOKING_FEE, ladder: LADDER };

/** What a surface ends up promising: a basis (⇒ a photo count) or nothing. */
const promises = (arm: string, quoteSwitch: boolean | null): boolean =>
  giftBasisFrom(standingForQuoteSwitch(standingForGiftArm(arm, BASIS), quoteSwitch)) !== null;

test('THE FIX — a SENT quote with the switch on promises the couple the photos', () => {
  // `card_says_no` is precisely what the database returns for a quote that is
  // not yet accepted while the card is off: the booking does not carry the
  // gift YET, and the quote is what says it will.
  assert.equal(promises('card_says_no', true), true, 'the couple is told, at the moment of decision');
  assert.equal(promises('applies', null), true, 'a booking that already carries it is unchanged');
  // sabotage: drop the `standingForQuoteSwitch` call from the chain → RED
});

test('the switch withdraws as well as it promises — and silence stays silent', () => {
  assert.equal(promises('card_says_no', false), false, 'switched off ⇒ nothing promised');
  assert.equal(promises('card_says_no', null), false, 'said nothing ⇒ the card still answers (off)');
  assert.equal(promises('applies', false), false, 'switching off overrides a card that says yes');
});

test('⛔ a switch CANNOT conjure a gift out of an arm that carries no fee to size one from', () => {
  for (const arm of ['no_booking', 'free_booking', 'not_sourced', 'nonsense_arm']) {
    assert.equal(promises(arm, true), false, `${arm} must stay silent even switched ON`);
    assert.equal(promises(arm, false), false, `${arm} must stay silent switched OFF`);
  }
  // sabotage: `if (switchOn) return { kind: 'included', basis }` unconditionally → RED
});

test('THE WHOLE MATRIX — arm × switch, one table, no exceptions', () => {
  const arms = ['applies', 'card_says_no', 'free_booking', 'not_sourced', 'no_booking'];
  const rows = arms.flatMap((arm) =>
    [true, false, null].map((sw) => `${arm}/${String(sw)}=${promises(arm, sw) ? 'promise' : 'silent'}`),
  );
  assert.deepEqual(rows, [
    'applies/true=promise', 'applies/false=silent', 'applies/null=promise',
    'card_says_no/true=promise', 'card_says_no/false=silent', 'card_says_no/null=silent',
    'free_booking/true=silent', 'free_booking/false=silent', 'free_booking/null=silent',
    'not_sourced/true=silent', 'not_sourced/false=silent', 'not_sourced/null=silent',
    'no_booking/true=silent', 'no_booking/false=silent', 'no_booking/null=silent',
  ]);
});

/* ── The two surfaces run THAT rule, and do not re-implement it ─────────── */

const ROOT = join(__dirname, '..');
const server = readFileSync(join(ROOT, 'lib/setnayan-gift.server.ts'), 'utf8');
const maker = readFileSync(join(ROOT, 'app/_components/proposal-maker.tsx'), 'utf8');
const page = readFileSync(join(ROOT, 'app/proposals/[publicId]/page.tsx'), 'utf8');

test('the COUPLE\'s side resolves through the shared pair, and reads the quote\'s own switch', () => {
  /*
    ⚠ SCOPED TO `quoteSetnayanGift`'S OWN BODY, for the reason
    `the-gift-reaches-the-couple.test.ts` already states about this file: the
    sibling `giftQuoteBasis` below it repeats the same eligibility shape —
    including the `applies !== 'applies'` early return this fix removes — and a
    match there must not stand in for this one. (That sibling has NO live
    caller today; it is reported for separate removal, not widened into here.)
  */
  const from = server.indexOf('export async function quoteSetnayanGift');
  assert.ok(from > 0, 'quoteSetnayanGift no longer exists under this name');
  const to = server.indexOf('export async function', from + 1);
  assert.ok(to > from, 'there is a function after it to bound the slice');
  const body = server.slice(from, to);

  assert.match(body, /standingForQuoteSwitch\(\s*standingForGiftArm\(arm,/, 'the one rule, in order');
  assert.match(body, /giftBasisFrom\(standing\)/, 'and the unchanged contract that gates the promise');
  assert.match(body, /quoteSwitch\?: boolean \| null;/, 'the switch is an input');
  // the arm the switch can move must not be short-circuited before the ladder is read
  assert.match(body, /arm !== 'applies' && arm !== 'card_says_no'/, "'card_says_no' must survive to be switched");
  assert.doesNotMatch(body, /applies !== 'applies'/, 'the old early return is gone from THIS function');
  // sabotage: restore `if (applies !== 'applies') return null` here → RED
});

test('the SUPPLIER\'s side runs the same function — neither screen has a second spelling', () => {
  assert.match(maker, /standingForQuoteSwitch\(papicStanding, giftSwitch\)/);
  for (const [name, src] of [['server', server], ['composer', maker]] as const) {
    assert.doesNotMatch(
      src,
      /kind: 'included'[\s\S]{0,80}kind: 'available'/,
      `${name} appears to re-implement the arm move by hand`,
    );
  }
});

test('the quote page passes ITS OWN quote\'s switch — not the booking\'s', () => {
  assert.match(page, /quoteSwitch: proposal\.includes_setnayan_gift \?\? null,/);
  assert.match(page, /includes_setnayan_gift'?,?\s*$|includes_setnayan_gift',/m, 'and selects the column');
  assert.match(page, /includes_setnayan_gift: boolean \| null;/, 'and types it');
  // sabotage: drop the column from the select → the field is undefined → `?? null`
  // silently reverts to pre-fix behaviour, which is why the select is asserted too.
});

test('BOTH SEND PATHS write the column — one panel must not carry two answers', () => {
  const send = readFileSync(join(ROOT, 'lib/proposal-send.ts'), 'utf8');
  const writes = send.match(/includes_setnayan_gift: input\.includesSetnayanGift \?\? null,/g) ?? [];
  assert.equal(writes.length, 2, 'the line-item builder AND the saved-template shortcut');
  assert.doesNotMatch(send, /includesSetnayanGift \?\? false/, 'null is the honest default, never a silent "off"');
});

/* ── No number is ever written down ─────────────────────────────────────── */

test('nothing here or on either surface hard-codes a photo count or a peso figure', () => {
  const standings: PapicQuoteStanding[] = [
    { kind: 'included', basis: BASIS },
    { kind: 'available', basis: BASIS },
  ];
  for (const s of standings) {
    const basis = giftBasisFrom(standingForQuoteSwitch(s, true));
    if (basis) assert.equal(basis.ladder, LADDER, 'the ladder is carried, never re-derived');
  }
  // the fix must not introduce a literal count anywhere it renders
  assert.doesNotMatch(server, /1[,_]?021|2[,_]?411/);
  assert.doesNotMatch(page, /1[,_]?021|2[,_]?411/);
});
