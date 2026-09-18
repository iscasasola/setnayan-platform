/**
 * an-open-tool-does-not-bury-the-conversation.test.ts
 *
 * 🚨 OWNER SCREENSHOTS, 2026-09-11, supplier side, "Build a quote" open, on a
 * laptop AND on a phone. One cause, three symptoms:
 *   (a) the composer drew ON TOP of the All / Decisions / Files view tabs —
 *       the message stream between them had collapsed to nothing;
 *   (b) the page's side panels ended partway down while the quote builder
 *       kept going past them;
 *   (c) on a phone the bottom menu bar sat over the composer.
 *
 * ROOT CAUSE: the three-column row is a FIXED height, and the conversation
 * column inside it did not scroll. An open tool (`vendorTools` — the quote
 * builder is taller than a laptop screen) squeezed the flex-1 stream to zero
 * and everything after it overflowed the row.
 *
 * THE FIX, AND THE ONE IT IS NOT:
 *   · the row KEEPS its fixed height — that is what keeps a long thread
 *     scrolling inside its own box with the composer pinned under it;
 *   · the conversation column scrolls itself (`min-h-0` + `overflow-y-auto`);
 *   · the stream has a FLOOR, so an open tool pushes it down instead of
 *     flattening it.
 *   ✗ NOT `min-h` alone on the row. Measured in a layout harness (2026-09-11):
 *     it fixes the tool case, but an 80-message thread then grows the row to
 *     ~5,190px and the composer lands ~5,100px down the page — every busy
 *     thread loses its pinned composer. This file fails that variant.
 *
 * ── 2026-09-18 · ONE CHAT BOX — where the floor lives now ───────────────────
 * The page became one frame (`ChatBox`). The stream is the frame's CHILD slot,
 * the tools are its `tray` BELOW the composer (the approved layout draws a tool
 * where a phone's attachment tray opens), and the floor is no longer a wrapper
 * `<div>` on this page: it is the list's own `min-h-[14rem]` inside
 * `chat-message-stream.tsx` (#5584), reached through the slot's `min-h-0
 * flex-1`. So the floor is now a CHAIN of three files, and this test walks the
 * chain instead of reading "the div before <ChatMessageStream>" — that anchor
 * was pinned to source order, and once the composer became a prop written
 * before the child it pointed at the declined-inquiry notice.
 *
 * A row `min-h-[27rem]` FLOOR beside the fixed height is allowed (and required
 * by a-quote-card-does-not-crush-the-conversation.test.ts): it only wins on a
 * phone shorter than the frame's parts, where the page scrolling a few pixels
 * beats the frame clipping its own composer. A `min-h-[calc(…)]` INSTEAD of a
 * height is still the forbidden variant.
 *
 * Measured with the tray OPEN (harness, 2026-09-18): the list holds 224px at
 * every width from 320 to 1440 — the floor — and the open panel scrolls inside
 * its own 55dvh cap while the column scrolls to reach the composer.
 *
 * ⚠ SCOPE, STATED. This reads SOURCE: it proves the classes that produce the
 * measured layout are present, not that a browser paints them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../../../../lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
// Four up: [threadId] → messages → vendor-dashboard → app → apps/web (the same
// depth the strip-comments import above spells).
const WEB = join(HERE, '..', '..', '..', '..');
const RAW = readFileSync(join(HERE, 'page.tsx'), 'utf8');
const SRC = stripComments(RAW);
const BOX = stripComments(readFileSync(join(WEB, 'app/_components/chat/chat-box.tsx'), 'utf8'));
const STREAM = stripComments(readFileSync(join(WEB, 'app/_components/chat-message-stream.tsx'), 'utf8'));
const PANEL = stripComments(readFileSync(join(WEB, 'app/_components/chat/thread-tool-panel.tsx'), 'utf8'));

/** The className of the element that opens immediately before `anchor`. */
function classOfElementBefore(src: string, anchor: string, tag: string): string {
  const at = src.indexOf(anchor);
  assert.ok(at !== -1, `anchor ${anchor} not found in page.tsx`);
  const open = src.lastIndexOf(`<${tag} className="`, at);
  assert.ok(open !== -1, `no <${tag} className="…"> before ${anchor}`);
  const start = open + `<${tag} className="`.length;
  return src.slice(start, src.indexOf('"', start));
}

