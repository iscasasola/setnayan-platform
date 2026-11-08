/**
 * today-is-rows.test.ts — S-PR1 of the supplier dashboard redesign (corpus
 * `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 2 "Today" + § 6 row
 * S-PR1; prototype `prototypes/supplier_dashboard_2026-10-08_fable.html`
 * frames 01 · 02 · 15 · 31).
 *
 *   ONE Next card ("1 of 3") → three numbers → Coming up → Also waiting (the
 *   rest of the queue, each answer opening in place) → one Shop row.
 *
 * What this file holds is what the redraw could have lost without anything
 * turning red: an answer with nowhere to be given, a banner deleted whose rule
 * is NOT in `pickSupplierNext`, a refused read drawn as a zero, an outcome said
 * to nobody. Asserted on REAL MARKUP wherever a page draws it.
 *
 * SABOTAGE, each seen red before this shipped (S-PR1 PR body has the runs):
 *   1 · the Next ask left in the rows                     → "1 of 3" twice
 *   2 · a delete request dropped when it is the Next card → no row, nowhere to answer
 *   3 · the credit row made conditional on a quiet day    → the banner's meaning is gone
 *   4 · the fold replaced by a link to the customer card  → no form in the row
 *   5 · the date-change card given one "Answer" link      → no Move / Unlock
 *   6 · `waitingOnYou` returning "0" for an unread desk   → a failure drawn as zero
 *   7 · a refusal toast given the 8-second timer          → the refusal leaves by itself
 *   8 · another page made to mount the date-change answer → the "only on Today" fact is stale (by design)
 *
 * RE-AIMED 2026-10-12 (the look audit of #6443/#6450, owner "APPROVE ALL" look calls 1–9): the same claims, on the
 * templates the page now wears — a row is the shared `Fold` (not a hand-made `<details>`), a state is the shared
 * `Badge`, every main button is terracotta (`brand`), the outcome is the shared TOP toast plus a status line that
 * never leaves by itself (§ 9 kind 12). Test 8 holds the look itself. Sabotage for the re-aimed and new claims, each
 * seen red (rd/supplier-dashboard-1 PR body):
 *   9 · the Fold swapped back for a hand-made `<details>`  → 2b
 *  10 · the status line made to vanish on a timer          → 6
 *  11 · the Next card given back its frame / gold fill      → 8
 *  12 · a row's arrow grey again                            → 8
 *
 * 🔁 RE-AIMED 2026-11-08 — THE ONE BUILD (owner *"Approved suuplier dashboard"*, v113; A2 part A). Owner v112 HOLD
 * answer *"Jump"* overrides DL 2026-10-28 "EVERYTHING IN PLACE" for Today's rows, and v103 retires the Next card (its
 * order became the row order, its doors became rows). The SAME claims, on the page as it now is:
 *   · no answer is left with nowhere to be given — the two that lived only here moved to the client's Details
 *     (`ClientDayAnswers`), and `ANSWERED_ONLY_ON_TODAY` is [] (its own docblock said that is when it may be relaxed);
 *   · every row is ONE link to its page — none folds open, none holds a form;
 *   · every banner's meaning is still a row; every unpaid fee is still drawn with its Pay;
 *   · a refused read is said, never a zero; the outcome of an answer is still said; the look rules hold.
 * Sabotage for the re-aimed claims, each seen red (THE ONE BUILD C1 notes): a row given back a <form> → 2b;
 * `ANSWERED_ONLY_ON_TODAY` refilled → 2; the credit door dropped → 3; `needsCount` counting `numbers.waiting` → 1.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import type { UpcomingEventRow, WhatsNewCard } from '@/lib/vendor-overview';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const NOW = Date.parse('2026-10-02T02:00:00Z');
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const noop = async () => {};

const REPLY: WhatsNewCard = { kind: 'message', id: 'm1', threadId: 't1', eventId: 'e-ana', coupleName: 'Ana & Miguel', excerpt: 'Are you free?', lastMessageAt: ago(2) };
const BOOKING: WhatsNewCard = { kind: 'lock_request', id: 'a1', eventId: 'e-rc', eventVendorId: 'ev-rc', coupleName: 'Rolando & Carmen', eventDate: '2026-11-21', requestedAt: ago(20), expiresAt: null };
const QUOTE: WhatsNewCard = { kind: 'quote_draft', id: 'q1', proposalId: 'p1', publicId: null, eventId: 'e-ko', title: 'Katrina Ocampo · debut', totalCentavos: 4_500_000, createdAt: ago(40) };
const REMOVE: WhatsNewCard = { kind: 'delete_request', id: 'd1', eventId: 'e-x', eventVendorId: 'ev-x', eventDate: null, requestedAt: ago(90) };
const MOVE: WhatsNewCard = {
  kind: 'date_change', id: 'dc1', eventId: 'e-cruz', eventVendorId: 'ev-cruz', coupleName: 'Cruz',
  fromDate: '2026-10-04', fromPrecision: 'day', proposedDate: '2026-10-11', proposedPrecision: 'day',
  askedAt: ago(20), dueAt: new Date(NOW + 47 * 3_600_000).toISOString(),
};
const since = (c: WhatsNewCard) => new Date('lastMessageAt' in c ? c.lastMessageAt : 'requestedAt' in c ? c.requestedAt : 'createdAt' in c ? c.createdAt : 'askedAt' in c ? c.askedAt : NOW);
const today: UpcomingEventRow = { id: 'up', eventId: 'e-cruz', eventName: 'Cruz wedding', date: '2026-10-02', place: 'Makati', category: 'photo_video', inDays: 0, href: '/vendor-dashboard/clients/e-cruz?tab=details', threadHref: '/vendor-dashboard/messages/t-cruz', opensCard: true };

async function lib() {
  return import('@/lib/supplier-today');
}

type Opts = {
  needsAnswer?: WhatsNewCard[];
  upcoming?: UpcomingEventRow[];
  deskIncomplete?: boolean;
  owedPhp?: number | null;
  findability?: { title: string; body: string; cta: { label: string; href: string } | null } | null;
  setupStep?: { title: string; body: string; cta: string | null; href: string | null } | null;
  /** The plan credit about to expire (`todayCreditNotice` said yes). */
  credit?: boolean;
  /** Couples cannot see where to pay this shop. */
  payout?: boolean;
  /** Two unpaid booking fees. */
  bills?: boolean;
  /** The outcome of an answer (status line under the card). */
  outcome?: { text: string; tone: 'ok' | 'note' | 'bad'; door?: { label: string; href: string } | null };
};

