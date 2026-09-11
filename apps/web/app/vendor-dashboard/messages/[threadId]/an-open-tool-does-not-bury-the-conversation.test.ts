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
 *   · the stream sits in a wrapper with a floor (`min-h-[20rem] flex-1`), so
 *     an open tool pushes it down instead of flattening it.
 *   ✗ NOT `min-h` on the row. Measured in a layout harness (2026-09-11): it
 *     fixes the tool case, but an 80-message thread then grows the row to
 *     ~5,190px and the composer lands ~5,100px down the page — every busy
 *     thread loses its pinned composer. This file fails that variant.
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
const RAW = readFileSync(join(HERE, 'page.tsx'), 'utf8');
const SRC = stripComments(RAW);

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

test('the anchor: page.tsx was read and is not a stub', () => {
  assert.ok(RAW.length > 4000, 'page.tsx read as a stub — every assertion below would pass vacuously');
  assert.ok(SRC.includes('<ConversationColumn'), 'the three-column row moved');
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
  const section = classOfElementBefore(SRC, '{vendorTools}', 'section');
  assert.ok(has(section, 'overflow-y-auto'), `the conversation column does not scroll (${section}) — an open tool overflows the row again`);
  assert.ok(has(section, 'min-h-0'), `the column has no min-h-0 (${section}) — it can grow past the row instead of scrolling`);
});

test('the stream keeps a floor, so an open tool cannot flatten it to zero', () => {
  const floor = classOfElementBefore(SRC, '<ChatMessageStream', 'div');
  assert.ok(has(floor, 'flex-1'), `the stream wrapper does not fill the column (${floor})`);
  assert.ok(/(^|\s)min-h-\[\d+rem\]/.test(floor), `the stream wrapper has no height floor (${floor}) — the composer lands on the view tabs again`);
});

test('the tools still mount ABOVE the stream, so they push it down rather than cover it', () => {
  const toolsAt = SRC.indexOf('{vendorTools}');
  const streamAt = SRC.indexOf('<ChatMessageStream');
  assert.ok(toolsAt !== -1 && streamAt !== -1, 'vendorTools or ChatMessageStream is no longer rendered');
  assert.ok(toolsAt < streamAt, 'vendorTools must render before <ChatMessageStream>');
});
