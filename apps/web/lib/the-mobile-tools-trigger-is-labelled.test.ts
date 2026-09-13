/**
 * THE MOBILE TOOLS TRIGGER IS LABELLED.
 *
 * ── WHAT BROKE ──────────────────────────────────────────────────────────────
 * `ChatInfoRailTrigger` is the ONLY way into the supplier's tools (Build a
 * quote, Send proposal, Log payment, Propose schedule, Offer another service,
 * Voice call, Video call, Deal or meeting, Log the outcome) on a phone-width
 * screen — the desktop column (`ChatInfoRailColumn`) is `lg:` only. It used to
 * render as a bare 36px circle carrying only an `<Info>` icon and an
 * `aria-label`, no visible text. A supplier on a live thread could not find it
 * (owner, live test, 2026-09-11: "i cannot access tools when on mobile
 * mode?"). The tools were never missing — the door to them was invisible.
 *
 * ── WHAT THIS PINS ──────────────────────────────────────────────────────────
 * The trigger must carry a visible text label, not just an icon and an
 * aria-label a sighted mouse/touch user never reads. This scans the STRIPPED
 * source so a comment describing the old bug (this docblock, or the
 * component's own) can never be mistaken for the label itself.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const RAIL = 'app/vendor-dashboard/messages/[threadId]/_components/chat-info-rail.tsx';

const src = stripComments(readFileSync(join(WEB, RAIL), 'utf8'));

test('the scan actually read the file (an empty read is a green lie)', () => {
  assert.ok(src.length > 500, `${RAIL} read as ${src.length} chars — the scan is not reading it`);
  assert.ok(src.includes('export function ChatInfoRailTrigger'), 'the trigger export moved or was renamed');
});

// Isolate the trigger function body so a match elsewhere in the file (the
// desktop column, the rail's own "Tools" section heading) can't stand in for
// the mobile button itself.
function triggerBody(source: string): string {
  const start = source.indexOf('export function ChatInfoRailTrigger');
  assert.ok(start >= 0, 'ChatInfoRailTrigger not found');
  const nextExport = source.indexOf('\nfunction RailBody', start);
  assert.ok(nextExport > start, 'could not find the end of ChatInfoRailTrigger (RailBody moved?)');
  return source.slice(start, nextExport);
}

// Isolate just the <button>…</button> that opens the sheet, not the <Sheet>
// content that follows it in the same function.
function triggerButton(fnSrc: string): string {
  const buttonStart = fnSrc.indexOf('<button');
  const buttonEnd = fnSrc.indexOf('</button>', buttonStart);
  assert.ok(buttonStart >= 0 && buttonEnd > buttonStart, 'no <button> found inside ChatInfoRailTrigger');
  return fnSrc.slice(buttonStart, buttonEnd + '</button>'.length);
}

// The opening `<button ...>` tag carries `onClick={() => ...}`, whose `=>`
// is itself a `>` character — a naive "match up to the first `>`" split
// would stop there instead of at the real end of the opening tag. Prettier
// always formats a multi-attribute opening tag with the closing `>` alone on
// its own line, so anchor on THAT line instead.
function childrenOf(elementSrc: string): string {
  const lines = elementSrc.split('\n');
  const closeIdx = lines.findIndex((l) => /^\s*>\s*$/.test(l));
  assert.ok(
    closeIdx >= 0,
    'could not find the opening tag\'s own closing ">" line — did the button collapse onto one line?',
  );
  return lines.slice(closeIdx + 1).join('\n');
}

test('🔑 the trigger button carries visible text, not just an icon', () => {
  const button = triggerButton(triggerBody(src));
  const children = childrenOf(button);
  // The icon (whatever it is) is allowed and expected — aria-hidden so AT
  // skips it — but the button must ALSO carry ordinary JSX text a sighted
  // user reads. Strip the icon's own self-closing tag, then require real
  // word characters left over.
  const textNode = children
    .replace(/<\w+\s+aria-hidden[^/]*\/>/, '') // the icon
    .replace(/<\/button>\s*$/, '')
    .replace(/<[^>]*>/g, ' ') // any other tag
    .trim();
  assert.ok(
    /[A-Za-z]{3,}/.test(textNode),
    `the trigger button has no visible text label left after stripping its icon — got ${JSON.stringify(textNode)}`,
  );
});

test('🔑 the aria-label still names both halves of what the sheet opens', () => {
  const button = triggerButton(triggerBody(src));
  const m = button.match(/aria-label="([^"]+)"/);
  assert.ok(m, 'the trigger button lost its aria-label');
  const label = m![1]!.toLowerCase();
  assert.ok(label.includes('customer'), `aria-label should still name the customer info: ${m![1]}`);
  assert.ok(label.includes('tool'), `aria-label should also name the tools: ${m![1]}`);
});

test('🔑 the button is not sized back down to an icon-only tap target', () => {
  const button = triggerButton(triggerBody(src));
  // The old icon-only circle was a fixed h-9 w-9 (36×36) with no horizontal
  // padding for text. A labelled pill needs `px-*` room for the word and must
  // not reintroduce that fixed square sizing.
  assert.ok(/\bpx-\d/.test(button), 'the trigger has no horizontal padding — looks like a fixed-size icon button again');
  assert.ok(
    !/\bh-9\s+w-9\b/.test(button) && !/\bw-9\s+h-9\b/.test(button),
    'the trigger reintroduced the old fixed 36×36 icon-only sizing',
  );
});

test('the sheet it opens still exists and is labelled by the same heading', () => {
  const fn = triggerBody(src);
  assert.ok(/<Sheet\b/.test(fn), 'ChatInfoRailTrigger no longer renders <Sheet>');
  assert.ok(/labelledById=\{HEADING_ID\}/.test(fn), 'the sheet lost its labelledById wiring');
});
