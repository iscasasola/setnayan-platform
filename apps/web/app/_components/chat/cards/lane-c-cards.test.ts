/**
 * 🪜 THE LANE-C CHAT CARDS, HELD (Supplier Build 3 · lane C · plans/supplier_build_3_2026-11-08).
 *
 * Source guards — one per card — for the properties a unit test of `lib/chat-cards.ts` cannot see: that each card is
 * a LAZY chunk (the shared bundle has no headroom), that every read has an honest "Couldn't load", that each Send goes
 * to the SHIPPED writer (never a second write path), that the Agree is drawn only to a coordinator and enforced on the
 * server, that a locked item is never offered for an ask, and that the (+) no longer stubs a card that exists.
 * Run from apps/web: tsx --test app/_components/chat/cards/lane-c-cards.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(__dirname, '..', '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const CARDS = 'app/_components/chat/cards';
const cardFiles = readdirSync(join(WEB, CARDS)).filter((f) => f.endsWith('.tsx') && f !== 'lazy-cards.tsx' && f !== 'card-bits.tsx');

test('⚡ the chat reaches every card ONLY through lazy-cards (next/dynamic) — no card module in the first load', () => {
  const lazy = read(`${CARDS}/lazy-cards.tsx`);
  for (const m of lazy.matchAll(/export const (\w+) = (.+);/g)) assert.match(m[2]!, /^dynamic\(\(\) => import\(\/\* webpackChunkName: "chat-cards-(plus|stream)" \*\/ '\.\/[\w-]+'\)/, `${m[1]} is not a dynamic import into one of the two named card chunks`);
  for (const rel of ['app/_components/chat/plus-draft.tsx', 'app/_components/chat-message-stream.tsx']) {
    const src = read(rel);
    assert.match(src, /from '\.\/(chat\/)?cards\/lazy-cards'/, `${rel} must import the cards from lazy-cards`);
    assert.doesNotMatch(src, /from '\.\/(chat\/)?cards\/(?!lazy-cards)[\w-]+'/, `${rel} imports a card module directly`);
    assert.doesNotMatch(src, /from '@\/lib\/chat-cards'/, `${rel} pulls the card rules (and the schedule resolver) into the first load`);
  }
  // The one module the stream reads for every line imports nothing.
  assert.doesNotMatch(read('lib/chat-card-lines.ts'), /^import /m);
});

test('🪫 every card that reads says "Couldn\'t load" on a refusal — never an empty list dressed as none', () => {
  const bits = read(`${CARDS}/card-bits.tsx`);
  assert.match(bits, /Couldn&rsquo;t load \{what\}/);
  for (const f of ['quote-step-card.tsx', 'payment-step-card.tsx', 'log-payment-card.tsx', 'form-step-card.tsx', 'ask-change-card.tsx', 'guest-recount-card.tsx']) {
    const src = read(`${CARDS}/${f}`);
    assert.match(src, /<CouldNotLoad /, `${f} has no failed state`);
    assert.match(src, /at: 'failed'/, `${f} never reaches its failed state`);
  }
  // …and the actions keep "none" and "refused" apart.
  const actions = read(`${CARDS}/card-actions.ts`);
  assert.match(actions, /if \(!q\) return \{ ok: true, quote: null \}/);
  assert.match(actions, /if \(qErr \|\| floorRes\.error \|\| gate\.error\) return refused\(/, 'a refused floor (or S5 gate) read must not pass as "no floor"');
});

test('🧾 every Send is the SHIPPED writer', () => {
  assert.match(read(`${CARDS}/quote-step-card.tsx`), /await sendCustomProposalFromChat\(fd\)/);
  assert.match(read(`${CARDS}/guest-recount-card.tsx`), /await sendCustomProposalFromChat\(fd\)/);
  assert.match(read(`${CARDS}/form-step-card.tsx`), /await formsAction\(/);
  assert.match(read(`${CARDS}/form-step-card.tsx`), /await saveSupplierAnswers\(/);
  const actions = read(`${CARDS}/card-actions.ts`);
  assert.match(actions, /await logPayment\(formData\)/);
  assert.match(actions, /await askForPaymentCore\(formData\)/);
  // A decision opens through lane B's one door (chat_decision_open), never a chat line of its own.
  assert.match(actions, /await openDecision\(await createClient\(\), threadId, topic\)/);
  assert.doesNotMatch(read(`${CARDS}/decision-step-card.tsx`), /chat_messages|patchPlus/);
  // The client page's ask is the same core plus its redirects — one write path, two returns.
  const clients = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  assert.match(clients, /export async function vendorAskForPayment[\s\S]{0,200}await askForPaymentCore\(formData\)/);
  assert.equal((clients.match(/from\('vendor_payment_asks'\)\.insert\(/g) ?? []).length, 1, 'one insert of a payment ask');
});

test('🤝 Log a payment: Agree is drawn only to a coordinator, required on the client, and enforced on the server', () => {
  const card = read(`${CARDS}/log-payment-card.tsx`);
  assert.match(card, /\{target\.toCoordinator \? \(\s*<label/);
  assert.match(card, /logPaymentStepOk\(d, i, target\.toCoordinator\)/);
  const actions = read(`${CARDS}/card-actions.ts`);
  const body = actions.slice(actions.indexOf('export async function logPaymentFromChat'));
  // The category is read from the booking on the server, never trusted from the form, BEFORE the shipped write.
  assert.ok(body.indexOf(".select('category')") > 0 && body.indexOf(".select('category')") < body.indexOf('await logPayment(formData)'));
  assert.ok(body.indexOf('logPaymentRefusal(') < body.indexOf('await logPayment(formData)'));
});

test('💬 Ask for a change: only the hosts\' side, never on a locked item; the supplier answers Revise | Decline in one row', () => {
  const src = read(`${CARDS}/ask-change-card.tsx`);
  assert.match(src, /askForAChange\(\{ readerIsSupplier: false, locked: locks\[s as AskSubject\] === true/);
  assert.match(src, /'s price is final/);
  assert.match(src, /<EqualRow>\s*<ActionButton tone="neutral" icon=\{X\} label="Decline"[\s\S]{0,200}label="Revise"/);
  const stream = read('app/_components/chat-message-stream.tsx');
  assert.match(stream, /viewerRole === 'couple' && isLatestProposal && card[\s\S]{0,120}<AskChangeDoor/);
  assert.match(stream, /changes_locked, plan_locked/);
});

test('👥 Guest count: Apply | Keep price in one equal row; a locked quote is told, never recounted', () => {
  const src = read(`${CARDS}/guest-recount-card.tsx`);
  assert.match(src, /<EqualRow>\s*<ActionButton tone="ok" main icon=\{Check\} label=\{`Apply/);
  assert.match(src, /label="Keep price"/);
  assert.match(src, /r\.kind === 'locked' \?/);
  assert.match(src, /locked: q\.locks\.quote/);
});

test('🔘 every action is an ActionButton; Enter moves on through the frame (Shift+Enter is a new line)', () => {
  for (const f of cardFiles) {
    const src = read(`${CARDS}/${f}`);
    // Raw <button> only for a tap-to-open ROW (owner 4 Nov: rows tap open, swipe left removes) — never an action.
    const raw = [...src.matchAll(/<button\b[\s\S]*?>/g)].map((m) => m[0]);
    for (const b of raw) assert.match(b, /type="button"/, `${f}: a raw button that is not a row`);
    assert.ok(raw.length <= 1, `${f}: more than one hand-drawn button`);
  }
  const form = read(`${CARDS}/form-step-card.tsx`);
  assert.match(form, /if \(isStepEnter\(e, e\.target\)\)/, 'the host face answers on Enter like the frame');
});

test('🪜 the (+) no longer stubs a card that exists', () => {
  const src = read('app/_components/chat/plus-draft.tsx');
  for (const k of ["'quote'", "'payment'", "'logpay'", "'form'", "'photos'", "'file'", "'decision'"]) assert.match(src, new RegExp(`draft\\.kind === ${k}`), `${k} is not routed to its card`);
  assert.doesNotMatch(src, /comes in Lane C/);
});
