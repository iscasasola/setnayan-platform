/**
 * the-update-notice-is-on-top.test.ts — "Setnayan was updated" is drawn ONCE, and never under a sheet (walk RW-7853-a,
 * 16 Nov 2026, on PR #7853 "the site updates by itself when nothing is typed").
 *
 * The notice speaks only to a page holding typing — most often the full-screen chat thread, which on a phone fixes
 * itself over the page at z 45. The notice stood in the page flow, so it was drawn under the thread and the person it
 * was for never saw it; and its wrapper was a second `role="status"` around `NoticeLine`'s own, so one notice was two
 * live regions. Held here:
 *
 *   1. ONE MOUNT — one `<StaleTabNotice />` in every layout of the app; one notice element in the component; no live
 *      region of its own (NoticeLine is the one); the flow copy and the lifted copy are exclusive (an early return).
 *   2. ON TOP — while a layer covers the page it rides the app's top notification layer (`PEEK_TOAST_PLACE`, portalled
 *      to <body>), whose z is above the rise (pop), the Sheet (modal), the side panel and the chat takeover.
 *   3. THE RULE — `aLayerCoversThePage` executed; and the selector it reads matches the marks the real layers carry.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-16): a second `<StaleTabNotice />` in app/layout.tsx (red: 1a);
 * `role="status"` back on the wrapper (red: 1c); the `if (covered)` branch removed (red: 1d); PEEK_TOAST_PLACE's
 * `z-[100]` → `z-[40]` (red: 2a); `l.modal ||` dropped from the rule (red: 3a).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { LAYER_OVER_THE_PAGE, UNDER_THE_HEAD_GAP, aLayerCoversThePage, whereTheNoticeLifts, type DrawnLayer } from '@/lib/build-version';
import { PEEK_TOAST_LAYER } from '@/app/_components/toast/peek-toast';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));
const NOTICE = code('app/_components/stale-tab-notice.tsx');
const LIFT = code('app/_components/stale-tab-notice-lift.tsx');
const CSS = read('app/globals.css');

const Z: Record<string, number> = {};
for (const m of CSS.matchAll(/--sn-z-([a-z]+):\s*(-?\d+);/g)) if (!(m[1]! in Z)) Z[m[1]!] = Number(m[2]);

function layouts(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) layouts(p, out);
    else if (/^layout(\.lab)?\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

// ── 1 · ONE MOUNT ────────────────────────────────────────────────────────────────────────────────────────────────

test('1a · the notice is mounted once, in the root layout, and in no other layout', () => {
  const found = layouts(join(WEB, 'app')).flatMap((p) =>
    (stripComments(readFileSync(p, 'utf8')).match(/<StaleTabNotice\b/g) ?? []).map(() => p.slice(WEB.length + 1)),
  );
  assert.deepEqual(found, ['app/layout.tsx'], `expected one mount in app/layout.tsx, found: ${found.join(', ') || 'none'}`);
});

test('1b · the component draws ONE notice element', () => {
  assert.equal((NOTICE.match(/<LazyInlineNotice\b/g) ?? []).length, 1, 'the notice element is written more than once');
  assert.doesNotMatch(LIFT, /<(?:Lazy)?InlineNotice\b|<NoticeLine\b/, 'the lift draws a notice of its own — it must only carry the one it is handed');
});

test('1c · one live region: NoticeLine is the role="status", the wrappers are not', () => {
  assert.match(code('app/_components/notices/notices.tsx'), /role="status"\s+data-notice=\{entry\.kind\}/, 'NoticeLine is no longer the live region');
  for (const [name, src] of [['stale-tab-notice.tsx', NOTICE], ['stale-tab-notice-lift.tsx', LIFT]] as const) {
    assert.doesNotMatch(src, /role="status"|aria-live=/, `${name} wraps the notice in a second live region — it is announced twice`);
  }
});

test('1d · flow OR top layer, never both: the lifted branch returns before the flow one', () => {
  const lifted = NOTICE.search(/if \(lift\) \{[\s\S]*?return \([\s\S]*?<StaleTabNoticeLift host=\{lift\.host\} top=\{lift\.top\}>\s*\{notice\}\s*<\/StaleTabNoticeLift>/);
  const flow = NOTICE.search(/return \(\s*<div data-app-chrome="" data-stale-tab-notice=""[^>]*>\s*\{notice\}/);
  assert.ok(lifted > 0, 'no lifted branch — the notice stays in the flow under a sheet');
  assert.ok(flow > lifted, 'the flow copy is not the fallthrough after the lifted return');
  assert.equal((NOTICE.match(/\{notice\}/g) ?? []).length, 2, 'the notice is placed somewhere else as well');
});

// ── 2 · ON TOP ───────────────────────────────────────────────────────────────────────────────────────────────────

test('2a · the top notification layer is above the rise, the Sheet, the side panel and the chat takeover', () => {
  const z = Number(/(?:^|\s)z-\[(\d+)\](?:\s|$)/.exec(PEEK_TOAST_LAYER)?.[1]);
  assert.ok(Number.isFinite(z), 'PEEK_TOAST_LAYER lost its z');
  assert.ok(/(?:^|\s)fixed(?:\s|$)/.test(PEEK_TOAST_LAYER), 'PEEK_TOAST_LAYER is no longer fixed to the screen');
  // 18 Nov 2026 (motion standard): the TOAST rises from the bottom of this layer; the update notice stays at its top.
  assert.doesNotMatch(PEEK_TOAST_LAYER, /(?:^|\s)(?:top-|bottom-|sn-m-toast-place)/, 'the shared layer names an edge — the notice would be drawn at the toast’s place');

  const takeover = /\n\s*\[data-chat-takeover\]\s*\{[^}]*?z-index:\s*(\d+)/.exec(CSS);
  assert.ok(takeover, 'the full-screen chat takeover rule was not found in globals.css');
  assert.match(code('app/_components/rise/rise-screen.tsx'), /fixed inset-0 z-sn-pop\b/, 'the RiseScreen moved off the pop layer — re-check this order');
  assert.match(code('app/_components/sheet.tsx'), /fixed inset-0 z-50\b/, 'the Sheet moved off z-50 — re-check this order');

  const under: Record<string, number> = {
    'chat takeover': Number(takeover![1]),
    'rise (pop)': Z.pop!,
    'sheet (modal)': Z.modal!,
    'side panel': Z.panel!,
    'scrim': Z.scrim!,
  };
  for (const [name, below] of Object.entries(under)) assert.ok(z > below, `the notice's layer (${z}) is not above the ${name} (${below})`);
});

test('2b · lifted, it is portalled to <body> on that layer — not a layer of its own', () => {
  assert.match(LIFT, /import \{ PEEK_TOAST_LAYER \} from '\.\/toast\/peek-toast';/);
  assert.match(LIFT, /createPortal\(\s*<div data-app-chrome="" data-stale-tab-lift="" className=\{`top-\[calc\(12px\+env\(safe-area-inset-top\)\)\] \$\{PEEK_TOAST_LAYER\}`\} style=\{top === null \? undefined : \{ top \}\}>/);
  // <body>, or — only over the guest send-run, which stands above the toast layer — inside that screen (ruling 10).
  assert.match(LIFT, /host \?\? document\.body,?\s*\)/, 'the lift is not drawn on <body> — a transformed page would trap it');
  assert.doesNotMatch(LIFT, /\bz-\[|\bz-\d|zIndex|z-index/, 'the lift sets a z of its own — use the top layer');
  assert.match(LIFT, /pointer-events-auto/, 'the top layer takes no tap; Reload and Hide must');
  // Lazily — the root layout's client tree is the shared chunk.
  assert.match(NOTICE, /const StaleTabNoticeLift = lazy\(\(\) => import\('\.\/stale-tab-notice-lift'\)\);/);
  assert.doesNotMatch(NOTICE, /from '\.\/stale-tab-notice-lift'|from '\.\/toast\/peek-toast'/, 'a static import puts the lift in the shared chunk');
});

test('2c · the cover is measured with the shared rule, and only while the notice is up', () => {
  assert.match(NOTICE, /document\.querySelectorAll\(LAYER_OVER_THE_PAGE\)/);
  assert.match(NOTICE, /const place = whereTheNoticeLifts\(layers\);/);
  assert.match(NOTICE, /const showing = stale && Boolean\(servingVersion\);/);
  assert.match(NOTICE, /if \(!showing\) \{\s*setLift\(null\);\s*return;\s*\}/, 'the observer runs on a tab with nothing to say');
  assert.match(NOTICE, /watch\.disconnect\(\)/);
});

// ── 3 · THE RULE ─────────────────────────────────────────────────────────────────────────────────────────────────

const drawn = (over: Partial<DrawnLayer>): DrawnLayer => ({
  modal: false, position: 'static', display: 'flex', visibility: 'visible', width: 390, height: 844, ...over,
});

test('3a · what covers the page', () => {
  assert.equal(aLayerCoversThePage([]), false, 'a plain page');
  assert.equal(aLayerCoversThePage([drawn({ modal: true })]), true, 'an open Sheet / RiseScreen (its dialog need not be the fixed box)');
  assert.equal(aLayerCoversThePage([drawn({ position: 'fixed' })]), true, 'the phone’s full-screen thread');
  assert.equal(aLayerCoversThePage([drawn({ position: 'static' })]), false, 'the thread as a column from 701 px — the page is not covered');
  assert.equal(aLayerCoversThePage([drawn({ modal: true, display: 'none' })]), false, 'a closed modal kept in the tree');
  assert.equal(aLayerCoversThePage([drawn({ modal: true, visibility: 'hidden' })]), false);
  assert.equal(aLayerCoversThePage([drawn({ modal: true, width: 0, height: 0 })]), false, 'an empty box');
  assert.equal(aLayerCoversThePage([drawn({}), drawn({ position: 'fixed' })]), true, 'any one layer is enough');
});

test('3b · the selector matches the marks the real layers carry', () => {
  assert.equal(LAYER_OVER_THE_PAGE, '[aria-modal="true"], [data-chat-takeover], [data-send-run]');
  assert.match(NOTICE, /sendRun: el\.matches\(SEND_RUN_LAYER\)/, 'the send-run test drifted from the selector');
  assert.match(NOTICE, /headBottom: el\.querySelector\(THREAD_HEAD\)\?\.getBoundingClientRect\(\)\.bottom \?\? null/, 'the thread head is not measured');
  assert.match(code('app/dashboard/[eventId]/guests/send/_components/send-run.tsx'), /fixed inset-0 z-\[110\][^"]*"[\s\S]{0,80}data-send-run=""/, 'the send-run screen lost its mark or its z — re-check ruling 10');
  assert.match(code('app/_components/chat/chat-box.tsx'), /border-b border-ink\/10 py-1 pl-1 pr-2 sm:gap-2\.5" data-chat-thread-head=""/, 'the thread head band lost its mark — the notice would cover ‹ back and the name');
  assert.match(NOTICE, /modal: el\.matches\(MODAL_LAYER\)/, 'the modal test drifted from the selector');
  assert.match(code('app/_components/rise/rise-screen.tsx'), /aria-modal="true"/, 'the RiseScreen is no longer aria-modal');
  assert.match(code('app/_components/sheet.tsx'), /aria-modal="true"/, 'the Sheet is no longer aria-modal');
  assert.match(code('app/_components/chat/chat-box.tsx'), /data-chat-takeover=""/, 'the thread lost its takeover mark');
  assert.match(code('app/_components/chat/chat-blocker.tsx'), /aria-modal="true"/, 'the chat blocker is no longer aria-modal');
});

test('3c · rulings 8–10 (17 Nov): where the lifted notice stands', () => {
  const thread = (headBottom: number | null) => drawn({ position: 'fixed', headBottom });
  assert.equal(whereTheNoticeLifts([]), null, 'a plain page — the notice stays in the flow');
  assert.equal(whereTheNoticeLifts([drawn({ position: 'static', headBottom: 60 })]), null, 'the thread as a column — not covered');
  // 8 · over a Sheet / RiseScreen: the peek toast's own place.
  assert.deepEqual(whereTheNoticeLifts([drawn({ modal: true })]), { host: 'body', top: null });
  // 9 · over the phone's thread: BELOW its head, never over ‹ back / the name.
  assert.deepEqual(whereTheNoticeLifts([thread(60)]), { host: 'body', top: 60 + UNDER_THE_HEAD_GAP });
  assert.deepEqual(whereTheNoticeLifts([thread(null)]), { host: 'body', top: null }, 'a takeover with no head band (a chat list)');
  assert.deepEqual(whereTheNoticeLifts([thread(null), thread(112)]), { host: 'body', top: 112 + UNDER_THE_HEAD_GAP }, 'a thread inside the list takeover');
  // A sheet opened over the thread covers its head too — the notice goes back to the top.
  assert.deepEqual(whereTheNoticeLifts([thread(60), drawn({ modal: true })]), { host: 'body', top: null });
  // 10 · the guest send-run (z 110, above the toast layer, not aria-modal): drawn inside it.
  assert.deepEqual(whereTheNoticeLifts([drawn({ position: 'fixed', sendRun: true })]), { host: 'send-run', top: null });
  assert.equal(whereTheNoticeLifts([drawn({ position: 'fixed', sendRun: true, display: 'none' })]), null, 'a hidden send-run');
});