const BILLS = [
  { orderId: 'S89O-T0000001', amountPhp: 750, eventId: 'e-ana', coupleName: 'Ana & Miguel', dueOn: '2026-10-09', introducedOn: '2026-09-30' },
  { orderId: 'S89O-T0000002', amountPhp: 1200, eventId: 'e-rc', coupleName: 'Rolando & Carmen', dueOn: '2026-10-01' },
];

async function queue(o: Opts) {
  const L = await lib();
  const needsAnswer = o.needsAnswer ?? [];
  const nextAnswer = L.nextAnswerOf(needsAnswer);
  const input = {
    answer: nextAnswer,
    answerSince: nextAnswer ? since(nextAnswer) : null,
    deskIncomplete: o.deskIncomplete ?? false,
    upcoming: o.upcoming ?? [],
    setupStep: o.setupStep ?? null,
    findability: o.findability ?? null,
    fee: null,
    owedPhp: o.owedPhp === undefined ? null : o.owedPhp,
    now: NOW,
  };
  const next = L.pickSupplierNext(input);
  const waiting = L.supplierWaiting({
    next,
    needsAnswer,
    since,
    setupStep: input.setupStep,
    findability: input.findability,
    credit: o.credit ? { title: 'Credits expiring', body: '₱2,500 · Mon 5 Oct', href: '/vendor-dashboard/subscription' } : null,
    payout: o.payout ? { title: 'Where couples pay you', body: 'Add GCash or a bank', href: '/vendor-dashboard/profile#pay', button: 'Set up' } : null,
    now: NOW,
  });
  return { L, next, waiting, needsAnswer, nextAnswer: next.kind === 'answer' ? nextAnswer : null, input };
}

/**
 * Today, drawn exactly as the page composes it: the ONE assembly (`assembleSupplierToday`) and the ONE drawing
 * (`SupplierTodayScreen`) the page and the dev lab share.
 */