const has = (classes: string, cls: string) => classes.split(/\s+/).includes(cls);
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('the anchor: page.tsx was read and is not a stub', () => {
  assert.ok(RAW.length > 4000, 'page.tsx read as a stub — every assertion below would pass vacuously');
  assert.ok(SRC.includes('<ConversationColumn'), 'the three-column row moved');
  for (const [name, src] of [['chat-box', BOX], ['chat-message-stream', STREAM], ['thread-tool-panel', PANEL]] as const) {
    assert.ok(src.length > 500, `${name}.tsx read as a stub`);
  }
});

test('the row keeps a FIXED height, so a long thread scrolls inside its own box', () => {
  const row = classOfElementBefore(SRC, '<ConversationColumn', 'div');
  assert.ok(
    has(row, 'h-[calc(100dvh-12rem)]'),
    `the row lost its fixed height (${row}). A min-h row lets an 80-message thread grow the page ` +
      'to ~5,000px and drops the composer below the fold on every busy thread.',
  );
  assert.ok(!/(^|\s)min-h-\[calc/.test(row), `the row uses a min-h floor instead of a height (${row})`);
});

test('the conversation column scrolls itself when an open tool needs more room', () => {
  const section = classOfElementBefore(SRC, '<ChatBox', 'section');
  assert.ok(has(section, 'overflow-y-auto'), `the conversation column does not scroll (${section}) — an open tool overflows the row again`);
  assert.ok(has(section, 'min-h-0'), `the column has no min-h-0 (${section}) — it can grow past the row instead of scrolling`);
});

test('the stream keeps a floor, so an open tool cannot flatten it to zero', () => {
  // (1) The stream is the frame's child slot — between <ChatBox …> and </ChatBox>.
  const open = SRC.indexOf('<ChatBox');
  const close = SRC.indexOf('</ChatBox>');
  const stream = SRC.indexOf('<ChatMessageStream');
  assert.ok(open !== -1 && close > open, 'the page no longer renders one <ChatBox>…</ChatBox>');
  assert.equal(count(SRC, /<ChatMessageStream\b/g), 1, 'the stream is mounted more or less than once');
  assert.ok(stream > open && stream < close, 'the stream is not the ChatBox child — the slot below cannot size it');
  // (2) The slot fills the frame and may shrink to let the list scroll.
  const slotAt = BOX.indexOf('{children}');
  assert.ok(slotAt !== -1, 'ChatBox has no children slot');
  const slotOpen = BOX.lastIndexOf('<div className="', slotAt);
  const slot = BOX.slice(slotOpen + '<div className="'.length, BOX.indexOf('"', slotOpen + '<div className="'.length));
  assert.ok(has(slot, 'flex-1'), `the stream slot does not fill the frame (${slot})`);
  assert.ok(has(slot, 'min-h-0'), `the stream slot has no min-h-0 (${slot}) — the list cannot scroll inside it`);
  // (3) The list itself carries the floor — the thing an open tool cannot push through.
  const olOpen = STREAM.indexOf('<ol');
  const olEnd = STREAM.indexOf('>', olOpen);
  const ol = STREAM.slice(olOpen, olEnd);
  assert.match(ol, /(^|[\s`])min-h-\[\d+rem\]/, 'the conversation list has no height floor — the composer lands on the view tabs again');
  assert.match(ol, /(^|[\s`])flex-1(\s|`|$)/, 'the conversation list does not fill its column');
});

test('an open tool sits in the tray below the composer, capped, so it pushes the column rather than covering the conversation', () => {
  // The tools are passed as the frame's tray and rendered nowhere else.
  assert.equal(count(SRC, /tray=\{vendorTools\}/g), 1, 'vendorTools is not the ChatBox tray');
  assert.equal(count(SRC, /(^|[^=])\{vendorTools\}/g), 0, 'vendorTools is also rendered outside the tray — a second, uncapped copy');
  // The frame renders the tray AFTER the composer, so an open panel lands under
  // the box the supplier is writing in — never between the tabs and the list.
  const composerAt = BOX.indexOf('{composer}');
  const trayAt = BOX.indexOf('{tray}');
  assert.ok(composerAt !== -1 && trayAt !== -1, 'ChatBox lost its composer or tray slot');
  assert.ok(trayAt > composerAt, 'the tray renders before the composer — an open tool covers the conversation again');
  // And a panel's body scrolls inside a viewport cap, so "Build a quote" cannot
  // grow the frame past the screen.
  assert.match(PANEL, /max-h-\[\d+dvh\] overflow-y-auto/, 'an open tool can grow without limit again');
  assert.match(PANEL, /\[&:not\(\[open\]\)\]:hidden/, 'a closed tool takes space again');
});
