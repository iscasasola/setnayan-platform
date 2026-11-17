/**
 * 🔒 THE CLIENT CHAT SAYS WHAT IS TRUE (owner screenshot 17 Nov 2026, the supplier's client "Debut 18", booked, quote
 * v1 ₱26,750, on the #7901 preview). Each fault, held by what it DRAWS:
 *
 *   2 · AN ANSWERED ASK NEVER READS "WAITING" — the booking-ask card under "Booked ✓" still said "Waiting for your
 *       answer". A later book-request line answers every open ask before it (`answeredBookAsks`), the stream hands the
 *       answer to the card, and the card says it ("Answered · booked").
 *   3 · A PAST DUE DATE IS OVERDUE — held in `the-supplier-chat-gives-the-messages-room.test.ts` (1a, 1b).
 *   4 · THE PAGE MENU SAYS IT SCROLLS — "Hub · R…" was cut with no cue. A side with more pages past it fades
 *       (`data-picked-menu-more`), the pinned row's door-strip mask.
 *   6 · THE CLEAN LOOK (prototypes/dashboards_clean_look_2026-11-16_fable.html: "Removes … Uppercase section labels",
 *       "Removes Lines … between list rows") — the chat's kickers, stamps and headings are sentence case, no mono caps;
 *       the pins and the plan row are separated by space, not lines.
 *   (1 · "Not available" on the shop's own booked date is CHAT-29, `thread-day-answer-own-booking-reads-booked.test.ts`
 *    on #7870. 5 · the clipped newest bubble is open — not changed here.)
 *
 * 🛡 SABOTAGE (seen RED, then restored — 17 Nov 2026): `answeredAs` dropped from the stream's `<StreamLineCard` → test 2 RED;
 * the answered branch removed from the card → test 2 RED; `data-picked-menu-more` / `MENU_FADE` removed → test 4 RED;
 * `uppercase tracking-[0.08em]` put back on the card kicker → test 6 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { answeredBookAsks } from './chat-card-lines';

(globalThis as unknown as { React: unknown }).React = React;
const h = React.createElement;
const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ASK = "Booking ask sent by the hosts · waiting for the supplier's answer";

test('2a · a later answer closes every open ask before it — and only those', () => {
  const rows = [
    { id: 'a1', body: ASK },
    { id: 'x', body: 'Hello po' },
    { id: 'b1', body: 'Booked ✓' },
    { id: 'a2', body: ASK },
  ];
  const m = answeredBookAsks(rows);
  assert.equal(m.get('a1'), 'booked');
  assert.equal(m.has('a2'), false, 'an ask after the answer is still waiting');
  assert.equal(m.has('b1'), false, 'the answer line itself is not an answered ask');
  assert.equal(answeredBookAsks([{ id: 'a', body: ASK }, { id: 'n', body: 'Not available · Booked that day' }]).get('a'), 'not_available');
  assert.equal(answeredBookAsks([{ id: 'a', body: ASK }]).size, 0);
});

test('2b · the card says how it was answered; the stream hands it the answer', async () => {
  const { BookRequestCard } = await import('@/app/_components/chat/cards/book-request-card');
  const base = { state: 'asked' as const, reason: null, supplierName: 'you', at: 'Nov 14, 12:25 AM' };
  const waiting = renderToStaticMarkup(h(BookRequestCard, base));
  assert.match(waiting, /Waiting for your answer/, 'anti-vacuity: an open ask no longer says it waits');
  const answered = renderToStaticMarkup(h(BookRequestCard, { ...base, answeredAs: 'booked' }));
  assert.doesNotMatch(answered, /Waiting/);
  assert.match(answered, /data-book-request-answered="booked"[^>]*>Answered · booked</);

  const stream = read('app/_components/chat-message-stream.tsx');
  const mount = stream.match(/<StreamLineCard\b[\s\S]*?\/>/)?.[0] ?? '';
  assert.match(mount, /answeredAs=\{bookAskAnswers\.get\(m\.message_id\) \?\? null\}/, 'the stream does not pass the answer');
  assert.match(stream, /answeredBookAsks\(messages\.filter\(\(m\) => m\.sender_role === 'system'\)/);
  const line = read('app/_components/chat/cards/stream-line-card.tsx');
  assert.match(line, /<BookRequestCard [^>]*answeredAs=\{answeredAs\}/);
});

test('4 · the page menu fades on the side that has more pages', () => {
  const shell = read('app/_components/picked/picked-shell.tsx');
  const menu = shell.slice(shell.indexOf('role="tablist"'), shell.indexOf('data-picked-menu=""') + 200);
  assert.match(menu, /\$\{MENU_FADE\[/, 'the menu draws no edge fade');
  assert.match(menu, /data-picked-menu-more=/);
  assert.match(shell, /el\.scrollLeft \+ el\.clientWidth < el\.scrollWidth - 2/, 'the right-side cue is not measured');
  assert.match(shell, /el\.addEventListener\('scroll', measure/);
});

test('6 · the chat speaks in sentence case and separates with space', () => {
  const files = [
    'app/_components/chat-message-stream.tsx',
    'app/_components/chat/chat-step-card.tsx',
    'app/_components/chat/chat-pins.tsx',
    'app/_components/chat/decision-panel.tsx',
    'app/_components/chat/chat-blocker.tsx',
    'app/_components/chat/agreed-now.tsx',
  ];
  for (const f of files) {
    const src = read(f);
    assert.ok(src.length > 500, `anti-vacuity: ${f} is empty`);
    const caps = src.match(/className="[^"]*\buppercase\b[^"]*"/g) ?? [];
    assert.deepEqual(caps, [], `${f} still draws an uppercase label`);
  }
  const pins = read('app/_components/chat/chat-pins.tsx');
  assert.doesNotMatch(pins, /border-t border-ink\/\[0\.07\]|border-b border-ink\/10/, 'the pins are split by lines');
  const plan = read('app/vendor-dashboard/messages/[threadId]/_components/vendor-payment-live.tsx');
  const fold = plan.slice(plan.indexOf('if (fold) {'), plan.indexOf('data-chat-plan-payment=""'));
  assert.ok(fold.length > 200, 'anti-vacuity: the folded plan moved');
  assert.doesNotMatch(fold, /border-[tb] border-ink\/10/, 'the folded plan row is split by lines');
});
