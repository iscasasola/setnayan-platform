import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  CHAT_BOX_AFFORDANCES,
  COUPLE_THREAD_PANELS,
  SHARED_THREAD_PANEL_IDS,
  affordancePanelId,
  affordanceReveal,
} from './chat-box-tools';
import {
  VENDOR_THREAD_IN_PAGE_ANCHORS,
  VENDOR_THREAD_PANELS,
  VENDOR_THREAD_TOOLS,
} from './vendor-thread-tools';

/**
 * ONE CHAT BOX — the property, on both sides.
 *
 * ── WHAT WAS MEASURED (production, 2026-09-18, 390px) ──────────────────────
 * The couple's thread stacked seven cards; the conversation was one of them
 * and measured 32px of visible height against 498px of content. The owner
 * approved a layout ("One Chat Box"): one frame · header · one-line safety
 * note · Chat / Decisions / Files · the conversation as the ONLY scroll region
 * with the quote rendered in it · jump pills over the scroller · a composer
 * row carrying attach · message · deal · call · send.
 *
 * ── HOW THIS GUARD IS BUILT ─────────────────────────────────────────────────
 * The decisions that CAN be executed are executed: the affordance registry is
 * resolved against the real tool list, so an icon that names a panel nothing
 * renders throws here before it ships. What must be read from source is read
 * comment-free and COUNTED, never merely matched: a guard that finds *a*
 * mount instead of *the* mount is the oldest bug in this repo's toolkit.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const COUPLE = 'app/dashboard/[eventId]/messages/[threadId]/page.tsx';
const VENDOR = 'app/vendor-dashboard/messages/[threadId]/page.tsx';
const BOX = 'app/_components/chat/chat-box.tsx';
const PANEL = 'app/_components/chat/thread-tool-panel.tsx';
const BUTTON = 'app/_components/chat/reveal-tool-button.tsx';
const SEND = 'app/_components/chat-send-form.tsx';
const NOTICE = 'app/_components/chat-privacy-notice.tsx';
const VIEWS = 'app/_components/chat-thread-views.tsx';
const STREAM = 'app/_components/chat-message-stream.tsx';

const PAGES = [
  [COUPLE, 'couple', '<ChatSafetyBanner inBox'],
  [VENDOR, 'supplier', '<ChatPrivacyNotice inBox'],
] as const;

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('the scan reads every file (an empty read is a green lie)', () => {
  for (const rel of [COUPLE, VENDOR, BOX, PANEL, BUTTON, SEND, NOTICE, VIEWS, STREAM]) {
    assert.ok(read(rel).length > 500, `${rel} read as too short — the scan is not reading it`);
  }
});

/* ── 1 · the registry, executed ─────────────────────────────────────────── */

test('every composer icon opens a panel the tool list knows', () => {
  const panelIds = new Set(VENDOR_THREAD_PANELS.map((p) => p.id));
  const anchorIds = new Set(VENDOR_THREAD_IN_PAGE_ANCHORS);
  for (const key of Object.keys(CHAT_BOX_AFFORDANCES) as (keyof typeof CHAT_BOX_AFFORDANCES)[]) {
    const reveal = affordanceReveal(key);
    assert.ok(reveal.length >= 1, `${key} reveals nothing`);
    for (const id of reveal) {
      assert.ok(panelIds.has(id) || anchorIds.has(id), `${key} → #${id} is neither a panel nor an anchor`);
    }
    assert.ok(panelIds.has(affordancePanelId(key)), `${key} does not end on a panel`);
  }
  // The call icon lands on the Voice button, and falls back to the panel.
  assert.deepEqual([...affordanceReveal('call')], ['thread-call-voice', 'thread-call']);
  assert.deepEqual([...affordanceReveal('deal')], ['deal-or-meeting']);
});

test("the couple's panels are the shared two, taken from the supplier's list — no second spelling", () => {
  assert.deepEqual(
    COUPLE_THREAD_PANELS.map((p) => p.id),
    [...SHARED_THREAD_PANEL_IDS],
  );
  for (const p of COUPLE_THREAD_PANELS) {
    assert.ok(VENDOR_THREAD_PANELS.includes(p), `${p.id} is a copy, not the registry's object`);
  }
  // Both are reachable from the supplier's rail as well (one mechanism, two doors).
  const reached = new Set(VENDOR_THREAD_TOOLS.flatMap((t) => (t.reveal ? [...t.reveal] : [])));
  for (const id of SHARED_THREAD_PANEL_IDS) assert.ok(reached.has(id), `no rail launcher reaches ${id}`);
  // And the two icons cover exactly the two shared panels.
  assert.deepEqual(
    new Set([affordancePanelId('deal'), affordancePanelId('call')]),
    new Set(SHARED_THREAD_PANEL_IDS),
  );
});

