/**
 * tuck-keeps-the-rows.test.ts — 🫳 TUCK: THE BARS HIDE ON SCROLL, THE PINNED ROW AND THE THUMB ROW STAY (owner 18 Nov
 * 2026, verbatim: *"yes. thumb row and compressed row stays."* · *"but when bottom and top nav appears, the thumb row
 * and compressed pin rows adjust as well"*; specs `MOTION_STANDARD_2026-11-18.md` § 5 #37 + "Tuck's rules (decided)").
 *
 * Held here:
 *   1. the rules, on the pure reading (`tuckNext`): near the top everything shows · down tucks · up a little brings
 *      it back · the page's end brings it back · a page too short to scroll never tucks · a tuck never STARTS while a
 *      sheet, an Undo toast or a busy save is up;
 *   2. ONE mark moves everything — the hook writes `html[data-tuck]`, and the pill's one tap opens it;
 *   3. the bottom nav SHRINKS to a pill (it is not hidden away), and the pill is a real button with the lit tab's icon;
 *   4. the thumb row STAYS — it is moved, never hidden — and the shared rows wear the mark;
 *   5. the pinned row STAYS and rides with the bar, both ways, on the bar's two speeds, holding nothing after;
 *   6. away is Move on the Spring, back is Quick on Settle — for the top bar, the nav, the pill and the rows alike;
 *   7. only transform, translate and opacity move; reduced motion swaps at once.
 *
 * 🛡 SABOTAGE (seen RED once each, 2026-11-18, then restored): the rows' tucked rule given `opacity: 0;` (4) · the
 * `this.ride(` call removed from the collapsing top's layout (5) · `data-tuck-row=""` removed from the supplier's glass
 * row (4) · `tuckNext`'s page-end line deleted (1) · the tucked nav's `scaleX(` → `translateY(100%)` (3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { MOTION_TABLE, MOVE_MS, QUICK_MS } from '@/lib/motion-table';
import { TUCK_ATTR, TUCK_BLOCKERS, TUCK_MIN_SCROLL_PX, TUCK_OPEN_EVENT, tuckNext } from './use-hide-on-scroll';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const css = (rel: string) => readFileSync(join(WEB, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const GLOBALS = css('app/globals.css');
/** The tuck's own block of globals.css: from the pill's resting rule to the end of its reduced-motion rule. */
const TUCK = (() => {
  const from = GLOBALS.indexOf('[data-tuck-pill] {');
  const end = GLOBALS.indexOf('@media (prefers-reduced-motion: reduce)', from);
  assert.ok(from >= 0 && end > from, 'globals.css lost the tuck block');
  return GLOBALS.slice(from, GLOBALS.indexOf('\n}\n', end) + 3);
})();
const body = (src: string, selEnd: string) => {
  const at = src.indexOf(`${selEnd} {`);
  assert.ok(at >= 0, `no rule ending \`${selEnd}\``);
  return src.slice(src.indexOf('{', at) + 1, src.indexOf('}', at));
};
const ROWS = ':is([data-tuck-row], [data-guests-thumb], [data-budget-thumb])';
const TUCKED = "html[data-tuck]:not([data-keyboard='open'], [data-chrome-away])";

test('1 · the rules: top · down · up · the page’s end · a short page · never started while something is up', () => {
  const page = { max: 3000, blocked: false };
  assert.equal(tuckNext(false, { ...page, y: 40, lastY: 10 }), false, 'near the top (64 px) everything shows');
  assert.equal(tuckNext(true, { ...page, y: 40, lastY: 90 }), false, 'back at the top it all returns');
  assert.equal(tuckNext(false, { ...page, y: 400, lastY: 380 }), true, 'scrolling down tucks');
  assert.equal(tuckNext(true, { ...page, y: 392, lastY: 400 }), false, 'scrolling up a little brings both back');
  assert.equal(tuckNext(true, { ...page, y: 401, lastY: 400 }), true, 'a jitter inside the dead zone changes nothing');
  assert.equal(tuckNext(false, { ...page, y: 399, lastY: 400 }), false);
  assert.equal(tuckNext(true, { ...page, y: 2996, lastY: 2900 }), false, 'at the page’s end they come back');
  assert.equal(tuckNext(false, { max: TUCK_MIN_SCROLL_PX - 1, blocked: false, y: 100, lastY: 70 }), false, 'a page too short to scroll never tucks');
  assert.equal(tuckNext(false, { ...page, blocked: true, y: 400, lastY: 380 }), false, 'never started while a sheet, an Undo toast or a busy save is up');
  assert.equal(tuckNext(true, { ...page, blocked: true, y: 420, lastY: 400 }), true, 'already tucked when a toast arrived: it stays where it is');
  for (const s of ['[aria-modal="true"]', '[data-undo-toast]', '.sd-loader']) assert.ok(TUCK_BLOCKERS.includes(s), `${s} no longer holds the bars up`);
});

