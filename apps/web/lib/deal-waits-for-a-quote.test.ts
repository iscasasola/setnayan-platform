import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { dealEntryFor, threadHasQuote } from './deal-entry';
import { affordanceReveal } from './chat-box-tools';
import { VENDOR_THREAD_PANELS } from './vendor-thread-tools';
import type { ThreadStage } from './vendor-thread-stage';

/**
 * A DEAL WAITS FOR A QUOTE — on both sides, from one decision.
 *
 * Owner live test, 2026-09-19: the supplier's composer 🧾 opened "Deal or
 * meeting → Send a deal" (the amendment builder, first line "Freebie") when he
 * wanted to send a FIRST quote; and the couple saw a "🧾 Send a deal" chip under
 * their own opening inquiry. A Deal amends a quote; with none there is nothing
 * to amend. `lib/deal-entry.ts` decides it once; this file EXECUTES that
 * decision for both sides × quote / no quote, and pins that every mount reads it.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

const COUPLE = 'app/dashboard/[eventId]/messages/[threadId]/page.tsx';
const VENDOR = 'app/vendor-dashboard/messages/[threadId]/page.tsx';
const MENU = 'app/_components/negotiation-composer-menu.tsx';
const STREAM = 'app/_components/chat-message-stream.tsx';
const BUTTON = 'app/_components/chat/reveal-tool-button.tsx';

/* ── 1 · the decision, executed ─────────────────────────────────────────── */

test('supplier, no quote: the 🧾 is "Send a quote" and opens the one quote tool; no Send a deal', () => {
  const e = dealEntryFor({ side: 'vendor', hasQuote: false });
  assert.equal(e.offerDeal, false);
  assert.equal(e.composer.label, 'Send a quote');
  assert.equal(e.composer.icon, 'quote');
  assert.deepEqual([...e.composer.reveal], ['build-quote']);
  assert.ok(
    VENDOR_THREAD_PANELS.some((p) => p.id === e.composer.reveal[0]),
    'the quote icon reveals something that is not a panel',
  );
  // The Deal-or-meeting panel, still reachable from the rail, offers the quote first.
  assert.deepEqual(e.menuQuote && [...e.menuQuote.reveal], ['build-quote']);
  assert.ok(e.menuNote, 'the menu says nothing about why Send a deal is missing');
});

test('couple, no quote: no Send a deal anywhere; the 🧾 opens the meeting request', () => {
  const e = dealEntryFor({ side: 'couple', hasQuote: false });
  assert.equal(e.offerDeal, false);
  assert.equal(e.menuQuote, null, 'a couple cannot send a quote');
  assert.deepEqual([...e.composer.reveal], [...affordanceReveal('deal')]);
  assert.equal(e.composer.label, 'Request a meeting');
  assert.doesNotMatch(e.composer.label, /deal/i);
});

test('a quote exists: both sides are exactly as before', () => {
  for (const side of ['vendor', 'couple'] as const) {
    const e = dealEntryFor({ side, hasQuote: true });
    assert.equal(e.offerDeal, true, `${side}: Send a deal withheld after a quote`);
    assert.equal(e.composer.icon, 'deal');
    assert.equal(e.composer.label, 'Deal or meeting');
    assert.deepEqual([...e.composer.reveal], [...affordanceReveal('deal')]);
    assert.equal(e.menuQuote, null);
    assert.equal(e.menuNote, null);
  }
});

test('"has a quote" is built from the rung and the live total — nothing new is read', () => {
  const stages: ThreadStage[] = ['inquiry', 'quoted', 'booked', 'completed', 'cancelled'];
  const expectNoTotal: Record<ThreadStage, boolean> = {
    inquiry: false,
    quoted: true,
    booked: true, // a booking is enough for the amendment action
    completed: true,
    cancelled: false,
  };
  for (const stage of stages) {
    assert.equal(threadHasQuote({ stage, liveQuoteTotalPhp: null }), expectNoTotal[stage], stage);
    // A live quote total always means there is something to amend.
    assert.equal(threadHasQuote({ stage, liveQuoteTotalPhp: 45_000 }), true, `${stage} + total`);
  }
  // ₱0 is a quote, not an absence.
  assert.equal(threadHasQuote({ stage: 'inquiry', liveQuoteTotalPhp: 0 }), true);
});