/* ── 2 · both pages: one frame, everything inside it ────────────────────── */

test('each page renders exactly one ChatBox, and the notice, composer and stream are inside it', () => {
  for (const [rel, name, noticeMount] of PAGES) {
    const s = read(rel);
    assert.equal(count(s, /<ChatBox\b/g), 1, `${name}: ChatBox mounted ${count(s, /<ChatBox\b/g)} times`);
    assert.equal(count(s, /<\/ChatBox>/g), 1, `${name}: ChatBox closed ${count(s, /<\/ChatBox>/g)} times`);
    const open = s.indexOf('<ChatBox');
    const close = s.indexOf('</ChatBox>');
    for (const [what, re] of [
      ['the notice', new RegExp(noticeMount.replace(/[<]/g, '<'), 'g')],
      ['the composer', /<ChatSendForm\b/g],
      ['the stream', /<ChatMessageStream\b/g],
      ['the ⋮ menu', /<ChatThreadMenu\b/g],
    ] as const) {
      const n = count(s, re);
      assert.equal(n, 1, `${name}: ${what} is mounted ${n} times (expected once)`);
      const at = s.search(re);
      assert.ok(at > open && at < close, `${name}: ${what} is outside the ChatBox`);
    }
  }
});

test('the stream is flush inside the frame — no card inside the card', () => {
  for (const [rel, name] of PAGES) {
    const s = read(rel);
    assert.equal(count(s, /<ChatMessageStream\s+flush\b/g), 1, `${name}: the stream lost \`flush\``);
  }
  const stream = read(STREAM);
  // One chrome string, applied to all three scrollers.
  assert.equal(count(stream, /\$\{scrollerChrome\}/g), 3, 'a scroller stopped using the shared chrome');
  assert.match(stream, /flush \? '[^']+' : '[^']*rounded-xl border[^']*'/);
});

