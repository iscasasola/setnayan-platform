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
  credit?: { title: string; body: string; href: string } | null;
  payout?: { title: string; body: string; href: string } | null;
  /** A stand-in for the page's `<BookingFeeBills rows>`. */
  bills?: boolean;
};

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
    credit: o.credit ?? null,
    payout: o.payout ?? null,
    now: NOW,
  });
  return { L, next, waiting, needsAnswer, nextAnswer: next.kind === 'answer' ? nextAnswer : null, input };
}

/** Today, drawn exactly as the page composes it. */
async function render(o: Opts): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayFirstScreen } = await import('./supplier-today-first-screen');
  const { WhatsNewFeed } = await import('./overview-sections');
  const { L, next, waiting, needsAnswer, nextAnswer, input } = await queue(o);
  const actions = {
    acceptInquiry: noop, declineInquiry: noop, confirmLock: noop, rejectLock: noop, agreeLock: noop, declineLock: noop,
    agreeDeletion: noop, declineDeletion: noop, answerDateChange: noop, postReviewReply: noop, respondMeeting: noop, markServiceComplete: noop,
  };
  return renderToStaticMarkup(
    React.createElement(SupplierTodayFirstScreen, {
      next,
      look: L.nextLook(next.kind, nextAnswer),
      second: L.nextSecond(next, nextAnswer, input.upcoming),
      counter: waiting.counter,
      meta: L.nextMeta(nextAnswer, nextAnswer ? since(nextAnswer) : null, NOW),
      dateChange: nextAnswer?.kind === 'date_change' ? { card: nextAnswer, answer: noop } : null,
      numbers: {
        waiting: L.waitingOnYou(needsAnswer.length, input.deskIncomplete),
        waitingNow: needsAnswer.length > 0,
        thisWeek: L.eventsThisWeek(input.upcoming),
        toComeIn: input.owedPhp === null ? null : `₱${input.owedPhp}`,
      },
      comingUp: (next.kind === 'run_day' ? input.upcoming.slice(1) : input.upcoming).slice(0, 3),
      alsoWaitingHeaded: waiting.asks.length > 0 || input.deskIncomplete,
      doors: waiting.doors,
      hasBills: o.bills ?? false,
      bills: o.bills ? React.createElement('div', { 'data-testid': 'booking-fee-bill', className: 'border-t' }, 'Booking fee due') : null,
      shop: { name: 'Lumina Studio', line: 'Photo & video · Live', live: true },
      alsoWaiting: React.createElement(WhatsNewFeed, { cards: needsAnswer, asks: waiting.asks, incomplete: input.deskIncomplete, ...actions }),
    }),
  );
}

/* ═══ 1 · THE QUEUE ════════════════════════════════════════════════════════ */

test('1 · "1 of 3" is the Next card; the rows are 2 of 3 and 3 of 3 — never the Next ask twice', async () => {
  const { next, waiting } = await queue({ needsAnswer: [REPLY, BOOKING, QUOTE] });
  assert.equal(next.title, 'Reply to Ana & Miguel');
  assert.equal(waiting.counter, '1 of 3');
  assert.equal(waiting.total, 3);
  assert.deepEqual(waiting.asks.map((a) => [a.card.id, a.label, a.position]), [
    ['a1', 'Agree to this booking', 2],
    ['q1', 'Send your quote', 3],
  ]);
  assert.ok(waiting.asks.every((a) => !a.open));

  const html = await render({ needsAnswer: [REPLY, BOOKING, QUOTE] });
  const t = text(html);
  assert.match(t, /1 of 3/);
  assert.match(t, /Also waiting.*Agree to this booking.*2 of 3.*Send your quote.*3 of 3/, `the rows are not the rest of the queue, in order: ${t.slice(0, 600)}`);
  assert.equal((t.match(/\b1 of 3\b/g) ?? []).length, 1, 'the Next ask is drawn twice');
  assert.equal((html.match(/data-today-ask=/g) ?? []).length, 2);
});