test('2 · one mark moves everything, and the pill’s one tap opens it', () => {
  const hook = code('app/_components/nav/use-hide-on-scroll.ts');
  assert.equal(TUCK_ATTR, 'data-tuck');
  assert.match(hook, /root\.setAttribute\(TUCK_ATTR, ''\);\s*return \(\) => root\.removeAttribute\(TUCK_ATTR\);/, 'the mark can be left on after the bars return');
  assert.match(hook, /window\.addEventListener\(TUCK_OPEN_EVENT, onOpen\)/);
  assert.match(hook, /const onOpen = \(\) => \{\s*lastY = window\.scrollY;\s*setHidden\(false\);\s*\};/, 'the pill’s tap does not open the bars at once');
  const nav = code('app/_components/nav/bottom-nav.tsx');
  assert.match(nav, new RegExp(`onClick=\\{\\(\\) => window\\.dispatchEvent\\(new Event\\('${TUCK_OPEN_EVENT}'\\)\\)\\}`), 'the pill does not ask the bars to open — it would take two taps');
});

test('3 · the bottom nav shrinks to a pill — it is not slid away — and the pill is a real button', () => {
  const tucked = body(TUCK, `${TUCKED} [data-bottom-dock] > nav[aria-label='Primary navigation']`);
  assert.match(tucked, /transform:\s*scaleX\(var\(--sn-tuck-k, 0\.18\)\);/, 'the bar no longer shrinks to its pill');
  assert.doesNotMatch(tucked, /translateY/, 'the bar slides away again (owner: it shrinks to a pill, was: hides)');
  const pill = body(TUCK, `${TUCKED} [data-tuck-pill]`);
  assert.match(pill, /opacity:\s*1;/);
  assert.match(pill, /visibility:\s*visible;/);
  assert.match(pill, /pointer-events:\s*auto;/);
  assert.match(pill, /transform:\s*none;/);
  const rest = body(TUCK, '[data-tuck-pill]');
  assert.match(rest, /visibility:\s*hidden;/, 'at rest the pill can take a tap or the focus');
  const nav = code('app/_components/nav/bottom-nav.tsx');
  assert.match(nav, /<button\s+type="button"\s+data-tuck-pill=""\s+aria-label="Show the menu bar"/);
  assert.match(nav, /<NavShell current=\{activeIndex >= 0 \? items\[activeIndex\]!\.icon : undefined\}>/, 'the pill does not wear the lit tab’s icon');
  assert.match(nav, /<TuckPill Icon=\{current\} \/>/);
  assert.match(nav, /root\.setProperty\('--sn-tuck-k', \(h \/ w\)\.toFixed\(4\)\)/, 'the bar does not know how far to shrink');
});

test('4 · the thumb row STAYS: moved onto the pill’s row, never hidden — and the shared rows wear the mark', () => {
  const rows = body(TUCK, `${TUCKED}:has([data-bottom-dock]) ${ROWS}`);
  assert.match(rows, /translate:\s*0 var\(--sn-bottomnav-h, 64px\);/, 'the thumb row does not come down beside the pill');
  assert.match(rows, /padding-left:\s*calc\(var\(--sn-safe-l\) \+ 14px \+ var\(--sn-bottomnav-h, 64px\) \+ 8px\);/, 'the thumb row sits under the pill instead of beside it');
  assert.doesNotMatch(rows, /opacity|visibility|display|pointer-events/, 'the tuck hides the thumb row — the owner ruled it stays');
  // Nothing anywhere under the mark hides a row or a pinned top.
  for (const m of TUCK.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const [, sel, decls] = m as unknown as [string, string, string];
    if (!/data-tuck-row|guests-thumb|budget-thumb|\.sn-ct\b|data-collapsing-top/.test(sel)) continue;
    assert.doesNotMatch(decls, /opacity:\s*0|visibility:\s*hidden|display:\s*none/, `\`${sel.trim()}\` hides a row that must stay`);
  }
  const thumb = code('app/vendor-dashboard/_components/supplier-thumb-row.tsx');
  assert.equal((thumb.match(/data-tuck-row=""/g) ?? []).length, 2, 'the supplier’s floating row (its glass form and its one-row form) must both ride the tuck');
  assert.match(code('components/thumb-dock.tsx'), /data-tuck-row=\{noBar \? undefined : ''\}/, 'the shared ThumbDock does not ride the tuck');
});