test('the call launcher and the deal menu are tool panels, not cards of their own', () => {
  for (const [rel, name] of PAGES) {
    const s = read(rel);
    const a = s.indexOf('const toolNodes');
    const b = s.indexOf('\n  };', a);
    assert.ok(a > 0 && b > a, `${name}: no toolNodes object`);
    const nodes = s.slice(a, b);
    for (const [what, re] of [
      ['ThreadCallLauncher', /<ThreadCallLauncher\b/g],
      ['NegotiationComposerMenu', /<NegotiationComposerMenu\b/g],
    ] as const) {
      assert.equal(count(s, re), 1, `${name}: ${what} mounted ${count(s, re)} times`);
      assert.equal(count(nodes, re), 1, `${name}: ${what} is mounted outside toolNodes — a card again`);
    }
    assert.match(nodes, /<NegotiationComposerMenu\s+embedded\b/, `${name}: the deal menu is not embedded`);
    assert.equal(count(s, /buttonIdPrefix="thread-call"/g), 1, `${name}: the call buttons mint no ids`);
    for (const id of SHARED_THREAD_PANEL_IDS) {
      assert.ok(nodes.includes(`'${id}':`), `${name}: no body for panel ${id}`);
    }
    // The tray renders ONE panel template from a list, with ?compose=deal opening it server-side.
    assert.equal(count(s, /<ThreadToolPanel\b/g), 1, `${name}: ThreadToolPanel used ${count(s, /<ThreadToolPanel\b/g)} times`);
    assert.match(s, /open=\{t\.id === affordancePanelId\('deal'\) && composeMode === 'deal'\}/, `${name}: ?compose=deal does not open the panel`);
    assert.equal(count(s, /<ThreadToolHashReveal\s*\/>/g), 1, `${name}: nothing honours a #panel hash`);
  }
  assert.match(read(COUPLE), /COUPLE_THREAD_PANELS\.filter\(/, "the couple's tray is not drawn from the shared list");
  assert.equal(count(read(VENDOR), /VENDOR_THREAD_PANELS\.map\(/g), 1);
});

test('the composer row carries the deal and call icons, and nothing else new', () => {
  for (const [rel, name] of PAGES) {
    const s = read(rel);
    const a = s.indexOf('accessories={');
    assert.ok(a > 0, `${name}: the composer has no accessories`);
    const b = s.indexOf('</>', a);
    const row = s.slice(a, b);
    assert.equal(count(row, /<RevealToolButton affordance="deal"/g), 1, `${name}: no deal icon on the row`);
    assert.equal(count(row, /<RevealToolButton affordance="call"/g), 1, `${name}: no call icon on the row`);
    // Two icons on the row, and none anywhere else — the row is at its ceiling.
    assert.equal(count(s, /<RevealToolButton\b/g), 2, `${name}: ${count(s, /<RevealToolButton\b/g)} RevealToolButtons (expected 2)`);
  }
  const btn = read(BUTTON);
  assert.match(btn, /type="button"/, 'a reveal button that is not type=button would submit the send form');
  assert.doesNotMatch(btn, /<form\b/, 'a form inside the send form is a nested form');
  assert.match(btn, /h-11 w-11/, 'the tap target dropped below 44px');
  const send = read(SEND);
  assert.match(send, /\{accessories && !hasDraft \? accessories : null\}/, 'the icons no longer step aside for a draft');
  assert.ok(count(send, /setHasDraft\(/g) >= 2, 'hasDraft is never cleared after a send');
});

test('the header keeps the counterparty, one muted line with the service, and the way back', () => {
  for (const [rel, name] of PAGES) {
    const s = read(rel);
    assert.equal(count(s, /<ThreadInterestChips\b/g), 1, `${name}: interest chips mounted ${count(s, /<ThreadInterestChips\b/g)} times`);
    assert.match(s, /<ThreadInterestChips [^>]*\bcompact\b/, `${name}: the service is a bordered row again, not the muted line`);
    assert.match(s, /aria-label="Back to Messages"/, `${name}: no way back to the list on a phone`);
    // The muted line dot-separates whatever it carries, so a missing service
    // or date leaves no stray "·".
    assert.match(s, /\[&>\*\+\*\]:before:content-\['·'\]/, `${name}: the muted line lost its separators`);
  }
  assert.match(read(COUPLE), /formatLongDate\(eventDate\)/, "the couple's header shows a raw date or none");
  assert.match(read(VENDOR), /Planning for \{guestCountLine\(guestCounts\)\}/);
});

test('the notice is one line: the couple may dismiss it and it is remembered; the supplier may not', () => {
  const s = read(NOTICE);
  // Couple: dismiss persists (0019-adjacent consent notice — checked, kept).
  assert.match(s, /localStorage\.getItem\(SAFETY_DISMISS_KEY\)/);
  assert.match(s, /localStorage\.setItem\(SAFETY_DISMISS_KEY, '1'\)/);
  assert.equal(count(s, /aria-label="Dismiss safety tips"/g), 1, 'the couple lost the dismiss, or the supplier gained one');
  // All four points still ship, one tap away.
  assert.equal(count(s, /SAFETY_POINTS\.map\(/g), 1, 'the four safety points are no longer rendered');
  assert.equal(count(s, /^  '[^']+',$/gm), 4, 'the safety points list changed length');
  // Both collapse to a single truncated line with an expand toggle.
  assert.equal(count(s, /aria-expanded=\{(tips|more)\}/g), 2, 'a notice lost its expand toggle');
  assert.ok(count(s, /\btruncate\b/g) >= 2, 'a notice no longer truncates to one line');
  // The supplier's notice is locked non-dismissible (0019 § Gate, 2026-05-14).
  const privacy = s.slice(s.indexOf('export function ChatPrivacyNotice'), s.indexOf('export function ChatSafetyBanner'));
  assert.doesNotMatch(privacy, /Dismiss|localStorage/, 'the supplier privacy notice became dismissible');
  for (const [rel, name, mount] of PAGES) {
    assert.equal(count(read(rel), new RegExp(mount, 'g')), 1, `${name}: the notice is not the in-box line`);
  }
});

test('the frame and the panel: one scroll region, tools cost nothing closed', () => {
  const box = read(BOX);
  assert.match(box, /className="flex min-h-0 flex-1 flex-col px-2 pt-2 sm:px-3">\{children\}/, 'the conversation slot is no longer the flex-1 / min-h-0 child');
  assert.doesNotMatch(box, /overflow-hidden/, 'a frame that hides overflow clips its own composer on a short phone');
  const panel = read(PANEL);
  assert.match(panel, /\[&:not\(\[open\]\)\]:hidden/, 'a closed panel takes space again');
  assert.match(panel, /data-thread-tool/, 'the panel lost the attribute revealThreadTool closes others by');
  assert.match(panel, /max-h-\[\d+dvh\] overflow-y-auto/, 'an open tool can grow past the screen');
  assert.match(panel, /open=\{open \|\| undefined\}/, 'the server can no longer open a panel');
  // The first tab is "Chat" and the hint hides on a phone.
  const views = read(VIEWS);
  assert.match(views, /tab\('all', 'Chat', null, 0\)/);
  assert.match(views, /hidden text-\[0\.7rem\] text-ink\/50 sm:inline/);
});