test('1b · one ask is just the Next card — no counter, no "Also waiting"', async () => {
  const { waiting } = await queue({ needsAnswer: [REPLY] });
  assert.equal(waiting.counter, null, '"1 of 1" is noise');
  assert.deepEqual(waiting.asks, []);
  assert.doesNotMatch(text(await render({ needsAnswer: [REPLY] })), /Also waiting|of 1/);
});

test('1c · on an event day the card is the day, and every ask is a row numbered from 1', async () => {
  const { next, waiting } = await queue({ needsAnswer: [REPLY, BOOKING], upcoming: [today] });
  assert.equal(next.kind, 'run_day');
  assert.equal(waiting.counter, null, 'the day card is not one of the asks');
  assert.deepEqual(waiting.asks.map((a) => a.position), [1, 2]);
  const html = await render({ needsAnswer: [REPLY, BOOKING], upcoming: [today] });
  assert.match(text(html), /1 of 2.*2 of 2/);
  // The card IS today's event — it is not listed again under Coming up.
  const coming = html.slice(html.indexOf('data-today-coming-up'), html.indexOf('data-also-waiting'));
  assert.doesNotMatch(text(coming), /Cruz wedding/, 'today’s event is on the card AND under Coming up');
  assert.match(code('app/vendor-dashboard/page.tsx'), /comingUp=\{\(next\.kind === 'run_day' \? upcoming\.slice\(1\) : upcoming\)\.slice\(0, 3\)\}/);
  // A lone ask has no "1 of 1".
  const one = await render({ needsAnswer: [BOOKING], upcoming: [today] });
  assert.match(one, /data-today-ask="lock_request"/);
  assert.doesNotMatch(text(one), /1 of 1/);
});

test('1d · the doors are never drawn under the wrong heading', async () => {
  const credit = { title: 'Your ₱2,500 credit expires in 3 days', body: 'Renew to keep it.', href: '/vendor-dashboard/subscription' };
  // No ask row: the doors carry "Also waiting" themselves.
  const alone = await render({ needsAnswer: [REPLY], credit });
  assert.doesNotMatch(alone, /data-also-waiting/);
  assert.match(text(alone.slice(alone.indexOf('data-today-doors'), alone.indexOf('data-today-shop'))), /> Also waiting Your ₱2,500 credit expires in 3 days/);
  // With ask rows: one heading, above the asks.
  const both = await render({ needsAnswer: [REPLY, BOOKING], credit });
  assert.equal((text(both).match(/Also waiting/g) ?? []).length, 1);
});