async function render(o: Opts): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayScreen } = await import('./supplier-today-screen');
  const { assembleSupplierToday } = await import('@/lib/supplier-today-view');
  const { splitDesk } = await import('@/lib/vendor-desk-disposition');
  const { answer, news } = splitDesk(o.needsAnswer ?? []);
  const view = assembleSupplierToday({
    needsAnswer: answer,
    closed: news,
    deskIncomplete: o.deskIncomplete ?? false,
    upcoming: o.upcoming ?? [],
    schedules: { pools: [], outside: [], complete: true },
    firstSteps: null,
    verified: true,
    findable: !o.findability,
    findability: o.findability ?? null,
    feeBills: o.bills ? BILLS : [],
    feeEnforced: true,
    earnings: o.owedPhp === undefined || o.owedPhp === null ? null : { confirmedPhp: 0, expectedPhp: o.owedPhp, paydayMeasured: true },
    credit: o.credit ? { creditPhp: 2500, tierExpiresAt: '2026-10-05T00:00:00Z', href: '/vendor-dashboard/subscription' } : null,
    payoutReadiness: o.payout ? 'none' : 'unreadable',
    payoutHref: '/vendor-dashboard/profile#pay',
    shop: { name: 'Lumina Studio', categoryWord: 'Photo & video', details: { done: 6, total: 6, complete: true }, awardWord: null, milestoneWord: null },
    views: 312,
    inquiries28: 14,
    dayFacts: null,
    todayIso: '2026-10-02',
    now: NOW,
    since,
  });
  return renderToStaticMarkup(
    React.createElement(SupplierTodayScreen, {
      view,
      outcome: o.outcome ?? null,
      shopName: 'Lumina Studio',
      todayIso: '2026-10-02',
      now: NOW,
    }),
  );
}

