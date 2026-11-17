/**
 * 🔒 THE CLIENT WORKSPACE SAYS WHAT IS TRUE (owner screenshots 17 Nov 2026, the supplier's client "Debut 18" on the #7901
 * preview — Details and Quotation tabs). Each fault, held by what it DRAWS:
 *
 *   7  · AN UNPRICED TRANSPORT LINE IS NOT FREE — "Transportation · Quoted after site check" read "Complimentary" in the
 *        price column. `quoteLinePriceWords` is the one rule; every drawn quote line uses it.
 *   8  · NO COUNT IS NOT 100 — Quotation said "On their list 100" while the event has no estimate, no final count and no
 *        guests (the 100 is the thread page's stand-in seed). With no real count the row says "No count yet".
 *   9  · held in `no-all-paid-without-a-booking.test.ts` (Details reads the plan: ₱0 paid · ₱5,350 overdue).
 *   10 · "BOOKED" IS SAID ONCE — the category chips said "Booked · In-house" beside the stage pill's "Booked".
 *   11 · THE PAYMENT-METHOD PROMPT SHOWS ONCE — on the client workspace's Chat page the quote card no longer repeats the
 *        prompt Details already shows.
 *   13 · A LONG LINE TITLE ENDS IN "…" BEFORE THE PRICE — the title shrinks, the price never does.
 *   +  · THE CLIENT TABS SPEAK IN SENTENCE CASE (prototypes/dashboards_clean_look_2026-11-16_fable.html) — Your locks,
 *        Hosts · in your shared chat, Start from, Name of the quotation, Following their guest list, Pick service cards.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 17 Nov 2026) is listed in the PR body, one line per test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { QUOTED_AFTER_SITE_CHECK, quoteLineDetailWords, quoteLinePriceWords } from './quote-line-price-words';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CLIENT = 'app/vendor-dashboard/clients/[eventId]';

test('7 · an unpriced transport line says it is quoted after the site check — never "Complimentary"', () => {
  const transport = { label: 'Transportation', detail: QUOTED_AFTER_SITE_CHECK, amount_centavos: null };
  assert.equal(quoteLinePriceWords(transport), 'Quoted after site check');
  assert.equal(quoteLineDetailWords(transport), null, 'the detail is not said twice');
  assert.equal(quoteLinePriceWords({ detail: null, amount_centavos: null }), 'Complimentary', 'anti-vacuity: a freebie is still free');
  assert.match(quoteLinePriceWords({ detail: QUOTED_AFTER_SITE_CHECK, amount_centavos: 150000 }), /1,500/, 'a priced line shows its price');

  for (const f of [
    'app/_components/quote-card-lines.tsx',
    'app/_components/quote-versions-sheet.tsx',
    'app/admin/disputes/_components/quote-versions-evidence.tsx',
  ]) {
    const src = read(f);
    assert.match(src, /quoteLinePriceWords\(li\)/, `${f} draws its own price words`);
    assert.doesNotMatch(src, /amount_centavos[^\n]*\?[^\n]*'Complimentary'/, `${f} still says Complimentary for any line with no amount`);
  }
  const maker = read('app/_components/proposal-maker.tsx');
  assert.match(maker, /detail: QUOTED_AFTER_SITE_CHECK/, 'the maker writes the transport line with the shared words');
});

test('8 · with no real count the Quotation says "No count yet", and the thread page says when the count is real', () => {
  const maker = read('app/_components/proposal-maker.tsx');
  const row = maker.slice(maker.indexOf('data-quote-live-pax='), maker.indexOf('data-quote-live-pax=') + 200);
  assert.match(row, /\{paxKnown \? formatCount\(seedPax\) : 'No count yet'\}/, 'the row draws the stand-in seed as their list');
  assert.match(maker, /paxKnown = true,/);
  const thread = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.match(thread, /paxKnown=\{thread\.pax_at_inquiry != null \|\| headerPax != null\}/, 'the thread page never says whether the count is real');
});

test('10 · the category chips never say "Booked" — the stage pill does', () => {
  const page = read(`${CLIENT}/page.tsx`);
  const chip = page.slice(page.lastIndexOf('<span', page.indexOf('{displayServiceLabel(c)}')), page.indexOf('{displayServiceLabel(c)}') + 40);
  assert.ok(chip.length > 60, 'anti-vacuity: the category chip moved');
  assert.doesNotMatch(chip, /Booked/, 'the chip says Booked again');
});

test('11 · on the client Chat page the quote card does not repeat the payment-method prompt', () => {
  const stream = read('app/_components/chat-message-stream.tsx');
  const at = stream.indexOf('<PayoutMethodNudge');
  assert.ok(at > 0, 'anti-vacuity: the nudge left the stream');
  assert.match(stream.slice(at - 300, at), /!inPicked &&/, 'the quote card draws the prompt inside the client workspace too');
  const details = read(`${CLIENT}/page.tsx`);
  assert.match(details, /<PayoutMethodNudge readiness=\{payoutReadiness\} context="client" \/>/, 'Details lost its one prompt');
});

test('13 · a long line title ends in "…" before the price, and the price never shrinks', () => {
  const maker = read('app/_components/proposal-maker.tsx');
  const title = maker.slice(maker.indexOf('data-quote-line-title=""'), maker.indexOf('data-quote-line-title=""') + 200);
  assert.match(title, /min-w-0 flex-1 truncate/, 'the line title does not truncate');
  const price = maker.slice(maker.lastIndexOf('<span', maker.indexOf('data-quote-line-price=""')), maker.indexOf('data-quote-line-price=""'));
  assert.match(price, /\bshrink-0\b/, 'the price can be squeezed under the title');
  const sheet = read('app/_components/quote-versions-sheet.tsx');
  assert.match(sheet, /min-w-0 flex-1 truncate text-ink">\{li\.label\}/);
});

test('+ · the client tabs speak in sentence case', () => {
  const maker = read('app/_components/proposal-maker.tsx');
  const fn = maker.slice(maker.indexOf('data-quote-section={id}'), maker.indexOf('data-quote-section-head='));
  assert.ok(fn.length > 50, 'anti-vacuity: the quote section heading moved');
  assert.doesNotMatch(fn, /\buppercase\b|border-b border-ink\/10/, 'the Quotation headings are mono caps or split by lines');
  assert.doesNotMatch(maker, /const lbl = '[^']*\buppercase\b/, 'the Quotation field labels are mono caps');
  for (const f of [
    `${CLIENT}/_components/supplier-locks-section.tsx`,
    `${CLIENT}/_components/hosts-list.tsx`,
    `${CLIENT}/_components/details-forms-door.tsx`,
    `${CLIENT}/_components/details-decisions.tsx`,
    `${CLIENT}/_components/suppliers-list.tsx`,
    `${CLIENT}/_components/picked-client-settings.tsx`,
    `${CLIENT}/_components/payment-asks-panel.tsx`,
    `${CLIENT}/_components/client-refunds.tsx`,
    `${CLIENT}/_components/customer-money-fold.tsx`,
    `${CLIENT}/_pages/payment.tsx`,
    `${CLIENT}/_pages/files.tsx`,
  ]) {
    const src = read(f);
    assert.ok(src.length > 300, `anti-vacuity: ${f} is empty`);
    assert.doesNotMatch(src, /\bhome-k2\b/, `${f} still uses the uppercase section label`);
    assert.doesNotMatch(src, /(className="|')[^"'\n]*\buppercase tracking-\[0\.(08|12)em\][^"'\n]*text-ink\/70/, `${f} still draws an uppercase heading`);
  }
});
