/**
 * 💬 THE CHIPS FILTER BY WHAT A LINE IS — never by guessing (owner 19 Nov 2026, DECISION_LOG "THE CLIENT PAGE IS ONE
 * CHAT THAT HOLDS EVERYTHING"; drawing S9ScH2Ps v3, screens 5 · 12).
 *
 * What would silently undo it:
 *   1. a card lands under the wrong chip (a quote under Dates), or chatter is counted as a card;
 *   2. the chips' order or words drift from the drawing (All · Decisions · Forms · Money · Dates · Files);
 *   3. a payment's or a member's line stops being read by its exact words — the quiet step lines would then repeat the
 *      database's long line, or call a stranger's sentence a payment;
 *   4. the module the stream asks for EVERY line grows an import (it rides in the chat's first load);
 *   5. the filter's own line stops saying what it shows.
 *
 * SABOTAGE (19 Nov 2026, each seen RED then restored): `appointment_id` → 'money' (1) · KIND_CHIPS reordered (2) ·
 * the payment pattern loosened to /logged/ (3) · `import { formatPhp }` added to chat-kinds.ts (4).
 *
 * Run: cd apps/web && npx tsx --test lib/chat-kinds.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KIND_CHIPS, chatKindOf, countKinds, filterLine, isTalkRow, memberLineOf, paymentLineOf, talkLine } from './chat-kinds';
import { inquiryServiceOf } from './chat-card-lines';
import { TALK_VIEWS, THREAD_KINDS, isTalkView, parseThreadView, withThreadView } from './thread-view';

const sys = (body: string) => ({ sender_role: 'system', body });
const said = (body: string, more: object = {}) => ({ sender_role: 'couple', body, ...more });

test('1 · each row is its own kind; chatter is none', () => {
  assert.equal(chatKindOf(said('📄 Quote', { proposal_id: 'p1' })), 'money');
  assert.equal(chatKindOf(said('counter', { amendment_id: 'a1' })), 'money');
  assert.equal(chatKindOf(said('🏷 Offer', { vendor_offer_id: 7 })), 'money');
  assert.equal(chatKindOf(said('offered', { offered_service_id: 's1' })), 'money');
  assert.equal(chatKindOf(said('📅 Meeting request', { appointment_id: 'm1' })), 'dates');
  assert.equal(chatKindOf(sys('Counter · the total · ₱40,000 · Ana')), 'money');
  assert.equal(chatKindOf(sys('Plan proposed · Ana')), 'money');
  assert.equal(chatKindOf(sys('Quote rose to 150 pax · +₱32,500')), 'money');
  assert.equal(chatKindOf(sys('Payment logged · ₱9,000 · GCash · ref 123 · proof attached · waiting for the supplier to confirm')), 'money');
  assert.equal(chatKindOf(sys('First payment confirmed · ₱9,000')), 'money');
  assert.equal(chatKindOf(sys('Payment asked · ₱5,000 · due 12 Dec 2026')), 'money');
  assert.equal(chatKindOf(sys('Schedule changed · Ceremony · 2:00 PM → 2:30 PM · 30 min later')), 'dates');
  assert.equal(chatKindOf(sys('Booked ✓')), 'decisions');
  assert.equal(chatKindOf(sys('Poll · Lechon or roast beef?')), 'decisions');
  assert.equal(chatKindOf(sys('Guest count changed · 150 → 170 guests')), 'decisions');
  assert.equal(chatKindOf({ sender_role: 'vendor', body: 'I sent you a form — “Dietary needs”. Answer it in your event.' }), 'forms');
  assert.equal(chatKindOf(said('', { attachment_r2_key: 'k', attachment_name: 'Menu-v2.pdf' })), 'files');
  assert.equal(chatKindOf(said('', { attachment_name: 'Menu-v2.pdf', file_removed_at: '2026-11-19T00:00:00Z' })), null, 'a removed file is not a file');
  // Chatter — and a person TYPING a system line's words is still chatter.
  assert.equal(chatKindOf(said('We sent the deposit through GCash!')), null);
  assert.equal(chatKindOf(said('Payment logged · ₱9,000')), null);
  assert.equal(chatKindOf(sys('Liza joined')), null);
  // A message filed under a pinned decision is that decision's.
  assert.equal(chatKindOf(said('Roast beef please'), true), 'decisions');
  assert.equal(chatKindOf(said('📄 Quote', { proposal_id: 'p1' }), true), 'money', 'a card keeps its own kind when filed');
});

test('1 · the counts are the rows each chip shows', () => {
  const rows = [said('hi'), said('q', { proposal_id: 'p' }), said('q2', { proposal_id: 'p2' }), said('m', { appointment_id: 'm' }), sys('Booked ✓'), said('', { attachment_name: 'a.pdf' })];
  assert.deepEqual(countKinds(rows), { decisions: 1, forms: 0, money: 2, dates: 1, files: 1 });
  assert.deepEqual(countKinds(rows, (r) => r === rows[0]).decisions, 2);
});

test('2 · the chips are All · Chat · Private · Decisions · Forms · Money · Dates · Files — the `?view=` kinds in order, after the two that are not a kind (20 Nov 2026)', () => {
  assert.deepEqual(KIND_CHIPS.map((c) => c.label), ['All', 'Chat', 'Private', 'Decisions', 'Forms', 'Money', 'Dates', 'Files']);
  assert.deepEqual(KIND_CHIPS.slice(1, 3).map((c) => c.key), [...TALK_VIEWS]);
  assert.deepEqual(KIND_CHIPS.slice(3).map((c) => c.key), [...THREAD_KINDS]);
});

test('2b · Chat and Private are a way of LOOKING, never an address — a reload or a shared link opens the whole chat', () => {
  for (const v of TALK_VIEWS) {
    assert.equal(parseThreadView(v), 'all', `?view=${v} is read as a view`);
    assert.equal(withThreadView('/x?view=money&a=1', v), '/x?a=1', `${v} is written into the address`);
  }
  assert.equal(isTalkView('chat'), true);
  assert.equal(isTalkView('money'), false);
});

test('2c · Chat shows what people TYPED — never a card, never a line the app wrote; a message with a file is still one', () => {
  assert.equal(isTalkRow({ body: 'See you there', sender_role: 'couple' }), true);
  assert.equal(isTalkRow({ body: 'the floor plan', sender_role: 'vendor', attachment_r2_key: 'k' }), true);
  assert.equal(isTalkRow({ body: 'Booked ✓', sender_role: 'system' }), false);
  assert.equal(isTalkRow({ body: '', sender_role: 'vendor', proposal_id: 'p1' }), false);
  assert.equal(isTalkRow({ body: '', sender_role: 'couple', appointment_id: 'a1' }), false);
  assert.equal(talkLine('chat', 12), 'Showing Chat · 12 messages');
  assert.equal(talkLine('private', 1), 'Showing Private · 1 message');
  assert.equal(talkLine('private', 0), 'Nothing private here yet');
});

test('3 · a payment’s and a member’s line are read by their exact words', () => {
  assert.deepEqual(paymentLineOf('Payment logged · ₱9,000 · GCash · ref 123 · proof attached · waiting for the supplier to confirm'), { verb: 'logged', amount: '₱9,000', hasProof: true });
  assert.deepEqual(paymentLineOf('First payment confirmed · ₱9,000'), { verb: 'confirmed', amount: '₱9,000', hasProof: false });
  assert.equal(paymentLineOf('Payment asked · ₱5,000 · due 12 Dec 2026')!.verb, 'asked');
  assert.equal(paymentLineOf('Booked ✓'), null);
  assert.equal(paymentLineOf('We logged the payment yesterday'), null);
  assert.deepEqual(memberLineOf('Liza joined'), { name: 'Liza', verb: 'joined' });
  assert.deepEqual(memberLineOf('Liza was added to this chat by Ana'), { name: 'Liza', verb: 'joined' });
  assert.deepEqual(memberLineOf('Liza left this chat'), { name: 'Liza', verb: 'left' });
  assert.equal(memberLineOf('Booking ask closed'), null);
});

test('3 · the inquiry’s service is its own last line — absent says nothing', () => {
  assert.equal(inquiryServiceOf('Hi! Asking about your rates.\n\nService: Reception Lights & Sound'), 'Reception Lights & Sound');
  assert.equal(inquiryServiceOf('Hi!\n\nServices: Catering · Dessert bar\n— What we’re looking for —'), 'Catering · Dessert bar');
  assert.equal(inquiryServiceOf('Hi! What is your service area?'), null);
});

test('4 · the modules the stream asks for every line carry no weight', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const kinds = readFileSync(join(here, 'chat-kinds.ts'), 'utf8');
  const imports = [...kinds.matchAll(/^import (?!type\b)[^;]+ from '([^']+)';/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['./chat-card-lines'], 'chat-kinds.ts rides in the chat’s first load — it imports only the (import-free) line reader');
  assert.doesNotMatch(readFileSync(join(here, 'chat-card-lines.ts'), 'utf8'), /^import /m);
});

test('5 · the line over a filtered chat says what it shows', () => {
  assert.equal(filterLine('money', 4), 'Showing Money · 4 cards');
  assert.equal(filterLine('dates', 1), 'Showing Dates · 1 card');
});