test('1e · the booking-fee rows sit LAST under "Also waiting" — never under Coming up with no heading of their own', async () => {
  // Found on the 375 walk (2026-10-12): with one ask (the Next card) and no door, two fee rows were drawn straight
  // under the last Coming-up row.
  const heading = (html: string) => (text(html).match(/Also waiting/g) ?? []).length;
  for (const o of [{ needsAnswer: [REPLY] }, { needsAnswer: [REPLY, BOOKING] }, { needsAnswer: [REPLY], credit: { title: 'Credit ends', body: 'b', href: '/vendor-dashboard/subscription' } }] as Opts[]) {
    const html = await render({ ...o, upcoming: [{ ...today, date: '2026-10-05', inDays: 3 }], bills: true });
    const bill = html.indexOf('data-testid="booking-fee-bill"');
    assert.ok(bill > 0, 'anti-vacuity: the bill was not drawn');
    assert.equal(heading(html), 1, 'not exactly one "Also waiting" heading');
    assert.ok(text(html.slice(0, bill)).includes('Also waiting'), 'a fee row is drawn before the "Also waiting" heading — it reads as a Coming-up row');
    assert.ok(bill > html.lastIndexOf('data-today-row="coming-up"'), 'a fee row is above Coming up');
    assert.ok(bill < html.indexOf('data-today-shop'), 'a fee row is below the Shop row');
  }
  // No bill → nothing drawn, and no stray heading.
  assert.doesNotMatch(await render({ needsAnswer: [REPLY] }), /data-today-bills|Also waiting/);
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

test('2 · the two answers given only on Today are still given only on Today — which is WHY the rows are folds', async () => {
  const { ANSWERED_ONLY_ON_TODAY } = await lib();
  assert.deepEqual([...ANSWERED_ONLY_ON_TODAY], ['date_change', 'delete_request']);
  // Who MOUNTS each answer's action (imports it as a value outside its own file).
  const files = walk(join(WEB, 'app'));
  assert.ok(files.length > 800, `scanned only ${files.length} files`);
  for (const action of ['vendorAnswerDateChange', 'vendorAgreeToDeletion', 'vendorDeclineDeletion']) {
    const mounts = files
      .filter((f) => !f.endsWith('clients/[eventId]/actions.ts'))
      .filter((f) => new RegExp(`\\b${action}\\b`).test(stripComments(readFileSync(f, 'utf8'))))
      .map((f) => relative(WEB, f))
      .sort();
    assert.deepEqual(
      mounts,
      ['app/dev/supplier-lab/page.tsx', 'app/vendor-dashboard/page.tsx'],
      `${action} is mounted by ${mounts.join(', ')} — if a customer card or a thread now takes this answer, ` +
        'ANSWERED_ONLY_ON_TODAY (lib/supplier-today.ts) and the fold rule can be relaxed; until then they cannot',
    );
  }
});

/** Today's ask rows, each cut from its `data-today-ask` wrapper to the next (or to the end of the list). */
function askRows(html: string): string[] {
  const list = html.slice(html.indexOf('data-also-waiting'));
  return list.split(/(?=<div[^>]*data-today-ask=")/).slice(1);
}

test('2b · a row OPENS ITS ANSWER IN PLACE — the form is inside the row, one open at a time', async () => {
  const html = await render({ needsAnswer: [REPLY, BOOKING, QUOTE] });
  const rows = askRows(html);
  assert.equal(rows.length, 2, `expected two rows, cut ${rows.length}`);
  // The SHARED fold (kind 19): its head is a button that says whether it is open, its body stays mounted — and it
  // joins the one-open-at-a-time mechanism (`fold.tsx` → `useOneOpen`), which a hand-made <details> never did.
  for (const r of rows) {
    assert.match(r, /<div data-fold="today-ask"/, 'the row is not the shared Fold');
    assert.match(r, /<button type="button" data-fold-head="" aria-expanded="(?:true|false)"/, 'the row has no fold head');
    assert.doesNotMatch(r, /<details|<summary/, 'the row is a hand-made <details> again');
  }
  assert.match(code('app/_components/fold.tsx'), /const scope = useOneOpen\(open, setOpen\);/, 'the shared fold stopped closing its peers');
  const ask = rows.find((r) => r.includes('data-today-ask="lock_request"'))!;
  const head = ask.slice(ask.indexOf('data-fold-head'), ask.indexOf('data-fold-body'));
  assert.match(text(head), /Agree to this booking.*2 of 3/, 'the row does not say what it is and where it is in the queue');
  assert.match(head, /data-badge="wait"[^>]*>2 of 3</, '"2 of 3" is not the shared Badge');
  assert.match(ask, /<form[\s\S]*name="vendor_id" value="ev-rc"[\s\S]*Agree to this booking/, 'the booking ask cannot be agreed to from its row');
  assert.match(ask, /Turn it down/, 'the "no" left the row');
  assert.doesNotMatch(ask, /sn-card|sn-tile/, 'the answer is back in a box');
  assert.doesNotMatch(head, /<a\b/, 'the row became a door to another page — two answers have no other page');
});

test('2c · a delete request that IS the Next card keeps its row, open — the card’s button has somewhere to land', async () => {
  const { next, waiting } = await queue({ needsAnswer: [REMOVE, REPLY] });
  assert.equal(next.kind, 'answer');
  // The customer card has never carried this answer; the button goes to the row.
  assert.deepEqual(next.target, { to: 'today' });
  assert.deepEqual(waiting.asks.map((a) => [a.card.kind, a.position, a.open]), [
    ['delete_request', 1, true],
    ['message', 2, false],
  ]);
  const html = await render({ needsAnswer: [REMOVE, REPLY] });
  const row = html.slice(html.indexOf('data-today-ask="delete_request"'));
  assert.match(row.slice(0, 400), /data-fold-open=""[\s\S]*aria-expanded="true"/, 'the row is shut');
  assert.match(row, /name="vendor_id" value="ev-x"[\s\S]*Agree to remove it/);
  assert.match(row, /Keep it for now/);
  assert.match(html, /<a[^>]*href="\/vendor-dashboard#whats-new"/, 'the Next card’s Answer button does not go to the row');
  assert.match(html, /<section id="whats-new"/, 'the fragment the button names is not on the page');
});

test('2d · a date change IS answered on the Next card — Move · Unlock, the shipped fields, the refund sentence before the press', async () => {
  const html = await render({ needsAnswer: [REPLY, MOVE, BOOKING] });
  const at = html.indexOf('data-today-next="answer"');
  const card = html.slice(at, html.indexOf('data-today-numbers'));
  assert.match(text(card), /Date change request/);
  const forms = card.match(/<form[\s\S]*?<\/form>/g) ?? [];
  assert.equal(forms.length, 2, 'not exactly two answers on the card');
  assert.match(forms[0]!, /name="vendor_id" value="ev-cruz"[\s\S]*name="answer" value="moved"[\s\S]*class="ab ab-brand ab-main[^"]*"[\s\S]*Move/);
  assert.match(forms[1]!, /name="vendor_id" value="ev-cruz"[\s\S]*name="answer" value="unlocked"[\s\S]*class="ab ab-neutral[^"]*"[\s\S]*Unlock/);
  assert.match(text(card), /settled by the cancellation terms on the booking — Setnayan never decides a refund/, 'the refund sentence is not said before the press');
  assert.doesNotMatch(card, /<a\b[^>]*class="ab /, 'the card still has a link button — the answer is one tap, not a door');
  // …and it is not listed a second time below.
  assert.doesNotMatch(html, /data-today-ask="date_change"/);
  assert.match(text(html), /1 of 3/);
  // The page hands the card the SHIPPED action, not a new one.
  assert.match(code('app/vendor-dashboard/page.tsx'), /\{ card: nextIsAnswer, answer: vendorAnswerDateChange \}/);
});

/* ═══ 3 · EVERY DELETED BANNER'S MEANING IS STILL ON THE PAGE ══════════════ */

test('3 · each banner taken off Today either has a rule in pickSupplierNext or is a row', async () => {
  const picker = code('lib/supplier-today.ts');
  const pick = picker.slice(picker.indexOf('export function pickSupplierNext('), picker.indexOf('export const UPCOMING_READ_CAP'));
  assert.ok(pick.length > 1500 && pick.length < 4000, `the picker slice is ${pick.length} chars — the scan has gone blind`);
  // The three that HAVE a rule — named by the branch that decides them.
  for (const [banner, branch] of [
    ['first-steps rail', /if \(input\.setupStep\) \{\s*return \{\s*kind: 'setup'/],
    ['findability banner', /if \(input\.findability\) \{\s*return \{\s*kind: 'findable'/],
    ['booking-fee bills', /if \(input\.fee\) \{\s*return \{\s*kind: 'fee'/],
  ] as const) {
    assert.match(pick, branch, `${banner}: its rule is not in pickSupplierNext`);
  }
  // The two that DO NOT — the banner's meaning must survive as a row.
  assert.doesNotMatch(pick, /credit|payout/i, 'pickSupplierNext grew a rule — then the row below may be redundant; re-read this test');

  const page = code('app/vendor-dashboard/page.tsx');
  for (const gone of ['<VendorFirstSteps', '<SpotlightAwardBanner', '<PayoutMethodNudge', '<OngoingTasks', '<UpcomingSchedules', 'id="today-all"', 'Answering couples is free']) {
    assert.ok(!page.includes(gone), `${gone} is back on Today`);
  }
  assert.match(page, /payout: payoutCopy \? \{ title: payoutCopy\.cta, body: payoutCopy\.body, href: PAYMENT_OPTIONS_HREF \} : null,/, 'the payout nudge lost its row');
  assert.match(page, /const payoutCopy = hasBooking && !hasLockAsk \? payoutNudgeCopy\(payoutReadiness, 'today'\) : null;/, 'the payout row no longer follows the nudge’s own rule');
  assert.match(page, /const shopLine = \[categoryWord, shopState, awardWord, milestoneWord\]/, 'the award and the milestone left the Shop row');
  assert.match(page, /<BookingFeeBills\s+rows\s+bills=\{next\.kind === 'fee' \? todayFeeBills\.slice\(1\) : todayFeeBills\}/, 'the fee bills are no longer all on Today, as rows');
  assert.match(page, /hasBills=\{\(next\.kind === 'fee' \? todayFeeBills\.length - 1 : todayFeeBills\.length\) > 0\}/, 'the page does not say when it has bills, so they may be drawn with no heading');

  // A busy shop: an ask wins the Next card; every other thing still shows.
  const find = { title: 'Couples can’t find you yet.', body: 'b', cta: { label: 'Ask us', href: '/help#contact' } };
  const credit = { title: 'Your ₱2,500 credit expires in 3 days', body: 'Renew to keep it.', href: '/vendor-dashboard/subscription' };
  const payout = { title: 'Add a payment method', body: 'Couples can’t see anywhere to pay you yet.', href: '/vendor-dashboard/shop?open=payments#shop-folds' };
  const busy = await queue({ needsAnswer: [REPLY], findability: find, credit, payout });
  assert.equal(busy.next.kind, 'answer');
  assert.deepEqual(busy.waiting.doors.map((d) => d.id), ['findable', 'credit', 'payout']);
  const html = await render({ needsAnswer: [REPLY], findability: find, credit, payout });
  const doors = html.slice(html.indexOf('data-today-doors'), html.indexOf('data-today-shop'));
  const expected: ReadonlyArray<readonly [id: string, label: string, href: string]> = [
    ['findable', 'Couples can’t find you yet.', '/help#contact'],
    ['credit', 'Your ₱2,500 credit expires in 3 days', '/vendor-dashboard/subscription'],
    ['payout', 'Add a payment method', '/vendor-dashboard/shop?open=payments#shop-folds'],
  ];
  for (const [id, label, href] of expected) {
    assert.match(doors, new RegExp(`<a[^>]*data-today-row="${id}"[^>]*href="${href.replace(/[?#/.]/g, '\\$&')}"|<a[^>]*href="${href.replace(/[?#/.]/g, '\\$&')}"[^>]*data-today-row="${id}"`), `${id}: no row, or the row goes somewhere else`);
    assert.ok(text(doors).includes(label), `${id}: the row does not say "${label}"`);
  }
  // A quiet shop: findability wins the card, so it is NOT also a row.
  const quiet = await queue({ findability: find, credit });
  assert.equal(quiet.next.kind, 'findable');
  assert.deepEqual(quiet.waiting.doors.map((d) => d.id), ['credit']);
});

/* ═══ 4 · A FAILURE NEVER READS AS A ZERO ═════════════════════════════════ */

test('4 · an unread desk says so on the card and on its number; an unread payday says so where the money would be', async () => {
  const L = await lib();
  assert.equal(L.waitingOnYou(0, true), null, 'an unread desk that found nothing is not "0 waiting"');
  assert.equal(L.waitingOnYou(2, true), '2+', 'a short read that found two is "2+", not "2"');
  assert.equal(L.waitingOnYou(0, false), '0');
  assert.equal(L.waitingOnYou(3, false), '3');

  const html = await render({ deskIncomplete: true, owedPhp: null });
  assert.match(html, /data-today-next="unread"[^>]*data-next-bad=""|data-next-bad=""[^>]*data-today-next="unread"/, 'the unread card is not drawn as a failure');
  assert.match(text(html), /Some answers couldn’t load/);
  const nums = html.slice(html.indexOf('data-today-numbers'), html.indexOf('data-today-coming-up'));
  assert.equal((nums.match(/data-today-unread=""/g) ?? []).length, 2, 'both unread numbers say "couldn’t load"');
  for (const which of ['waiting', 'money']) {
    const at = nums.indexOf(`data-today-number="${which}"`);
    const tile = text(nums.slice(at, nums.indexOf('</a>', at)));
    assert.doesNotMatch(tile, /waiting on you|to come in/, `${which}: an unread number wears the words of a read one`);
    assert.doesNotMatch(tile, /\d/, `${which}: a figure is drawn over an unread read: ${tile}`);
    assert.match(tile, /couldn’t load/);
  }
  // The list under it speaks too — it is not "nothing waiting".
  assert.match(html, /role="status"/);
  assert.match(text(html), /Also waiting Some booking asks and payments couldn.t load/);
  // "Try again" reloads Today; it is not a link to a missing fragment.
  assert.match(html, /<a[^>]*class="ab ab-brand ab-main[^"]*"[^>]*href="\/vendor-dashboard"|<a[^>]*href="\/vendor-dashboard"[^>]*class="ab ab-brand ab-main[^"]*"/);
});

/* ═══ 5 · THE BUTTONS WEAR THEIR MEANING ══════════════════════════════════ */

test('5 · every main verb is terracotta, the icon says what kind of press it is — and every rule has a look', async () => {
  // Owner 2026-10-12, look call 1: "every MAIN action button is terracotta — the meaning colours … end for main
  // buttons; the word says what it does."
  const L = await lib();
  assert.deepEqual(L.nextLook('answer', REPLY), { tone: 'brand', icon: 'reply' });
  assert.deepEqual(L.nextLook('answer', BOOKING), { tone: 'brand', icon: 'check' });
  assert.deepEqual(L.nextLook('run_day', null), { tone: 'brand', icon: 'play' });
  assert.deepEqual(L.nextLook('unread', null), { tone: 'brand', icon: 'retry' });
  for (const kind of L.SUPPLIER_NEXT_ORDER) assert.equal(L.nextLook(kind, null).tone, 'brand', `${kind}'s main button is not terracotta`);
  for (const card of [REPLY, BOOKING, QUOTE, REMOVE, MOVE]) assert.equal(L.nextLook('answer', card).tone, 'brand', `${card.kind}'s main button is not terracotta`);
  // Every desk kind, not five samples: each entry of the two look tables, read from the source.
  const looks = code('lib/supplier-today.ts');
  for (const table of ['ANSWER_LOOK', 'RULE_LOOK']) {
    const block = looks.slice(looks.indexOf(`const ${table}:`), looks.indexOf('};', looks.indexOf(`const ${table}:`)));
    const tones = [...block.matchAll(/tone: '(\w+)'/g)].map((m) => m[1]);
    assert.ok(tones.length >= (table === 'ANSWER_LOOK' ? 13 : 8), `anti-vacuity: ${table} has ${tones.length} entries`);
    assert.deepEqual([...new Set(tones)], ['brand'], `${table}: a main button wears a meaning colour (${tones.join(' ')})`);
  }
  const reply = await render({ needsAnswer: [REPLY, BOOKING] });
  assert.match(reply, /class="ab ab-brand ab-main[^"]*"[^>]*href="\/vendor-dashboard\/messages\/t1"|href="\/vendor-dashboard\/messages\/t1"[^>]*class="ab ab-brand ab-main[^"]*"/, 'Reply is not the terracotta main button to the thread');
  // The grey second: a reply's "Their brief" opens the CARD, named section and all.
  assert.match(reply, /class="ab ab-neutral[^"]*"[^>]*href="\/vendor-dashboard\/clients\/e-ana\?tab=details"|href="\/vendor-dashboard\/clients\/e-ana\?tab=details"[^>]*class="ab ab-neutral[^"]*"/, 'no "Their brief", or it opens a bare client route');
  assert.match(text(reply), /Their brief/);
  // No grey button that lands by accident: a booking ask carries no thread id.
  const agree = await render({ needsAnswer: [BOOKING] });
  const card = agree.slice(agree.indexOf('data-today-next'), agree.indexOf('data-today-numbers'));
  assert.equal((card.match(/<a\b/g) ?? []).length, 1, 'a second button with nowhere named to go');
  assert.match(card, /class="ab ab-brand ab-main[^"]*"/);
  // Every answer in the rows is the button rule — a door is an ActionButton, a form's submit a SupplierSubmit —
  // and the main verb of each is terracotta, unless it takes something away for good (the delete look).
  const sections = code('app/vendor-dashboard/_components/overview-sections.tsx');
  assert.doesNotMatch(sections, /<SubmitButton\b|<button\b|<Link\b/, 'an answer in the rows is a hand-made button or link again');
  const mains = [...sections.matchAll(/<(?:SupplierSubmit|ActionButton)\b[^>]*?\btone="(\w+)"[^>]*?\bmain\b/g)].map((m) => m[1]);
  assert.ok(mains.length >= 10, `anti-vacuity: only ${mains.length} main buttons found`);
  assert.deepEqual([...new Set(mains)].sort(), ['brand', 'danger'], `a main answer wears a meaning colour: ${mains.join(' ')}`);
});

/* ═══ 6 · THE OUTCOME IS SAID, AS A TOAST ═════════════════════════════════ */

test('6 · the three outcome notices are the shared TOP toast + a status line — drawn by the server, and the line never leaves by itself', async () => {
  const page = code('app/vendor-dashboard/page.tsx');
  assert.match(page, /\{outcome \? <SupplierToast text=\{outcome\.text\} tone=\{outcome\.tone\} retry=\{genericFailure\.has\(outcome\.text\)\} \/> : null\}/, 'Today does not say the outcome');
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
  assert.match(text(shop), /Shop Open Lumina Studio Photo & video · Live Live/);
  assert.equal((shop.match(/href="\/vendor-dashboard\/shop"/g) ?? []).length, 2, 'the eyebrow door and the row both open Shop');
  assert.doesNotMatch(html, /bg-mulberry/, 'the mulberry shop block is back above the Next card');
  assert.match(shop, /data-badge="ok"[^>]*>Live</, '"Live" is not the shared Badge');
});

/* ═══ 8 · THE LOOK (owner 2026-10-12, "APPROVE ALL" look calls 1 · 7 · 8 · 9) ═══════════════════ */

test('8 · the Next card has no frame and no fill; every tap mark is terracotta; states are Badges; no colour written by hand', async () => {
  const html = await render({ needsAnswer: [REPLY, BOOKING, QUOTE], upcoming: [{ ...today, date: '2026-10-05', inDays: 3 }] });
  // (a) THE NEXT CARD: on the page's own ground — no `.home-card` frame, no tint, no gold wash.
  const open = html.match(/<div[^>]*data-today-next="answer"[^>]*>/)?.[0] ?? '';
  assert.ok(open, 'anti-vacuity: the Next card was not found');
  assert.match(open, /data-next-bare=""/);
  assert.doesNotMatch(open, /home-card(?![-\w])|style="|background|border(?!-)/, `the Next card has a frame or a fill again: ${open}`);
  const card = code('app/_components/next-card.tsx');
  assert.doesNotMatch(card, /--color-terracotta|terracotta\)\) 16%/, 'the soft gold fill is back');
  // …while a failure and an event day keep the ground that IS their state.
  const bad = await render({ deskIncomplete: true });
  assert.match(bad.match(/<div[^>]*data-today-next="unread"[^>]*>/)?.[0] ?? '', /home-card home-card-bad/, 'a failed read lost its danger wash');
  const day = await render({ upcoming: [today] });
  assert.match(day.match(/<div[^>]*data-today-next="run_day"[^>]*>/)?.[0] ?? '', /!bg-ink/, 'the event day lost its dark card');
  // 🌑 …and it stays a DARK card with light words in dark mode too. `ink` turns to paper there, so `bg-ink` alone
  // would draw a white slab with dark words (readable, but the opposite card). In dark mode the card takes the page's
  // ground lifted a little toward paper, and its words are the page's light ink.
  const { NEXT_DAY_CARD } = await import('@/app/_components/next-card');
  const lift = NEXT_DAY_CARD.match(/dark:!\[background:color-mix\(in_srgb,rgb\(var\(--color-ink\)\)_(\d+)%,rgb\(var\(--color-cream\)\)\)\]/);
  assert.ok(lift, 'the event-day card has no dark-mode ground of its own — it turns into a white slab');
  assert.ok(Number(lift![1]) <= 25, `the dark-mode day card is lifted ${lift![1]}% toward paper — no longer a dark card`);
  for (const words of [/dark:!text-ink(?![\w/-])/, /dark:\[&_\.home-card-body\]:!text-ink\/70/, /dark:\[&_\.home-eyebrow\]:!text-ink\/70/]) {
    assert.match(NEXT_DAY_CARD, words, `the dark-mode day card's words are not light: ${words.source}`);
  }
  // (b) THE MARK THAT SAYS "TAP THIS": every row arrow, the list doors and the mark under each number are the accent.
  const arrows = html.match(/<svg[^>]*lucide-chevron-(?:right|down)[^>]*>/g) ?? [];
  assert.ok(arrows.length >= 8, `anti-vacuity: only ${arrows.length} arrows`);
  for (const a of arrows) assert.match(a, /text-sn-accent/, `a tap mark is not terracotta: ${a}`);
  const nums = html.slice(html.indexOf('data-today-numbers'), html.indexOf('data-today-coming-up'));
  assert.equal((nums.match(/data-today-tapmark=""/g) ?? []).length, 3, 'each of the three numbers carries its small terracotta mark');
  assert.equal((nums.match(/<a\b/g) ?? []).length, 3, 'a number stopped being tappable');
  // The waiting number wears the accent token, never a colour written on the page.
  assert.match(nums, /class="[^"]*text-sn-accent[^"]*"[^>]*><span[^>]*data-count/, 'the waiting number is not the accent');
  const first = code('app/vendor-dashboard/_components/supplier-today-first-screen.tsx');
  assert.doesNotMatch(first, /mulberry|text-ink\/45|#[0-9a-fA-F]{3,8}\b/, 'the first screen writes a colour by hand again');
  // (c) A STATE is the shared Badge (soft fill, no border) — this page draws no pill of its own.
  assert.doesNotMatch(first + code('app/vendor-dashboard/_components/overview-sections.tsx'), /function TodayPill|data-today-pill/);
  const { BADGE_CLASS } = await import('@/app/_components/badge');
  assert.doesNotMatch(BADGE_CLASS, /\bborder\b|\bring\b|shadow/, 'a status chip has a border');
});
