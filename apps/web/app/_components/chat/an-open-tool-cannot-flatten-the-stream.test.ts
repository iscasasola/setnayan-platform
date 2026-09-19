/**
 * an-open-tool-cannot-flatten-the-stream.test.ts
 *
 * 🚨 OWNER, 2026-09-19, supplier side, Tools → "Send a quote" open:
 * "something is terribly wrong". The message bubbles painted ON TOP of the
 * quote builder's couple name and PAX / HRS inputs, and clicks landed on them.
 *
 * Measured live (988×1265): the stream's wrapper had a COMPUTED HEIGHT OF 0;
 * its list kept its own 224px floor and spilled out of the zero box, across
 * the open 701px panel. Every box from the ChatBox frame down to the list said
 * `min-h-0`, so the list's floor constrained NOTHING above it — the open tray
 * took the whole column and the stream kept only an overflow.
 *
 * THE PROPERTY: the conversation's floor reaches the frame. Two halves, both
 * required (each measured alone in a Chromium harness and each failing):
 *   (1) the ChatBox root keeps its AUTOMATIC minimum — no `min-h-0` — so it is
 *       never shorter than header + stream floor + composer + open tray, and
 *       the page's scrolling `<section>` scrolls instead of the tray overlapping;
 *   (2) every view scroller is `basis-0` with a `min-h-[≥14rem]` floor, so that
 *       automatic minimum counts the FLOOR and not the thread. Without
 *       `basis-0` an 80-message thread grew the frame to ~3,900px and the
 *       composer left the screen on every busy thread.
 * Every tool in the tray (`build-quote`, the call, the payment log, …) renders
 * inside the same `tray` slot, so the property holds for all of them at once;
 * and both thread pages (supplier and couple) mount this one frame.
 *
 * ⚠ SCOPE, STATED. This reads SOURCE: it proves the classes that produced the
 * measured layout are present, not that a browser paints them. The harness
 * numbers are in chat-box.tsx's docblock.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../../../lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const BOX = read('app/_components/chat/chat-box.tsx');
const STREAM = read('app/_components/chat-message-stream.tsx');
const PAGES = [
  'app/vendor-dashboard/messages/[threadId]/page.tsx',
  'app/dashboard/[eventId]/messages/[threadId]/page.tsx',
] as const;

const classes = (s: string) => s.split(/\s+/).filter(Boolean);

/** Every className (plain or template literal) whose classes include all of `must`. */
function classNamesWith(src: string, must: string[]): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const list = classes((m[1] ?? m[2] ?? '').replace(/\$\{[^}]*\}/g, ' '));
    if (must.every((c) => list.includes(c))) out.push(list.join(' '));
  }
  return out;
}

test('the anchor: the frame, the stream and both pages were read', () => {
  assert.ok(BOX.length > 500, 'chat-box.tsx read as a stub');
  assert.ok(STREAM.length > 20000, 'chat-message-stream.tsx read as a stub');
  for (const p of PAGES) {
    const s = read(p);
    assert.equal((s.match(/<ChatBox\b/g) ?? []).length, 1, `${p} no longer mounts the one ChatBox frame`);
  }
});

test('(1) the ChatBox root keeps its automatic minimum, so an open tray cannot take the stream’s floor', () => {
  const roots = classNamesWith(BOX, ['flex-1', 'flex-col']).filter((c) => c.includes('sn-row'));
  assert.equal(roots.length, 1, `expected exactly one framed flex-1 root in chat-box.tsx, found ${roots.length}`);
  const root = classes(roots[0]!);
  assert.ok(
    !root.some((c) => c === 'min-h-0' || /^min-h-(px|\[0(px|rem)?\])$/.test(c)),
    `the ChatBox root zeroed its minimum (${roots[0]}). With a tool open it then shrinks to the ` +
      "column's height, the stream wrapper measures 0px, and the messages paint over the tool.",
  );
});

test('the page column that holds the frame scrolls, so a frame taller than the column is reachable', () => {
  for (const p of PAGES) {
    const s = read(p);
    const at = s.indexOf('<ChatBox');
    const open = s.lastIndexOf('<section className="', at);
    assert.ok(open !== -1, `${p}: no <section> wraps the ChatBox`);
    const cls = classes(s.slice(open + '<section className="'.length, s.indexOf('"', open + '<section className="'.length)));
    assert.ok(cls.includes('overflow-y-auto'), `${p}: the column around the frame does not scroll`);
    assert.ok(cls.includes('min-h-0'), `${p}: the column can grow past its row instead of scrolling`);
  }
});

test('(2) every view scroller carries a floor AND basis-0, so the frame’s minimum is the floor, not the thread', () => {
  const scrollers = classNamesWith(STREAM, ['flex-1', 'overflow-y-auto']);
  // Conversation, Decisions, Files. Counted, so a fourth view cannot slip in unfloored.
  assert.equal(scrollers.length, 3, `expected 3 flex-1 view scrollers, found ${scrollers.length}: ${scrollers.join(' | ')}`);
  for (const s of scrollers) {
    const list = classes(s);
    const floor = list.map((c) => /^min-h-\[(\d+(?:\.\d+)?)rem\]$/.exec(c)).find(Boolean);
    assert.ok(floor && Number(floor[1]) >= 14, `a view scroller has no ≥14rem floor (${s})`);
    assert.ok(
      list.includes('basis-0'),
      `a view scroller is not basis-0 (${s}) — the frame's automatic minimum then counts every ` +
        'message, and a busy thread pushes the composer thousands of pixels down.',
    );
  }
  // And name the conversation list itself, so the Decisions/Files scrollers can never stand in for it.
  const ol = STREAM.slice(STREAM.indexOf('<ol'), STREAM.indexOf('>', STREAM.indexOf('className=', STREAM.indexOf('<ol'))));
  assert.match(ol, /(^|[\s`])basis-0(\s|`)/, 'the conversation <ol> is not basis-0');
});
