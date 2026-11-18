/**
 * the-screens-move-by-the-standard.test.ts — ↔ SLIDE AND → PUSH, AND THE PAGE'S ENTER (specs
 * `MOTION_STANDARD_2026-11-18.md` § 4 #4 Enter · § 5 #29 Slide · #30 Push; owner 18 Nov 2026 *"build it now. align it to
 * all our designs and upcoming designs"*). All three live on the shipped shared parts — the four shell templates'
 * `.sn-page-enter`, the one `NavSlideController`, the `sn-page` view-transition rules — so every page inherits them.
 *
 * Held here:
 *   1. Slide (a bottom-bar tab): Move on Settle; the old page travels 30 % and dims, the new one comes the full width;
 *   2. Enter (a page arriving): Move on Settle, fill `backwards` — NEVER `both` (a held transform unpins every fixed
 *      child, lib/an-identity-transform-unpins-every-fixed-child.test.ts);
 *   3. Push: deeper arrives from the right, Back from the left — the reverse; a first load, a tab and a sideways link
 *      keep Enter; the two `animation: none` rules (a tab's own slide, an open chat thread) still win;
 *   4. which way: `pushDir` — and a dashboard's home is not "above" its sections;
 *   5. the listener only NOTES a push — it never stops a link — and stands down under reduced motion;
 *   6. no `var()` sits inside a keyframe, and only transform and opacity move.
 *
 * 🛡 SABOTAGE (seen RED once each, 2026-11-18, then restored): `.sn-page-enter`'s `backwards` → `both` (2) ·
 * `sn-vt-page-out-left`'s `-30%` → `-100%` (1) · `sn-push-back`'s `calc(-1 * …)` → the forward travel (3) · the
 * `PUSH_HOME` test dropped from `pushDir` (4) · an `e.preventDefault()` added to the push listener (5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { pushDir } from '@/lib/nav-slide';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CSS = readFileSync(join(WEB, 'app/globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const frames = (name: string) => {
  const at = CSS.indexOf(`@keyframes ${name} {`);
  assert.ok(at >= 0, `globals.css has no @keyframes ${name}`);
  let depth = 0;
  for (let i = CSS.indexOf('{', at); i < CSS.length; i++) {
    if (CSS[i] === '{') depth++;
    else if (CSS[i] === '}' && --depth === 0) return CSS.slice(at, i + 1).replace(/\s+/g, ' ');
  }
  return '';
};

test('1 · Slide: Move on Settle; the old page goes 30 % and dims, the new one comes the full width', () => {
  const timing = /::view-transition-old\(sn-page\),\s*::view-transition-new\(sn-page\)\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
  assert.match(timing, /animation-duration:\s*var\(--sn-m-move\);/);
  assert.match(timing, /animation-timing-function:\s*var\(--sn-m-settle\);/);
  assert.match(frames('sn-vt-page-out-left'), /to \{ transform: translateX\(-30%\); opacity: 0\.4; \}/);
  assert.match(frames('sn-vt-page-out-right'), /to \{ transform: translateX\(30%\); opacity: 0\.4; \}/);
  assert.match(frames('sn-vt-in-right'), /from \{ transform: translateX\(100%\); \}/);
  assert.match(frames('sn-vt-in-left'), /from \{ transform: translateX\(-100%\); \}/);
  for (const [dir, out, into] of [['fwd', 'sn-vt-page-out-left', 'sn-vt-in-right'], ['back', 'sn-vt-page-out-right', 'sn-vt-in-left']] as const) {
    assert.match(CSS, new RegExp(`html\\[data-sn-nav-dir='${dir}'\\]::view-transition-old\\(sn-page\\) \\{\\s*animation-name: ${out};`));
    assert.match(CSS, new RegExp(`html\\[data-sn-nav-dir='${dir}'\\]::view-transition-new\\(sn-page\\) \\{\\s*animation-name: ${into};`));
  }
});

test('2 · Enter: Move on Settle, fill backwards — never both — on all four shells', () => {
  const enter = /\.sn-page-enter \{([^}]*)\}/.exec(CSS)?.[1] ?? '';
  assert.match(enter, /animation:\s*sn-rise-soft var\(--sn-m-move\) backwards var\(--sn-m-settle\);/);
  assert.doesNotMatch(enter, /\bboth\b|\bforwards\b/, 'a held transform on the page wrapper unpins every fixed child');
  for (const t of ['app/admin/template.tsx', 'app/dashboard/[eventId]/template.tsx', 'app/dashboard/(account)/template.tsx', 'app/vendor-dashboard/template.tsx']) {
    assert.match(code(t), /<div className="sn-page-enter"/, `${t} no longer wears the one page entrance`);
  }
});

test('3 · Push: deeper from the right, Back from the left; the tab slide and an open chat thread still win', () => {
  assert.match(frames('sn-push-fwd'), /from \{ opacity: 0; transform: translateX\(clamp\(24px, 30%, 96px\)\); \}/);
  assert.match(frames('sn-push-back'), /from \{ opacity: 0; transform: translateX\(calc\(-1 \* clamp\(24px, 30%, 96px\)\)\); \}/, 'Back is not the reverse of forward');
  // Only the NAME changes — Move, Settle and `backwards` stay the template's own.
  const fwd = CSS.indexOf(":where(html[data-sn-push='fwd']) .sn-page-enter { animation-name: sn-push-fwd; }");
  const back = CSS.indexOf(":where(html[data-sn-push='back']) .sn-page-enter { animation-name: sn-push-back; }");
  assert.ok(fwd > 0 && back > 0, 'the push rules are gone, or carry a timing of their own');
  // `:where()` holds them at the class's own weight, and they sit BEFORE the two `animation: none` rules.
  const base = CSS.indexOf('.sn-page-enter { animation: sn-rise-soft');
  const tab = CSS.indexOf('html:active-view-transition .sn-page-enter { animation: none; }');
  const chat = CSS.indexOf('.sn-page-enter:has([data-chat-takeover]) { animation: none; }');
  assert.ok(base < fwd && back < tab && tab < chat, 'a push would now play inside a tab’s slide, or under an open chat thread');
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{\s*\.sn-page-enter, \.sn-live-dot \{ animation: none !important; \}/);
});

test('4 · which way: deeper is forward, shallower is back, and a home is not above its sections', () => {
  assert.equal(pushDir('/dashboard/abc/guests', '/dashboard/abc/guests/import'), 'fwd');
  assert.equal(pushDir('/dashboard/abc/guests/import', '/dashboard/abc/guests'), 'back');
  assert.equal(pushDir('/vendor-dashboard/customers', '/vendor-dashboard/customers/S89V-1'), 'fwd');
  assert.equal(pushDir('/admin/payments/123/', '/admin/payments'), 'back');
  assert.equal(pushDir('/dashboard/abc/guests', '/dashboard/abc/budget'), null, 'a sideways link is not a push');
  assert.equal(pushDir('/dashboard/abc/guests', '/dashboard/abc/guests'), null);
  assert.equal(pushDir('/dashboard/abc', '/dashboard/abc/guests'), null, 'Home → a section is a tab’s move');
  assert.equal(pushDir('/vendor-dashboard/customers', '/vendor-dashboard'), null);
  assert.equal(pushDir('/admin', '/admin/payments'), null);
  assert.equal(pushDir('/dashboard', '/dashboard/library'), null);
  assert.equal(pushDir('/dashboard/abc/guestsX', '/dashboard/abc/guests'), null, 'a shared prefix is not a parent');
});

test('5 · the listener only notes a push — it never stops a link — and stands down under reduced motion', () => {
  const ctl = code('app/_components/nav/nav-slide-controller.tsx');
  const from = ctl.indexOf('const lastPath = useRef');
  const push = ctl.slice(from, ctl.indexOf('}, [reduced]);', from));
  assert.ok(from > 0 && push.length > 200, 'the push listener is gone');
  assert.match(push, /if \(reduced\) return;/);
  assert.match(push, /mark\(pushDir\(location\.pathname, url\.pathname\)\)/);
  assert.match(push, /window\.addEventListener\('popstate', onPop\)/, 'the phone’s Back no longer arrives from the left');
  assert.match(push, /if \(anchor\.closest\(NAV_SEL\)\) return mark\(null\);/, 'a tab press would be pushed as well as slid');
  assert.doesNotMatch(push, /preventDefault|router\.push|startViewTransition/, 'the push listener takes over a link — it may only note it');
  assert.match(push, /window\.setTimeout\(\(\) => delete root\.dataset\.snPush, MOVE_MS \+ PUSH_SETTLE_MS\)/, 'the mark outlives the page it was for');
});

test('6 · no var() inside a keyframe; only transform and opacity move', () => {
  for (const name of ['sn-vt-page-out-left', 'sn-vt-page-out-right', 'sn-push-fwd', 'sn-push-back', 'sn-picture-old', 'sn-picture-card', 'sn-side-peek-in', 'sn-side-peek-out', 'sn-peek-out']) {
    const f = frames(name);
    assert.doesNotMatch(f, /var\(|animation-timing-function/, `${name}: a var() in a keyframe's timing runs linear in Chrome`);
    for (const m of f.matchAll(/([a-z-]+)\s*:/g)) assert.ok(['transform', 'opacity'].includes(m[1]!), `${name} animates ${m[1]}`);
  }
});
