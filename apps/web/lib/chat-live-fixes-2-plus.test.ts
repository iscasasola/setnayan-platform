/**
 * 🧪 THE 16 NOV WALK, ROUND 2 — the chat's ＋, its running topic and its pins (CHAT-19 · 20 · 25 · 26 · 27).
 *
 * What would silently undo it:
 *   CHAT-19  a booked chat offers "Change quote" (supplier) or "Counter with a price" (hosts) OPEN again — both only
 *            reached a refusal ('deal_locked') — or hides them instead of drawing them shut with the way forward — or the locked-quote card says "change order" with no door to one;
 *   CHAT-20  a ＋ row that leaves the sheet (a link, See every version, a panel) opens it in the same tick the sheet
 *            steps back through its own history entry — the step back then closes / overtakes what was opened;
 *   CHAT-25  `jumpTo` moves nothing when the PAGE is the chat's scroller (the new card sat at y≈1114 of 844);
 *   CHAT-26  the running topic is named from its kind capitalised ("Logpay") instead of the card's own title;
 *   CHAT-27  a money pin with no body in place ("Due now · Answer ›") presses into nothing.
 *
 * SABOTAGE (16 Nov): dropping `lockedAtBooking` from `supplierPlusRows` → CHAT-19 RED (re-checked 16 Nov after the shut-not-hidden change); restoring
 * `kind[0].toUpperCase()` in the stream → CHAT-26 RED; emptying `PIN_JUMP_ANCHOR` → CHAT-27 RED; putting
 * `setTimeout(() => door.click(), 0)` back in the sheet → CHAT-20 RED.
 *
 * Run: cd apps/web && npx tsx --test lib/chat-live-fixes-2-plus.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BOOKED_CHANGE_QUOTE_REASON, BOOKED_COUNTER_REASON, PLUS_CARD_TITLE, hostPlusRows, supplierChangeOrderHref, supplierPlusRows } from './chat-plus';
import { MONEY_STEP_ANCHOR, PIN_JUMP_ANCHOR, pinPress } from './chat-pins';
import { centredScrollTop, inViewport } from './chat-plus-store';

const APP = join(__dirname, '..', 'app');
const read = (p: string) => readFileSync(join(APP, p), 'utf8');

test('CHAT-19 · a booked chat shows "Change quote" SHUT with its reason to the supplier — never hidden', () => {
  const open = supplierPlusRows({ paid: false, hasQuote: true });
  const booked = supplierPlusRows({ paid: true, hasQuote: true, booked: true });
  const q = (rows: typeof open) => rows.find((r) => r.label === 'Change quote');
  assert.ok(q(open) && !q(open)?.shutNow, 'an unbooked quote still changes');
  assert.deepEqual(q(booked)?.shutNow, { reason: BOOKED_CHANGE_QUOTE_REASON }, 'a booked one is locked with the way forward');
  assert.match(BOOKED_CHANGE_QUOTE_REASON, /change order/);
  // Nothing else changes: the same rows, in the same order.
  assert.deepEqual(booked.map((r) => r.label), open.map((r) => r.label));
});

test('CHAT-19 · a booked chat shows "Counter with a price" SHUT with its reason to the hosts — never hidden', () => {
  const open = hostPlusRows({ canLogPayment: true });
  const booked = hostPlusRows({ canLogPayment: true, booked: true });
  const c = (rows: typeof open) => rows.find((r) => r.label === 'Counter with a price');
  assert.ok(c(open) && !c(open)?.shutNow);
  assert.deepEqual(c(booked)?.shutNow, { reason: BOOKED_COUNTER_REASON });
  assert.match(BOOKED_COUNTER_REASON, /change order/);
  assert.deepEqual(booked.map((r) => r.label), open.map((r) => r.label));
});

test('CHAT-19 · the sheets pass the booked fact the other booked rows read', () => {
  const sheet = read('vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet.tsx');
  assert.match(sheet, /supplierPlusRows\(\{[^}]*booked: state\.hasAgreement/);
  assert.match(sheet, /hostPlusRows\(\{[^}]*booked \}\)/);
  const couple = read('dashboard/[eventId]/messages/[threadId]/page.tsx');
  assert.match(couple, /<CoupleThreadToolsSheet[^>]*booked=\{THREAD_STAGE_HAS_AGREEMENT\[threadStage\]\}/);
});

test('CHAT-19 · "use a change order" opens the shipped change orders', () => {
  assert.equal(supplierChangeOrderHref('ev-1'), '/vendor-dashboard/clients/ev-1?tab=schedule');
  // The supplier's shipped Change orders live on the picked client's Schedule.
  const clients = read('vendor-dashboard/clients/[eventId]/page.tsx');
  assert.ok(clients.includes('vendorRaiseChangeOrder'), 'the change-order form moved — re-point supplierChangeOrderHref');
  const card = read('_components/chat/cards/quote-step-card.tsx');
  const locked = card.slice(card.indexOf("q.requote === 'deal_locked'"), card.indexOf("q.requote === 'lock_requested'"));
  assert.match(locked, /href=\{supplierChangeOrderHref\(q\.eventId\)\}/, 'the locked card names its door');
  const recount = read('_components/chat/cards/guest-recount-card.tsx');
  assert.match(recount, /href=\{supplierChangeOrderHref\(q\.eventId\)\}/);
});

test('CHAT-20 · a row that leaves the sheet waits for the sheet to step back first', () => {
  const sheet = read('vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet.tsx');
  assert.ok(!/setTimeout\(\(\) => door\.click\(\), 0\)/.test(sheet), 'the versions press is not raced against the step back');
  assert.match(sheet, /afterSheetStepsBack\(\(\) => \{\s*const door = document\.querySelector/);
  assert.match(sheet, /afterSheetStepsBack\(\(\) => router\.push\(href\), holds\)/, 'Report a problem (a link) waits too');
  assert.match(sheet, /afterSheetStepsBack\(\(\) => revealThreadTool\(reveal\), holds\)/);
  // With one version, the row is shut with its reason instead of pressing into nothing.
  assert.match(sheet, /r\.act === 'versions' && !r\.shut && !versionsDoor/);
});

test('CHAT-25 · a jump centres the card, and the page scrolls when no conversation scroller does', () => {
  assert.equal(centredScrollTop(1114, 300, 844), 1114 - 422 + 150);
  assert.equal(centredScrollTop(20, 100, 844), 0);
  // A card taller than the screen lands with its top on the screen, not its middle.
  assert.equal(centredScrollTop(2000, 3000, 800), 2000);
  assert.equal(inViewport(1114, 1414, 844), false);
  assert.equal(inViewport(100, 400, 844), true);
  const store = readFileSync(join(__dirname, 'chat-plus-store.ts'), 'utf8');
  assert.match(store, /window\.scrollTo\(/);
});

test('CHAT-26 · the running topic wears the card’s own title', () => {
  assert.equal(PLUS_CARD_TITLE.logpay, 'Log a payment');
  const stream = read('_components/chat-message-stream.tsx');
  assert.match(stream, /title: PLUS_CARD_TITLE\[plusState\.draft\.kind\]/);
  assert.ok(!/draft\.kind\[0\]!?\.toUpperCase\(\)/.test(stream), 'never the kind capitalised ("Logpay")');
});

test('CHAT-27 · a money pin with nothing in place jumps to the money step in the chat', () => {
  assert.deepEqual(pinPress('payment_due', false), { jump: MONEY_STEP_ANCHOR });
  assert.deepEqual(pinPress('payment_due', true), { open: 'body' });
  assert.equal(pinPress('call_time', false), null);
  assert.equal(PIN_JUMP_ANCHOR.confirm_payment, MONEY_STEP_ANCHOR);
  const stream = read('_components/chat-message-stream.tsx');
  assert.match(stream, /id=\{MONEY_STEP_ANCHOR\}/, 'the anchor the pins jump to is drawn');
  const pins = read('_components/chat/chat-pins.tsx');
  assert.match(pins, /pinPress\(f\.kind, Boolean\(body\)\)/);
});