test('5 · the pinned row STAYS and rides with the bar, both ways, holding nothing after', () => {
  const top = code('app/_components/collapsing-top/collapsing-top.tsx');
  assert.match(top, /if \(before\) this\.entries\.forEach\(\(e, i\) => this\.ride\(e\.el, before\[i\]!, away\)\);/, 'the pinned row jumps when the bar tucks instead of riding with it');
  const ride = top.slice(top.indexOf('private ride('), top.indexOf('private start()'));
  assert.match(ride, /duration: away \? MOTION_TABLE\.tuckAwayMs : MOTION_TABLE\.tuckBackMs,/, 'the pinned row does not move at the bar’s two speeds');
  assert.match(ride, /easing: away \? springEase\(\) : EASE_SETTLE,/);
  assert.match(ride, /\[\{ transform: `translateY\(\$\{[^}]+\}px\)` \}, \{ transform: 'none' \}\]/, 'the ride is not a transform');
  assert.doesNotMatch(ride, /fill:/, 'a held transform on the pinned top traps every fixed child under it');
  assert.match(ride, /if \(this\.reduce\?\.matches/, 'reduced motion: it is simply there');
  assert.equal(MOTION_TABLE.tuckAwayMs, MOVE_MS);
  assert.equal(MOTION_TABLE.tuckBackMs, QUICK_MS);
  // Its drawing never hides it for a tuck either.
  assert.doesNotMatch(css('app/_components/collapsing-top/collapsing-top.css'), /data-tuck/);
});

test('6 · away is Move on the Spring, back is Quick on Settle — the bar, the nav, the pill and the rows alike', () => {
  const AWAY = /var\(--sn-m-move\) var\(--sn-m-spring\)/;
  const BACK = /var\(--sn-m-quick\) var\(--sn-m-settle\)/;
  assert.match(body(TUCK, `${TUCKED} [data-bottom-dock] > nav[aria-label='Primary navigation']`), new RegExp(`transition:\\s*transform ${AWAY.source}`));
  assert.match(body(TUCK, `${TUCKED} [data-tuck-pill]`), new RegExp(`transition:\\s*transform ${AWAY.source}`));
  assert.match(body(TUCK, `${TUCKED}:has([data-bottom-dock]) ${ROWS}`), new RegExp(`translate ${AWAY.source}`));
  assert.match(body(TUCK, "[data-bottom-dock] > nav[aria-label='Primary navigation']"), new RegExp(`transition:\\s*transform ${BACK.source}`));
  assert.match(body(TUCK, '[data-tuck-pill]'), new RegExp(`transition:\\s*transform ${BACK.source}`));
  assert.match(body(TUCK, `:root ${ROWS}`), new RegExp(`translate ${BACK.source}`));
  const fd = css('app/_components/frontdoor/front-door.css');
  assert.match(fd, /\.fd\[data-chrome='app'\] \.fd-topwrap\[data-hidden='true'\] \{\s*transform: translateY\(-100%\);\s*transition: transform var\(--sn-m-move\) var\(--sn-m-spring\);\s*\}/, 'the top bar tucks at a speed of its own');
  assert.match(fd, /transition: transform var\(--sn-m-quick\) var\(--sn-m-settle\);/, 'the top bar comes back at a speed of its own');
});

test('7 · only transform, translate and opacity move; reduced motion swaps at once', () => {
  for (const m of TUCK.matchAll(/transition:\s*([^;]+);/g)) {
    if (m[1]!.trim() === 'none') continue;
    for (const part of m[1]!.split(/,(?![^()]*\))/)) {
      const prop = part.trim().split(/\s+/)[0];
      assert.ok(['transform', 'translate', 'opacity', 'visibility'].includes(prop!), `the tuck animates \`${prop}\``);
    }
  }
  const raw = (TUCK.match(/(?<![\w.(-])\d+(?:\.\d+)?m?s\b/g) ?? []).filter((t) => t !== '0s');
  assert.deepEqual(raw, [], 'a raw duration in the tuck — read a --sn-m-* token');
  const reduced = TUCK.slice(TUCK.indexOf('@media (prefers-reduced-motion: reduce)'));
  for (const s of ['[data-tuck-pill]', "[data-bottom-dock] > nav[aria-label='Primary navigation']", `:root ${ROWS}`]) assert.ok(reduced.includes(s), `${s} still travels under reduced motion`);
  assert.match(reduced, /transition:\s*none;/);
});