/* ── 2 · every mount reads that one decision ────────────────────────────── */

function tag(s: string, open: RegExp): string {
  const at = s.search(open);
  assert.ok(at >= 0, `no ${open}`);
  // Walk to the tag's own closing `>` / `/>`, skipping `=>` inside props.
  let i = at;
  for (; i < s.length; i++) {
    if (s[i] === '>' && s[i - 1] !== '=') break;
  }
  return s.slice(at, i + 1);
}

test('the scan reads every file (an empty read is a green lie)', () => {
  for (const rel of [COUPLE, VENDOR, MENU, STREAM, BUTTON]) {
    assert.ok(read(rel).length > 500, `${rel} read as too short`);
  }
});

test('both thread pages decide once, for their own side, from threadHasQuote', () => {
  for (const [rel, side] of [
    [COUPLE, 'couple'],
    [VENDOR, 'vendor'],
  ] as const) {
    const s = read(rel);
    assert.equal(count(s, /\bdealEntryFor\(/g), 1, `${rel}: dealEntryFor called ${count(s, /\bdealEntryFor\(/g)} times`);
    assert.equal(count(s, /\bthreadHasQuote\(/g), 1, `${rel}: threadHasQuote not called once`);
    const call = s.slice(s.indexOf('dealEntryFor('), s.indexOf('dealEntryFor(') + 200);
    assert.match(call, new RegExp(`side:\\s*'${side}'`), `${rel}: decides for the wrong side`);
    assert.match(call, /hasQuote:\s*threadHasQuote\(/, `${rel}: hasQuote is not the shared derivation`);
  }
});

test('the menu, the composer icon and the stream on both pages all receive it', () => {
  for (const rel of [COUPLE, VENDOR]) {
    const s = read(rel);
    assert.match(tag(s, /<NegotiationComposerMenu\b/), /\bentry=\{dealEntry\}/, `${rel}: the menu is not told`);
    assert.match(
      tag(s, /<RevealToolButton affordance="deal"/),
      /\bentry=\{dealEntry\}/,
      `${rel}: the composer 🧾 is not told`,
    );
    assert.match(tag(s, /<ChatMessageStream\b/), /\bdealEntry=\{dealEntry\}/, `${rel}: the stream is not told`);
  }
});

test('the menu offers Send a deal, and opens the builder, only when the entry says so', () => {
  const s = read(MENU);
  assert.equal(count(s, /🧾 Send a deal/g), 1);
  const at = s.indexOf('🧾 Send a deal');
  const before = s.slice(0, at);
  const gate = before.lastIndexOf('{entry.offerDeal ? (');
  assert.ok(gate > 0, 'Send a deal is not inside an entry.offerDeal gate');
  assert.ok(!before.slice(gate).includes(') : null}'), 'the entry.offerDeal gate closes before Send a deal');
  assert.match(s, /if \(mode === 'deal' && entry\.offerDeal\) \{/, 'the builder opens without a quote');
  assert.equal(count(s, /<AmendmentBuilder\b/g), 1);
});

test('the chip under a message is gated on the entry', () => {
  const s = read(STREAM);
  assert.equal(count(s, /<AmendmentSuggestChip\b/g), 1);
  const at = s.indexOf('<AmendmentSuggestChip');
  const cond = s.slice(s.lastIndexOf('{negotiationOn &&', at), at);
  assert.match(cond, /\bdealEntry\.offerDeal\s*&&/, 'the Send a deal chip renders with no quote');
});

test('the composer icon opens what the entry names', () => {
  const s = read(BUTTON);
  assert.match(s, /entry \? entry\.composer\.reveal : affordanceReveal\(affordance\)/);
  assert.match(s, /revealThreadTool\(reveal\)/);
});
