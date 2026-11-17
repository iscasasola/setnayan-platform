/**
 * 🔒 THE SUPPLIER CHAT GIVES THE MESSAGES ROOM (DECISION_LOG 2026-11-16 CHAT-09, owner "Yes, build it"; drawing
 * `chat-room-proto.html`, Now beside Proposed). Measured on the 16 Nov screenshot at 390 × 844: the plan card, the date
 * row and a two-line who's-here strip left the messages ≈170 px. As drawn, the pinned area is head 56 · tabs 60 · strip
 * 48 · plan row 48 = 212 px, and the messages keep ≈568 px. Each piece, held by what it DRAWS:
 *
 *   1 · THE PLAN FOLDS — in the chat `VendorPaymentLive` draws ONE 44 px row ("Plan · ₱0 of ₱8,750 · next ₱1,750
 *       Nov 15") that opens in place; "Mark payment cleared" is one tap deeper with its helper words in an ⓘ, and
 *       "Payment ›" opens the picked client's Payment page. The customer card's Payment tab keeps the whole card.
 *       A newly logged payment opens the row once (the due-now pins' rule).
 *   2 · THE DATE + "FREE" SIT UNDER THE TITLE — the picked shell has a line under its title, the supplier's Chat puts
 *       the compact answer there, and the separate answer row is not drawn.
 *   3 · THE WHO'S-HERE STRIP IS ONE 48 px ROW — faces · "Shared chat · N inside" · one ⓘ holding the names (and the
 *       privacy words); no names under the faces, no "in the chat now" on the line; the ring still marks who is here.
 *   4 · THE POLL AND DECISION FORMS RISE FULL SCREEN — the same steps through the shared `RiseScreen`: the head holds
 *       ✕ · the title over "You · not sent yet" · ⓘ, the foot holds the count · Back · Next.
 *   (5 · the jump row is held by `a-quote-card-does-not-crush-the-conversation.test.ts`.)
 *
 * 🛡 SABOTAGE (seen RED, then restored — 16 Nov 2026): `fold=` dropped from the thread page's `<VendorPaymentLive` → 1
 * RED; the folded row drawn open by default (`useState(true)`) → 1 RED; `{answerLine}`-style full row put back
 * (`compact` dropped from the head's answer) → 2 RED; the names put back under the faces (sr-only removed) → 3 RED;
 * `rise=` dropped from the poll card → 4 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { PLAN_FOLD_SEEN_KEY, planFoldLine, planFoldOpensFor, planShortDate } from './chat-plan-fold';
import { computePlanRollup, type StepperInstallment } from './vendor-service-payment-schedules';

(globalThis as unknown as { React: unknown }).React = React;
// The plan component's server actions reach `import 'server-only'`; stub the marker (as the repo's other render tests
// do), then load the components lazily.
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}
const h = React.createElement;
const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const THREAD = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
const CLIENT = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
const STREAM = read('app/_components/chat-message-stream.tsx');

const step = (seq: number, label: string, amount: number, due: string, state: StepperInstallment['state']): StepperInstallment =>
  ({ seq, label, amount_php: amount, amount_kind: 'fixed', percent_bps: null, due_date: due, state }) as unknown as StepperInstallment;
// The drawing's sample: ₱1,750 + ₱7,000, nothing received.
const STEPS = [step(1, 'First payment', 1750, '2026-11-15', 'due'), step(2, 'Final balance', 7000, '2026-12-02', 'due')];

test('1a · the folded row says the plan in one line, and a new logged payment opens it once', () => {
  assert.equal(planShortDate('2026-11-15'), 'Nov 15');
  assert.equal(planFoldLine(computePlanRollup(STEPS), false, true), '₱0 of ₱8,750 · next ₱1,750 Nov 15');
  const pending = [step(1, 'First payment', 1750, '2026-11-15', 'pending'), STEPS[1]!];
  assert.equal(planFoldLine(computePlanRollup(pending), false, true), '₱0 of ₱8,750 · ₱1,750 to confirm');
  assert.equal(planFoldLine(computePlanRollup(STEPS), true, true), 'cleared · nothing outstanding');
  assert.equal(planFoldLine(computePlanRollup([]), false, false), 'no payment schedule');
  // Opens for a payment this device has not shown; not again once seen; nothing pending → stays as the person left it.
  assert.equal(planFoldOpensFor(['p1'], null), true);
  assert.equal(planFoldOpensFor(['p1'], 'p1'), false);
  assert.equal(planFoldOpensFor(['p1', 'p2'], 'p1'), true);
  assert.equal(planFoldOpensFor([], 'p1'), false);
  assert.equal(PLAN_FOLD_SEEN_KEY('t1'), 'sn-chat-plan-seen:t1');
});

test('1b · the chat mounts the plan FOLDED; the Payment tab mounts it whole', async () => {
  // The thread page: one mount, folded, its door the picked client's Payment page.
  const mounts = THREAD.match(/<VendorPaymentLive\b[\s\S]*?\/>/g) ?? [];
  assert.equal(mounts.length, 1, `the thread page mounts the plan ${mounts.length} times`);
  assert.match(mounts[0]!, /fold=\{\{ paymentHref: customerCardHref\(thread\.event_id, 'payments'\) \}\}/, 'the chat does not fold the plan');
  // Inside the picked client it sits under the strip (the stream's pinned stack); full screen, in the band.
  assert.match(THREAD, /\{embedded \? null : paymentLive\}/);
  assert.match(THREAD, /\{\.\.\.\(embedded \? \{ planRow: paymentLive \} : \{\}\)\}/);
  const stack = STREAM.slice(STREAM.indexOf('<ChatPinnedStack'), STREAM.indexOf('</ChatPinnedStack>'));
  const scrolling = stack.slice(stack.indexOf('fixed={'));
  assert.match(scrolling.slice(scrolling.indexOf('>\n')), /\{planRow\}/, 'the plan row is not in the pinned stack');
  // The customer card's Payment tab: never folded.
  const tab = CLIENT.match(/<VendorPaymentLive\b[\s\S]*?\/>/g) ?? [];
  assert.ok(tab.length >= 1, 'anti-vacuity: the Payment tab no longer mounts the plan');
  for (const m of tab) assert.doesNotMatch(m, /\bfold=/, 'the Payment tab folds the plan');

  // Drawn: closed, it is ONE row with the line — no stepper, no clear button; whole, it is the card as shipped.
  const { VendorPaymentLive } = await import('@/app/vendor-dashboard/messages/[threadId]/_components/vendor-payment-live');
  const plan = { eventVendorId: 'ev1', vendorLabel: 'Liwanag Lights & Sound', clearedAt: null, steps: STEPS } as never;
  const base = { threadId: 't1', eventId: 'e1', initialPending: [], initialPlans: [plan] };
  const folded = renderToStaticMarkup(h(VendorPaymentLive, { ...base, fold: { paymentHref: '/vendor-dashboard/clients/e1?tab=payments' } }));
  assert.match(folded, /data-chat-plan-fold="closed"/);
  assert.equal((folded.match(/data-chat-plan-row=""/g) ?? []).length, 1);
  assert.match(folded, /<b class="font-semibold text-ink">Plan<\/b> · ₱0 of ₱8,750 · next ₱1,750 Nov 15/);
  assert.match(folded, /class="sn-press flex h-11 w-full/, 'the row is not 44 px');
  assert.doesNotMatch(folded, /Mark payment cleared|Payment plan —|First payment/, 'the folded row draws the open card');
  const whole = renderToStaticMarkup(h(VendorPaymentLive, base));
  assert.match(whole, /Payment plan — Liwanag Lights &amp; Sound/);
  assert.match(whole, /Mark payment cleared/);
  assert.match(whole, /Confirm every payment above before you can mark the plan/);
  assert.doesNotMatch(whole, /data-chat-plan-row/);
  // Opened, the clear is one tap deeper with its words behind an ⓘ, and "Payment ›" is the door.
  const live = read('app/vendor-dashboard/messages/[threadId]/_components/vendor-payment-live.tsx');
  const open = live.slice(live.indexOf('data-chat-plan-open=""'), live.indexOf('data-chat-plan-payment=""'));
  assert.match(open, /\{clearForm\}[\s\S]*<Explain title="Mark payment cleared"[\s\S]*'Confirm every payment first\.'/);
  assert.match(open, /href=\{fold\.paymentHref\}[\s\S]*nav\.select\('payments'\)/);
});

test('2 · the date and the day’s word sit under the title; the separate row is gone', async () => {
  const shell = read('app/_components/picked/picked-shell.tsx');
  const pin = shell.slice(shell.indexOf('data-picked-pin=""'), shell.indexOf('data-picked-head-actions=""'));
  assert.ok(pin.indexOf('<h1') >= 0 && pin.indexOf('<h1') < pin.indexOf('data-picked-head-line=""'), 'no line under the title');
  assert.match(shell, /<PickedHeadLineContext\.Provider value=\{headLineSlot\}>[\s\S]*\{bodies\[page\]\}/);
  // The page puts the compact answer in the head (picked) or on the head's own line (full screen) — never a row.
  assert.match(THREAD, /\{embedded \? <PickedHeadLine>\{answerInHead\(true\)\}<\/PickedHeadLine> : null\}/);
  assert.match(THREAD, /\{answerInHead\(false\)\}/);
  assert.equal((THREAD.match(/<ThreadAnswerLine\b/g) ?? []).length, 1, 'a second answer line is drawn');
  assert.match(THREAD.slice(THREAD.indexOf('<ThreadAnswerLine'), THREAD.indexOf('/>', THREAD.indexOf('<ThreadAnswerLine'))), /\bcompact\b/, 'the answer is a row again');
  const { ThreadAnswerLine } = await import('@/app/vendor-dashboard/messages/[threadId]/_components/thread-answer-line');
  const html = renderToStaticMarkup(
    h(ThreadAnswerLine, { initials: 'TW', eventDay: '2026-11-16', todayIso: '2026-11-01', answer: { kind: 'free' } as never, askOpen: false, compact: true }),
  );
  assert.match(html, /^<span data-thread-day-answer="free"/, 'the compact answer is not one inline line');
  assert.match(html, /Free/);
  assert.doesNotMatch(html, />TW</, 'the initials came along into the head');
  assert.doesNotMatch(html, /min-h-\[56px\]|border-b/, 'the compact answer draws a row');
});

test('3 · the who’s-here strip is one 48 px row; the names and "in the chat now" live behind its ⓘ', async () => {
  const { ChatHostStrip } = await import('@/app/_components/chat/chat-host-strip');
  const host = (userId: string, firstName: string, role: string) => ({ userId, firstName, name: firstName, role, label: null });
  const html = renderToStaticMarkup(
    h(ChatHostStrip, {
      hosts: [host('u-in', 'Indigo', 'bride')],
      presentIds: new Set(['u-me']),
      youId: 'u-me',
      threadId: 't1',
      viewerSide: 'vendor',
      note: h('b', null, 'privacy words'),
    }),
  );
  assert.match(html, /^<div[^>]*data-chat-host-strip=""><div class="flex h-12 items-center/, 'the strip is not one 48 px row');
  assert.match(html, /<b class="font-semibold text-ink">Shared chat<\/b> · 2 inside/);
  assert.doesNotMatch(html, /in the chat now/, '"in the chat now" is back on the line');
  // No visible name under a face: every name outside the ⓘ is for a screen reader only.
  const beforeTip = html.slice(0, html.indexOf('role="tooltip"'));
  for (const name of ['Indigo']) {
    const seen = beforeTip.split(name).length - 1;
    const hidden = (beforeTip.match(new RegExp(`class="sr-only">${name}\\b`, 'g')) ?? []).length + (beforeTip.match(new RegExp(`aria-label="Message ${name} privately"`, 'g')) ?? []).length;
    assert.equal(seen, hidden, `${name} is drawn under a face again`);
  }
  // The ⓘ holds the names and the privacy words; the ring still marks who is here.
  const tip = html.slice(html.indexOf('role="tooltip"'));
  assert.match(tip, /data-chat-host-names="">You · Indigo</);
  assert.match(tip, /privacy words/);
  assert.equal((html.match(/ring-success-600/g) ?? []).length, 1, 'the ring no longer marks who is in the chat now');
});

test('4 · the poll and decision forms rise full screen — same steps, Back / Next in the thumb zone', async () => {
  for (const rel of ['app/_components/chat/cards/poll-card.tsx', 'app/_components/chat/cards/decision-step-card.tsx']) {
    const card = read(rel).match(/<ChatStepCard\b[\s\S]*?\/>/)?.[0] ?? '';
    assert.match(card, /\brise=\{\{ info: /, `${rel}: the form does not rise`);
  }
  assert.match(read('lib/chat-plus.ts'), /RISING_DRAFTS[^=]*= new Set<PlusCardKind>\(\['poll', 'decision'\]\)/);
  const { ChatStepCard } = await import('@/app/_components/chat/chat-step-card');
  const steps = [
    { title: 'Ask it', sub: 'One question both sides answer in the chat.', body: h('input', { name: 'q' }), ok: false },
    { title: 'The choices', body: h('input', { name: 'c' }), ok: false },
  ];
  const html = renderToStaticMarkup(
    h(ChatStepCard, { topic: 'poll', kicker: 'You · not sent yet', title: 'Poll', steps, step: 0, onStep: () => {}, sendLabel: 'Open poll', submitForm: 'f1', onClose: () => {}, rise: { info: 'One poll at a time' } }),
  );
  assert.match(html, /data-rise-screen="chat-step-poll"/, 'the poll form is not a risen screen');
  assert.doesNotMatch(html, /data-chat-card=/, 'the risen form is still a card in the chat');
  const head = html.slice(html.indexOf('data-rise-head'), html.indexOf('data-rise-body'));
  assert.match(head, /data-rise-close=""/);
  assert.match(head, />Poll<\/b>/);
  assert.match(head, />You · not sent yet<\/small>/);
  assert.match(head, /data-rise-info-button=""/);
  const body = html.slice(html.indexOf('data-rise-body'), html.indexOf('data-rise-thumb'));
  assert.match(body, /Ask it/);
  assert.match(body, /One question both sides answer in the chat\./);
  const thumb = html.slice(html.indexOf('data-rise-thumb'));
  assert.match(thumb, /1 of 2/);
  assert.match(thumb, /Back/);
  assert.match(thumb, /Next/);
  // Without `rise`, every other (+) card is unchanged: a card in the chat.
  const card = renderToStaticMarkup(
    h(ChatStepCard, { topic: 'poll', kicker: 'You · not sent yet', title: 'Poll', steps, step: 0, onStep: () => {}, submitForm: 'f1' }),
  );
  assert.match(card, /data-chat-card="poll"/);
  assert.doesNotMatch(card, /data-rise-screen/);
});