/** The Needs-you rows, in order, as [key, href]. */
function needRows(html: string): Array<[string, string]> {
  const list = html.slice(html.indexOf('data-today-needs-rows'), html.indexOf('data-today-needs-none'));
  return [...list.matchAll(/<a\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((a) => a.includes('data-today-need='))
    .map((a) => [a.match(/data-today-need="([^"]+)"/)![1]!, (a.match(/href="([^"]+)"/)?.[1] ?? '').replace(/&amp;/g, '&')]);
}

/* ═══ 1 · THE ONE LIST ═════════════════════════════════════════════════════ */

test('1 · Needs you today lists every ask ONCE, in the Next card’s old order — the soonest date change first', async () => {
  const html = await render({ needsAnswer: [REPLY, MOVE, BOOKING, QUOTE] });
  const rows = needRows(html);
  assert.deepEqual(rows.map(([k]) => k), ['dc1', 'm1', 'a1', 'q1'], 'not every ask once, in pickSupplierNext’s order');
  const t = text(html);
  assert.match(t, /Needs you today 4 · 12 MN – 12 MN/, 'the heading does not count the list it heads');
  assert.match(t, /4 tasks today/, 'the cover’s chip is not the list’s length');
  assert.doesNotMatch(t, /\b\d of \d\b/, 'a "1 of 3" queue number is back — the Next card is retired (v103)');
  assert.doesNotMatch(html, /data-today-next=/, 'the Next card is drawn again');
  // Each row wears its round icon (the prototype draws one on every row).
  const list = html.slice(html.indexOf('data-today-needs-rows'), html.indexOf('data-today-needs-none'));
  assert.equal((list.match(/data-row-icon="/g) ?? []).length, 4);
});

test('1b · on an event day every ask is still a row, and today’s event is not listed again under Coming up', async () => {
  const html = await render({ needsAnswer: [REPLY, BOOKING], upcoming: [today] });
  assert.deepEqual(needRows(html).map(([k]) => k), ['m1', 'a1']);
  const coming = html.slice(html.indexOf('data-today-coming-up'), html.indexOf('data-today-shop'));
  assert.doesNotMatch(text(coming), /Cruz wedding/, 'today’s event is listed under Coming up too');
  assert.match(code('lib/supplier-today-view.ts'), /\.\.\.\(eventToday \? upcoming\.slice\(1\) : upcoming\)\.map\(/);
});

test('1e · every unpaid booking fee is a row of Needs you today — before Coming up, counted, each with its Pay', async () => {
  const html = await render({ needsAnswer: [REPLY], upcoming: [{ ...today, date: '2026-10-05', inDays: 3 }], bills: true });
  const needs = html.slice(html.indexOf('data-today-needs='), html.indexOf('data-today-coming-up'));
  assert.equal((needs.match(/data-testid="booking-fee-bill"/g) ?? []).length, 2, 'not every unpaid fee is drawn in Needs you today');
  assert.match(text(html), /Needs you today 3 · 12 MN – 12 MN/, 'the fee rows are not counted');
  const coming = html.slice(html.indexOf('data-today-coming-up'), html.indexOf('data-today-shop'));
  assert.doesNotMatch(coming, /booking-fee-bill/, 'a fee row is drawn under Coming up');
  assert.doesNotMatch(await render({ needsAnswer: [REPLY] }), /data-today-need-bills/, 'no bill, yet a bills block');
});

/* ═══ 2 · NO ANSWER IS LEFT WITH NOWHERE TO BE GIVEN ═══════════════════════ */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('2 · no answer is given only on Today any more — the two moved to the client’s Details, and Today mounts none', async () => {
  const { ANSWERED_ONLY_ON_TODAY } = await lib();
  assert.deepEqual([...ANSWERED_ONLY_ON_TODAY], [], 'an answer is given only on Today again — its row would jump to a page without it');
  const files = walk(join(WEB, 'app'));
  assert.ok(files.length > 800, `scanned only ${files.length} files`);
  for (const action of ['vendorAnswerDateChange', 'vendorAgreeToDeletion', 'vendorDeclineDeletion']) {
    const mounts = files
      .filter((f) => !f.endsWith('clients/[eventId]/actions.ts'))
      .filter((f) => new RegExp(`\\b${action}\\b`).test(stripComments(readFileSync(f, 'utf8'))))
      .map((f) => relative(WEB, f))
      .sort();
    assert.ok(mounts.includes('app/vendor-dashboard/_components/client-day-answers.tsx'), `${action} has no mount on the client’s page`);
    assert.ok(!mounts.includes('app/vendor-dashboard/page.tsx'), `${action} is mounted on Today again — Today answers nothing in place`);
  }
});

test('2b · a row is ONE link to its page — no fold, no form, nothing answered on Today', async () => {
  const html = await render({ needsAnswer: [REPLY, BOOKING, QUOTE, REMOVE, MOVE], credit: true });
  const needs = html.slice(html.indexOf('data-today-needs='), html.indexOf('data-today-coming-up'));
  assert.doesNotMatch(needs, /<form|data-fold=|<details|<summary/, 'a row opens its answer in place again');
  assert.ok(needRows(html).length >= 6, 'anti-vacuity: the rows were not found');
  for (const [k, href] of needRows(html)) assert.ok(href.startsWith('/'), `${k}: the row goes nowhere`);
  assert.doesNotMatch(needs, /href="\/vendor-dashboard#whats-new"/, 'a row points back at Today');
});

test('2c · the date change and the delete request JUMP to the client’s Details, where their answers now are', async () => {
  const rows = new Map(needRows(await render({ needsAnswer: [REMOVE, MOVE] })));
  assert.equal(rows.get('dc1'), '/vendor-dashboard/clients/e-cruz?tab=details');
  assert.equal(rows.get('d1'), '/vendor-dashboard/clients/e-x?tab=details');
  const body = code('app/vendor-dashboard/_components/client-day-answers.tsx');
  assert.match(body, /<DateChangeBody card=\{card\} answerDateChange=\{vendorAnswerDateChange\} \/>/, 'Details does not draw the shipped Move · Unlock');
  assert.match(body, /<DeleteRequestBody card=\{card\} agreeDeletion=\{vendorAgreeToDeletion\} declineDeletion=\{vendorDeclineDeletion\} \/>/);
  assert.match(body, /<UndoableAnswers>/, 'the answers lost the Undo holder');
  // The refund sentence is still said before the press — it travels with the shipped body.
  assert.match(code('app/vendor-dashboard/_components/overview-sections.tsx'), /Setnayan\s+never decides a refund/);
});

/* ═══ 3 · EVERY DELETED BANNER'S MEANING IS STILL ON THE PAGE ══════════════ */

test('3 · each banner taken off Today is a row — and every row goes where the banner went', async () => {
  const page = code('app/vendor-dashboard/page.tsx');
  for (const gone of ['<VendorFirstSteps', '<SpotlightAwardBanner', '<PayoutMethodNudge', '<OngoingTasks', '<UpcomingSchedules', 'id="today-all"', 'Answering couples is free']) {
    assert.ok(!page.includes(gone), `${gone} is back on Today`);
  }
  const view = code('lib/supplier-today-view.ts');
  const screen = code('app/vendor-dashboard/_components/supplier-today-screen.tsx');
  assert.match(page, /payoutReadiness,\s*payoutHref: PAYMENT_OPTIONS_HREF,/, 'the payout nudge lost its row');
  assert.match(page, /hasLockAsk \|\| hasBooking\s*\?\s*readSupplierPayoutReadiness\(/, 'the payout row no longer follows the nudge’s own rule');
  assert.match(view, /if \(r === 'none'\) return \{ body: PAYOUT_DOOR_WORDS\.body, button: 'Set up' \};/);
  assert.match(view, /input\.shop\.awardWord,\s*input\.shop\.milestoneWord,/, 'the award and the milestone left the Shop row');
  assert.match(view, /bills: allBills,/, 'the fee bills are no longer all on Today');
  assert.match(screen, /<BookingFeeBills today bills=\{view\.bills\} copyFor=\{view\.billCopy\} \/>/, 'the fee bills are no longer drawn on Today');

  const find = { title: 'Couples can’t find you yet.', body: 'b', cta: { label: 'Ask us', href: '/help#contact' } };
  const rows = new Map(needRows(await render({ needsAnswer: [REPLY], findability: find, credit: true, payout: true })));
  assert.equal(rows.get('door-findable'), '/help#contact');
  assert.equal(rows.get('door-credit'), '/vendor-dashboard/subscription');
  assert.equal(rows.get('door-payout'), '/vendor-dashboard/profile#pay');
  // The rows say the banners' words.
  const t = text(await render({ needsAnswer: [REPLY], findability: find, credit: true, payout: true }));
  for (const words of ['Couples can’t find you yet.', 'Credits expiring', 'Where couples pay you']) assert.ok(t.includes(words), `"${words}" is not on Today`);
});

/* ═══ 4 · A FAILURE NEVER READS AS A ZERO ═════════════════════════════════ */

test('4 · an unread desk is a "couldn’t load" row (never "Nothing waiting"); an unread payday says so where the money would be', async () => {
  const L = await lib();
  assert.equal(L.waitingOnYou(0, true), null, 'an unread desk that found nothing is not "0 waiting"');
  assert.equal(L.waitingOnYou(2, true), '2+');
  const html = await render({ deskIncomplete: true, owedPhp: null });
  const t = text(html);
  assert.match(t, /Some answers couldn’t load/);
  assert.doesNotMatch(t, /Nothing waiting on you/, 'an unread desk reads as empty');
  assert.match(needRows(html).find(([k]) => k === 'unread')?.[1] ?? '', /^\/vendor-dashboard$/, '"try again" does not reload Today');
  const money = html.slice(html.indexOf('data-today-stat="money"'), html.indexOf('</a>', html.indexOf('data-today-stat="money"')));
  assert.match(text(money), /Money couldn’t load/, 'an unread payday is not said on the Money stat');
  assert.doesNotMatch(text(money), /₱/, 'a figure is drawn over an unread payday');
});

/* ═══ 5 · THE BUTTONS WEAR THEIR MEANING ══════════════════════════════════ */

test('5 · every main verb is terracotta, every rule has a look — and the answers on the client page are the button rule', async () => {
  const L = await lib();
  for (const kind of L.SUPPLIER_NEXT_ORDER) assert.equal(L.nextLook(kind, null).tone, 'brand', `${kind}'s main button is not terracotta`);
  for (const card of [REPLY, BOOKING, QUOTE, REMOVE, MOVE]) assert.equal(L.nextLook('answer', card).tone, 'brand');
  const looks = code('lib/supplier-today.ts');
  for (const table of ['ANSWER_LOOK', 'RULE_LOOK']) {
    const block = looks.slice(looks.indexOf(`const ${table}:`), looks.indexOf('};', looks.indexOf(`const ${table}:`)));
    const tones = [...block.matchAll(/tone: '(\w+)'/g)].map((m) => m[1]);
    assert.ok(tones.length >= (table === 'ANSWER_LOOK' ? 13 : 8), `anti-vacuity: ${table} has ${tones.length} entries`);
    assert.deepEqual([...new Set(tones)], ['brand'], `${table}: a main button wears a meaning colour`);
  }
  const sections = code('app/vendor-dashboard/_components/overview-sections.tsx');
  assert.doesNotMatch(sections, /<SubmitButton\b|<button\b|<Link\b/, 'an answer is a hand-made button or link again');
  const mains = [...sections.matchAll(/<(?:SupplierSubmit|ActionButton)\b[^>]*?\btone="(\w+)"[^>]*?\bmain\b/g)].map((m) => m[1]);
  assert.ok(mains.length >= 10, `anti-vacuity: only ${mains.length} main buttons found`);
  assert.deepEqual([...new Set(mains)].sort(), ['brand', 'danger']);
});

/* ═══ 6 · THE OUTCOME IS SAID, AS A TOAST ═════════════════════════════════ */

test('6 · the three outcome notices are the shared TOP toast + a status line — drawn by the server, and the line never leaves by itself', async () => {
  const page = code('app/vendor-dashboard/page.tsx');
  assert.match(page, /\{outcome \? <SupplierToast text=\{outcome\.text\} tone=\{outcome\.tone\} retry=\{genericFailure\.has\(outcome\.text\)\} line=\{false\} \/> : null\}/, 'Today does not say the outcome');
  // …and the lasting status line is drawn ABOVE Needs you today (the Next card it sat under is retired, v103), by the
  // server, with the door the sentence asks for (fee held → "Pay the booking fee", lib/lock-answer-notice.ts).
  assert.match(page, /door: lockAnswer\.door \?\? null,/, 'the status line lost the Pay door the fee-held sentence asks for');
  const said = await render({ needsAnswer: [REPLY], outcome: { text: 'You said yes. Pay the booking fee and we’ll tell the couple their booking is confirmed.', tone: 'ok', door: { label: 'Pay the booking fee', href: '/vendor-dashboard/booking-fees' } } });
  const statusAt = said.indexOf('role="status" data-supplier-outcome="ok"');
  assert.ok(statusAt > 0 && statusAt < said.indexOf('data-today-needs='), 'the status line is not right above Needs you today');
  assert.match(said.slice(statusAt, said.indexOf('data-today-needs=')), /href="\/vendor-dashboard\/booking-fees"[\s\S]*Pay the booking fee/, 'the status line has no Pay door');
  const outcome = page.slice(page.indexOf('const outcome:'), page.indexOf('return (', page.indexOf('const outcome:')));
  for (const src of ['lockAnswer.text', 'dateAnswer', 'depositAnswer']) assert.ok(outcome.includes(src), `the ${src} notice is no longer said`);
  assert.match(outcome, /lockAnswer\.tone === 'ok' \? 'ok' : lockAnswer\.tone === 'noop' \? 'note' : 'bad'/, 'a refused booking answer is not drawn as a failure');
  assert.doesNotMatch(page, /role="status"\s+className="sn-tile/, 'the outcome is a tile again');

  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierToast, toastWords } = await import('./supplier-toast');
  const refusal = 'This request ran out of time before it was answered, so it has closed. If the couple still wants you, ask them to send it again.';
  const html = renderToStaticMarkup(React.createElement(SupplierToast, { text: refusal, tone: 'bad' }));
  // The server draws the WHOLE sentence in the page: with JavaScript off it is still said, and it is the lasting copy.
  assert.match(html, /<p role="status" data-supplier-outcome="bad"/, 'the server does not draw the outcome — with JavaScript off it is said to nobody');
  assert.ok(text(html).includes(refusal), 'the status line does not carry the whole sentence');
  assert.doesNotMatch(html, /<(a|button)\b/, 'the server markup holds something to press — it would be the first tap on the page');
  assert.doesNotMatch(html, /data-peek-toast/, 'the toast is drawn by the server — its Try again would come before the Next card');
  // The toast says the first sentence (the pill holds two lines).
  assert.equal(toastWords(refusal), 'This request ran out of time before it was answered, so it has closed.');
  assert.equal(toastWords('Done — you told them you can move. Your held day moves with the date.'), 'Done — you told them you can move.');
  assert.equal(toastWords('No full stop here'), 'No full stop here');

  const toast = code('app/vendor-dashboard/_components/supplier-toast.tsx');
  // The ONE drawing — the shared PeekToast, from the top — and no pill of its own at the bottom.
  assert.match(toast, /import \{ PeekToast, type PeekToastTone \} from '@\/app\/_components\/toast\/peek-toast';/);
  assert.match(toast, /<PeekToast\s+tone=\{tone\}/, 'the outcome is not the shared toast');
  assert.doesNotMatch(toast, /bottom|bg-ink|setTimeout/, 'the toast draws its own bottom pill or runs its own timer again');
  assert.match(toast, /document\.body,\s*\)/, 'the floating toast is not portalled — a wrapper could pin it off screen');
  // The status line has no timer, no state, no condition but the outcome itself: it stays until the page is left.
  const line = toast.slice(toast.indexOf('<p\n        role="status"'), toast.indexOf('</p>'));
  assert.ok(line.length > 50, 'anti-vacuity: the status line was not found');
  assert.doesNotMatch(toast.slice(0, toast.indexOf('<p\n        role="status"')), /showing \?\s*\(?\s*<p|\{showing && <p/, 'the status line is drawn only while the toast shows');
  // Try again: only on a failure that can simply be pressed again.
  assert.match(toast, /onRetry=\{\s*tone === 'bad' && retry/, 'Try again is offered on something that cannot be retried');
});

/* ═══ 7 · THE SHOP ROW ════════════════════════════════════════════════════ */

test('7 · the shop line moved to one row at the bottom — its name, its state, one door', async () => {
  const html = await render({ needsAnswer: [REPLY] });
  assert.ok(html.indexOf('data-today-shop') > html.indexOf('data-today-coming-up'), 'the Shop row is not at the bottom');
  const shop = html.slice(html.indexOf('data-today-shop'));
  assert.match(text(shop), /Shop Open Lumina Studio Photo & video · couples can find you Live/);
  assert.equal((shop.match(/href="\/vendor-dashboard\/shop"/g) ?? []).length, 2, 'the eyebrow door and the row both open Shop');
  // 📈 …and "How is business" under it, to Insights, with its two figures.
  assert.match(text(shop), /How is business 312 looked · 14 asked/);
  assert.match(shop, /href="\/vendor-dashboard\/performance"/);
  assert.doesNotMatch(html, /bg-mulberry/, 'the mulberry shop block is back above the Next card');
  assert.match(shop, /data-badge="ok"[^>]*>Live</, '"Live" is not the shared Badge');
});

/* ═══ 8 · THE LOOK (owner 2026-10-12, "APPROVE ALL" look calls 1 · 7 · 8 · 9) ═══════════════════ */

test('8 · every tap mark is terracotta; states are Badges; no colour written by hand', async () => {
  const html = await render({ needsAnswer: [REPLY, BOOKING, QUOTE], upcoming: [{ ...today, date: '2026-10-05', inDays: 3 }] });
  // (a) THE NEXT CARD is retired (v103) — its card component is the event Home's, untouched here.
  // (b) THE MARK THAT SAYS "TAP THIS": every row arrow, the list doors and the mark under each number are the accent.
  const arrows = html.match(/<svg[^>]*lucide-chevron-(?:right|down)[^>]*>/g) ?? [];
  assert.ok(arrows.length >= 6, `anti-vacuity: only ${arrows.length} arrows`);
  for (const a of arrows) assert.match(a, /text-sn-accent/, `a tap mark is not terracotta: ${a}`);
  // 📊 THE ONE BUILD A4: the five stats are LINKS (they jump; the counts row that filtered in place is retired).
  const stats = html.slice(html.indexOf('data-today-stats'), html.indexOf('data-today-needs='));
  assert.equal((stats.match(/<a\b[^>]*data-today-stat=/g) ?? []).length, 5, 'a stat stopped being a link');
  assert.doesNotMatch(stats, /aria-pressed/, 'a stat filters in place again');
  const first = code('app/vendor-dashboard/_components/supplier-today-first-screen.tsx');
  assert.doesNotMatch(first, /mulberry|text-ink\/45|#[0-9a-fA-F]{3,8}\b/, 'the first screen writes a colour by hand again');
  // (c) A STATE is the shared Badge (soft fill, no border) — this page draws no pill of its own.
  assert.doesNotMatch(first + code('app/vendor-dashboard/_components/overview-sections.tsx'), /function TodayPill|data-today-pill/);
  const { BADGE_CLASS } = await import('@/app/_components/badge');
  assert.doesNotMatch(BADGE_CLASS, /\bborder\b|\bring\b|shadow/, 'a status chip has a border');
});
