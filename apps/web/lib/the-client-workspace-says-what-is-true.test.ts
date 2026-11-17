/**
 * 🔒 THE CLIENT WORKSPACE SAYS WHAT IS TRUE (owner screenshots 17 Nov 2026, the supplier's client "Debut 18" on the #7901
 * preview — Details and Quotation tabs). Each fault, held by what it DRAWS:
 *
 *   7  · AN UNPRICED TRANSPORT LINE IS NOT FREE — "Transportation · Quoted after site check" read "Complimentary" in the
 *        price column. `quoteLinePriceWords` is the one rule; every drawn quote line uses it.
 *   8  · NO COUNT IS NOT 100 — Quotation said "On their list 100" while the event has no estimate, no final count and no
 *        guests (the 100 is the thread page's stand-in seed). With no real count the row says "No count yet".
 *   9  · held in `no-all-paid-without-a-booking.test.ts` (Details reads the plan: ₱0 paid · ₱5,350 overdue).
 *   3b · THE PAYMENT PAGE AGREES — its Next line said "Next ₱5,350 · Nov 13" while Details and Chat said overdue;
 *        one rule, `isPastDue`, now decides all three.
 *   4b · THE FORMS DOOR NAMES THE EVENT — "Forms · sent to this couple" on a debut; it says the event's name, as the
 *        Forms page does.
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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { QUOTED_AFTER_SITE_CHECK, quoteLineDetailWords, quoteLinePriceWords } from './quote-line-price-words';
import { quoteChanges, versionsSideBySide, type QuoteSide, type QuoteVersion } from './quote-versions';
import { isPastDue } from './chat-plan-fold';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}
const h = React.createElement;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

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
  // The maker's one "Complimentary" is the builder's own freebie switch (`l.free`), never a missing amount.
  assert.deepEqual(maker.match(/['"`]Complimentary['"`]/g)?.length, 1);
  assert.match(maker, /if \(l\.free\) return 'Complimentary';/);
});

test('7b · no quote file decides "Complimentary" for itself — only the one rule does', () => {
  const hits: string[] = [];
  let scanned = 0;
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/quote/i.test(name) && /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        scanned += 1;
        if (/['"`]Complimentary['"`]|>\s*Complimentary\s*</.test(stripComments(readFileSync(p, 'utf8')))) hits.push(p.slice(WEB.length + 1));
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  assert.ok(scanned > 30, `anti-vacuity: scanned only ${scanned} quote files`);
  assert.deepEqual(hits, ['lib/quote-line-price-words.ts'], 'a quote file says "Complimentary" by its own rule');
});

test('7c · what changed and side by side say the unpriced transport as it is (render + data)', async () => {
  const before: QuoteSide = { lines: [{ label: 'Lights', amount_centavos: 2_500_000 }], plan: null, totalCentavos: 2_500_000 };
  const after: QuoteSide = {
    lines: [
      { label: 'Lights', amount_centavos: 2_500_000 },
      { label: 'Transportation', detail: QUOTED_AFTER_SITE_CHECK, amount_centavos: null },
      { label: 'Stage lights', amount_centavos: null },
    ],
    plan: null,
    totalCentavos: 2_500_000,
  };
  const c = quoteChanges(before, after);
  const { QuoteWhatChanged } = await import('@/app/_components/quote-what-changed');
  const t = text(renderToStaticMarkup(h(QuoteWhatChanged, { changes: c, sinceVersion: 1 })));
  assert.match(t, /Transportation Quoted after site check/, `what changed calls the transport free: ${t}`);
  assert.match(t, /Stage lights Complimentary/, 'anti-vacuity: a freebie is still free');

  const v = (n: number, side: QuoteSide): QuoteVersion =>
    ({ proposalId: `p${n}`, pair: 'x', version: n, at: '2026-11-13T00:00:00Z', ...side, previous: null }) as unknown as QuoteVersion;
  const rows = versionsSideBySide(v(1, before), v(2, after));
  const transport = rows.find((r) => r.label === 'Transportation');
  assert.equal(transport?.bWords, 'Quoted after site check');
  assert.equal(rows.find((r) => r.label === 'Stage lights')?.bWords, 'Complimentary');
  assert.equal(rows.find((r) => r.label === 'Lights')?.bWords, undefined, 'a priced line carries no words');
  const compare = read('app/_components/quote-versions-compare.tsx');
  assert.match(compare, /\{cell\(r, r\.a, r\.aWords\)\}/);
  assert.match(compare, /\{cell\(r, r\.b, r\.bWords\)\}/);
});

test('8 · with no real count the Quotation says "No count yet", and the thread page says when the count is real', () => {
  const maker = read('app/_components/proposal-maker.tsx');
  const row = maker.slice(maker.indexOf('data-quote-live-pax='), maker.indexOf('data-quote-live-pax=') + 200);
  assert.match(row, /\{paxKnown \? formatCount\(seedPax\) : 'No count yet'\}/, 'the row draws the stand-in seed as their list');
  assert.match(maker, /paxKnown = true,/);
  const thread = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.match(thread, /paxKnown=\{guestCounts\.atInquiry != null \|\| guestCounts\.live != null\}/, 'the thread page never says whether the count is real');
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
    `${CLIENT}/_components/details-decisions-list.tsx`,
    `${CLIENT}/_components/suppliers-list.tsx`,
    `${CLIENT}/_components/picked-client-settings.tsx`,
    `${CLIENT}/_components/payment-asks-panel.tsx`,
    `${CLIENT}/_components/client-refunds.tsx`,
    `${CLIENT}/_components/customer-money-fold.tsx`,
    `${CLIENT}/_pages/payment.tsx`,
    `${CLIENT}/_pages/files.tsx`,
    `${CLIENT}/_components/supplier-schedule.tsx`,
    `${CLIENT}/_components/script-tab.tsx`,
    `${CLIENT}/_components/script-composer.tsx`,
    `${CLIENT}/_components/customer-card-activity.tsx`,
    `${CLIENT}/_components/customer-card-notes.tsx`,
    `${CLIENT}/_components/couple-answers.tsx`,
    `${CLIENT}/_components/day-check-line.tsx`,
    `${CLIENT}/_components/booth-poster-card.tsx`,
    `${CLIENT}/_components/booth-studio-card.tsx`,
    `${CLIENT}/_components/event-files-board.tsx`,
    `${CLIENT}/page.tsx`,
  ]) {
    const src = read(f);
    assert.ok(src.length > 300, `anti-vacuity: ${f} is empty`);
    // `.home-k2` is the house label: on supplier pages `supplier-look.css` sets it to sentence case (main 15268c6dbc,
    // held by `section-labels-are-sentence-case.test.ts`), so it is allowed here.
    // Every uppercase label in the client workspace's own files is gone (the deferred shared parts live elsewhere).
    // Any class string — className, labelClassName, a `const H = '…'` — that still carries `uppercase`.
    const caps = src.match(/["'`][^"'`\n]*\buppercase\b[^"'`\n]*["'`]/g) ?? [];
    assert.deepEqual(caps, [], `${f} still draws an uppercase label`);
  }
});

test('+b · every client-workspace section label draws through the one house label (.home-k2)', () => {
  // Controller 17 Nov: one shared part per pattern — no second 13px label class beside `.home-k2`.
  const labels: Array<[string, RegExp]> = [
    [`${CLIENT}/_pages/payment.tsx`, /const H = 'home-k2\b/],
    [`${CLIENT}/_components/client-refunds.tsx`, /const H = 'home-k2\b/],
    [`${CLIENT}/_components/customer-money-fold.tsx`, /className="home-k2[^"]*">Waiting for you</],
    [`${CLIENT}/_components/details-forms-door.tsx`, /className="home-k2">Forms · sent to/],
    [`${CLIENT}/_components/hosts-list.tsx`, /className="home-k2">Hosts/],
    [`${CLIENT}/_components/suppliers-list.tsx`, /className="home-k2">Suppliers on this event/],
    [`${CLIENT}/_components/supplier-schedule.tsx`, /className="home-k2">Your times/],
    [`${CLIENT}/_components/details-decisions.tsx`, /className="home-k2">Decisions/],
    [`${CLIENT}/_components/details-decisions-list.tsx`, /labelClassName="home-k2"/],
    [`${CLIENT}/_components/payment-asks-panel.tsx`, /className="home-k2[^"]*">Ask for a payment/],
    [`${CLIENT}/_components/script-tab.tsx`, /labelAs="h3"\s+labelClassName="home-k2[^"]*"/],
    [`${CLIENT}/_components/supplier-locks-section.tsx`, /className="home-k2[^"]*">Your locks/],
    [`${CLIENT}/_components/day-check-line.tsx`, /<p className="home-k2[^"]*">\s*\{tip \?/],
    [`${CLIENT}/_components/booth-poster-card.tsx`, /<h2 className="home-k2[^"]*">/],
    [`${CLIENT}/_components/booth-studio-card.tsx`, /<h2 className="home-k2[^"]*">/],
  ];
  for (const [f, re] of labels) assert.match(read(f), re, `${f}: the section label is not the house label`);
});

test('3b · the Payment page says Overdue the same way Details and Chat do (render)', async () => {
  assert.equal(isPastDue('2026-11-13', '2026-11-17'), true);
  assert.equal(isPastDue('2026-11-17', '2026-11-17'), false, 'the due day itself is not overdue');
  assert.equal(isPastDue('2026-11-13', null), false, 'an unknown today is never overdue');
  const { PaymentPage } = await import('@/app/vendor-dashboard/clients/[eventId]/_pages/payment');
  const step = (seq: number, label: string, amount: number, due: string, state: string) =>
    ({ seq, label, amount_php: amount, due_date: due, amount_kind: 'fixed', percent_bps: null, state });
  const CTX = { eventId: 'e1', vendorProfileId: 'v1', viewerUserId: 'u1', threadId: 't1', eventName: 'Debut 18', stage: 'booked', isBooked: true, feeUnlocked: true, eventVendorId: 'ev1', eventDate: '2027-05-12' };
  const draw = (todayIso: string | null) =>
    text(
      renderToStaticMarkup(
        h(PaymentPage, {
          ctx: CTX as never,
          reservationAcknowledgedAt: null,
          money: {
            steps: [step(1, 'First payment', 5350, '2026-11-13', 'due'), step(2, 'Final balance', 21400, '2027-04-28', 'due')],
            clearedAt: null,
            pending: [],
            ledgerMoney: { rows: [], receivedPhp: 0, expectedPhp: 0 },
            ledgerUnreadable: false,
            todayIso,
          } as never,
        }),
      ),
    );
  assert.match(draw('2026-11-17'), /Overdue ₱5,350 · First payment · since Nov 13/, 'the Payment page still says Next on a passed day');
  assert.match(draw(null), /Next ₱5,350 · First payment · Nov 13/, 'anti-vacuity: an unknown today says Next');
  const page = read(`${CLIENT}/page.tsx`);
  assert.match(page, /unreadableNote: <LedgerUnreadableNote \/>,\s*todayIso: manilaTodayIso\(\),/, 'the page does not hand the Payment page today');
});

test('4b · the Forms door on Details names the event, never "this couple"', () => {
  const door = read(`${CLIENT}/_components/details-forms-door.tsx`);
  assert.doesNotMatch(door, /this couple/);
  assert.match(door, />Forms · sent to \{who\}</);
  assert.match(read(`${CLIENT}/page.tsx`), /<DetailsFormsDoor eventName=\{eventName\} \/>/);
});
