/**
 * the-full-screen-map-is-the-standard.test.ts — 🗺 ONE MOTION PER KIND OF SCREEN, ON THE ONE OPENER (owner 18 Nov 2026
 * *"i like BCDE"* → *"yes mapping ok"* · *"keep the peek, unfold for smaller rows"*; specs
 * `MOTION_STANDARD_2026-11-18.md` § 5 "Full-screen map (decided)" + § 0, the 13 Nov details every kind keeps).
 *
 *   fill in / edit → Stack · a whole tool → Zoom through · anything with a photo → Picture leads ·
 *   a person's card → Side peek · a small row's detail → Unfold (Phase 2, in place — not a full-screen layer)
 *
 * Held here:
 *   1. the map itself is the ruling, word for word;
 *   2. each kind plays ITS named motion, at the standard's speeds — and only transform and opacity move;
 *   3. reduced motion is the 120 ms fade for every kind; no press behind it → it simply appears;
 *   4. they are named options of the ONE opener (`RiseScreen kind=…`, passed on open AND close; `RiseRoute` hands it
 *      through) — never a second opener;
 *   5. Side peek is the inspector sheet: the whole panel from the right on the Spring, the strip of list still a
 *      button, the close mirrored at 80 %;
 *   6. Picture leads card → page is the ONE listener's opt-in View Transition with one shared name;
 *   7. the screens classified so far wear their kind.
 *
 * 🛡 SABOTAGE (seen RED once each, 2026-11-18, then restored): `tool: 'zoom'` → `'stack'` in the map (1) · the Stack's
 * frames `translateY(100%)` → `scale(.92)` (2) · `kindRef.current` dropped from the CLOSE's `riseScreenMotion(` (4) ·
 * `sn-side-peek-in`'s `translateX(100%)` → `translateX(34px)` (5) · `kind="stack"` removed from the offer maker (7).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { EASE_SETTLE, EASE_SPRING_FALLBACK, EASE_SPRING_LINEAR, MOTION_TABLE, MOVE_MS, RISE_MS_STANDARD } from '@/lib/motion-table';
import { FULL_SCREEN_MAP, RISE_KINDS, picturePlan, riseScreenMotion, type RiseKind } from '@/lib/rise-screen';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CSS = readFileSync(join(WEB, 'app/globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** Every declaration of the rules whose selector is exactly `sel` (at the start of a line). */
const rule = (sel: string) => {
  const bodies = CSS.split('\n' + sel + ' {').slice(1).map((rest) => rest.slice(0, rest.indexOf('}')));
  assert.ok(bodies.length > 0, `globals.css has no rule \`${sel}\``);
  return bodies.join('\n');
};

const FROM = { top: 300, left: 16, width: 358, height: 64 };
const VP = { width: 390, height: 844 };
const motion = (kind: RiseKind, reduced = false) => riseScreenMotion(FROM, VP, reduced, 14, kind)!;

test('1 · the map is the ruling: one motion per kind of screen', () => {
  assert.deepEqual(FULL_SCREEN_MAP, { edit: 'stack', tool: 'zoom', photo: 'picture', person: 'peek', row: 'unfold' });
  assert.deepEqual([...RISE_KINDS], ['grow', 'stack', 'zoom', 'picture'], 'the ONE opener plays these itself; peek is the inspector, unfold is the row');
});

test('2 · each kind plays its named motion, at the standard’s speeds', () => {
  const close = Math.round(MOVE_MS * MOTION_TABLE.growCloseFactor);
  assert.equal(close, 256, 'the close is the open mirrored at 80 %');

  const stack = motion('stack');
  assert.deepEqual(stack.frames, [{ transform: 'translateY(100%)' }, { transform: 'none' }], 'Stack slides up from the foot');
  assert.equal(stack.timing.duration, MOVE_MS);
  assert.ok([EASE_SPRING_LINEAR, EASE_SPRING_FALLBACK].includes(String(stack.timing.easing)), 'Stack opens on the Spring (movement springs)');
  assert.deepEqual(stack.closeTiming, { duration: close, easing: EASE_SETTLE }, 'Stack closes on Settle, at 80 %');

  const zoom = motion('zoom');
  assert.deepEqual(zoom.frames, [{ transform: 'scale(0.92)', opacity: 0 }, { transform: 'none', opacity: 1 }], 'Zoom through grows from 92 %, fading in');
  assert.deepEqual(zoom.timing, { duration: MOVE_MS, easing: EASE_SETTLE });
  assert.deepEqual(zoom.closeTiming, { duration: close, easing: EASE_SETTLE });

  const picture = motion('picture');
  assert.deepEqual(picture.frames, [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 'the card rises under the photo');
  assert.deepEqual(picture.timing, { duration: MOVE_MS, delay: 80, easing: EASE_SETTLE, fill: 'backwards' }, 'the card: Move, 80 ms after the photo; nothing held');
  const photo = picturePlan({ top: 300, left: 16, width: 56, height: 44 }, { top: 76, left: 16, width: 358, height: 268 });
  assert.equal(photo.open.duration, RISE_MS_STANDARD, 'the photo flies in Rise (700 ms)');
  assert.equal(photo.open.easing, EASE_SETTLE);
  assert.equal(photo.close.duration, Math.round(RISE_MS_STANDARD * MOTION_TABLE.growCloseFactor));
  assert.match(String((photo.frames[0] as { transform: string }).transform), /^translate\(0px, 224px\) scale\(0\.156, 0\.164\)$/, 'the photo starts exactly over the tapped photo');
  assert.deepEqual(photo.frames[1], { transform: 'none' });

  assert.ok('clipPath' in motion('grow').frames[0]!, 'an unclassified screen keeps the 13 Nov grow out of the pressed thing');

  // Transform and opacity only — the three new kinds animate nothing else.
  for (const kind of ['stack', 'zoom', 'picture'] as const) {
    for (const f of motion(kind).frames) for (const k of Object.keys(f)) assert.ok(k === 'transform' || k === 'opacity', `${kind} animates ${k}`);
  }
});

test('3 · reduced motion is the 120 ms fade for every kind; no press behind it simply appears', () => {
  for (const kind of RISE_KINDS) {
    const m = motion(kind, true);
    assert.deepEqual(m.frames, [{ opacity: 0 }, { opacity: 1 }], `${kind} travels under reduced motion`);
    assert.equal(m.timing.duration, MOTION_TABLE.reducedFadeMs);
    assert.equal(riseScreenMotion(null, VP, false, 14, kind), null, `${kind} animates with no press behind it`);
  }
});

test('4 · they are options of the ONE opener — open and close — never a second opener', () => {
  const screen = code('app/_components/rise/rise-screen.tsx');
  assert.match(screen, /kind\?: RiseKind;/);
  assert.match(screen, /kind = 'grow'/, 'an unclassified screen no longer defaults to the grow');
  assert.equal((screen.match(/riseScreenMotion\([^;]*kindRef\.current\)/g) ?? []).length, 2, 'the kind must reach the motion on the open AND on the close');
  assert.match(screen, /data-rise-kind=\{kind\}/);
  assert.equal((screen.match(/playPicture\(el, originRef\.current, (?:false|true), reduced\)/g) ?? []).length, 2, 'Picture leads: the photo flies out and flies home');
  assert.match(code('app/_components/rise/rise-route.tsx'), /<RiseScreen [^>]*kind=\{kind\}/, 'a risen page cannot name its kind');
  // The folder holds the one screen and its route wrapper — a StackScreen / ZoomScreen beside them is a second opener.
  const parts = readdirSync(join(WEB, 'app/_components/rise')).filter((f) => /\.tsx$/.test(f)).sort();
  assert.deepEqual(parts, ['rise-route.tsx', 'rise-screen.tsx']);
  // And the frames live in one place.
  const lib = code('lib/rise-screen.ts');
  assert.equal((lib.match(/export function riseScreenMotion\(/g) ?? []).length, 1);
});

test('5 · Side peek: the panel from the right on the Spring, the strip still tappable, the close mirrored', () => {
  const sheet = rule('.sn-inspector-sheet');
  assert.match(sheet, /animation:\s*sn-side-peek-in var\(--sn-m-move\) var\(--sn-m-spring\) backwards;/, 'Side peek: Move on the Spring, fill backwards (never both)');
  assert.match(sheet, /left:\s*max\(3\.5rem/, 'the strip of list beside the card is gone');
  assert.match(CSS, /@keyframes sn-side-peek-in \{ from \{ transform: translateX\(100%\); \} \}/, 'it no longer slides in from the right edge');
  assert.match(rule('.sn-inspector-sheet[data-closing]'), /animation:\s*sn-side-peek-out calc\(var\(--sn-m-move\) \* 0\.8\) var\(--sn-m-settle-rev\);/, 'the close is not the open mirrored at 80 % — or it holds its transform (no fill: a held transform traps the card’s fixed children)');
  assert.match(CSS, /\.sn-inspector-sheet\[data-closed\],\s*\.sn-inspector-peek\[data-closed\] \{\s*visibility: hidden;/, 'the card shows again between the end of its slide and its unmount');
  assert.match(CSS, /@keyframes sn-side-peek-out \{ to \{ transform: translateX\(100%\); \} \}/);
  assert.match(rule('.sn-inspector-peek'), /animation:\s*sn-peek-in var\(--sn-m-quick\) var\(--sn-m-settle\) both;/, 'the dim is the Scrim: Quick on Settle');
  const col = code('app/_components/inspector/inspector-column.tsx');
  assert.match(col, /<button\s+type="button"\s+aria-label=\{alone \? 'Close' : 'Back to the list'\}\s+onClick=\{onClose\}/, 'the strip is no longer a button that goes back');
  assert.match(col, /const close = useCallback\(\(\) => playPeekOut\(closeNow\), \[closeNow\]\);/, 'the list’s card closes without sliding out');
  assert.match(col, /useBackCloses\(true, \(\) => playPeekOut\(onClosed\)\)/, 'a card opened alone closes without sliding out');
});

test('6 · Picture leads, card → page: one opt-in listener, one shared name, Rise on Settle', () => {
  const ctl = code('app/_components/nav/nav-slide-controller.tsx');
  assert.match(ctl, /closest\?\.\('a\[href\]\[data-picture-leads\]'\)/, 'the listener intercepts more than the links that asked');
  assert.match(ctl, /setProperty\('view-transition-name', 'sn-picture'\)/);
  assert.match(ctl, /removeProperty\('view-transition-name'\)/, 'the name is worn after the transition — two photos with one name skip the next transition');
  assert.match(rule("html[data-sn-nav-dir='picture'] [data-picture-hero]"), /view-transition-name:\s*sn-picture;/);
  const group = rule('::view-transition-group(sn-picture)');
  assert.match(group, /animation-duration:\s*var\(--sn-m-rise\);/);
  assert.match(group, /animation-timing-function:\s*var\(--sn-m-settle\);/);
});

test('7 · the screens classified so far wear their kind', () => {
  const WEARS: [string, RegExp][] = [
    ['app/_components/frontdoor/discover-filter-sheet.tsx', /<RiseScreen title="Filters"[^>]*kind="stack"/],
    ['app/vendor-dashboard/packages/_components/package-editor.tsx', /data="bundle-maker"\s+kind="stack"/],
    ['app/vendor-dashboard/@rise/(.)settings/layout.tsx', /<RiseRoute [^>]*kind="stack"/],
    ['app/vendor-dashboard/@rise/(.)website/layout.tsx', /<RiseRoute [^>]*kind="zoom"/],
  ];
  for (const [file, re] of WEARS) assert.match(code(file), re, `${file} lost its kind`);
  const offers = code('app/vendor-dashboard/offers/_components/offer-maker.tsx');
  assert.equal((offers.match(/data="offer-maker"\s+kind="stack"/g) ?? []).length, 2, 'the offer maker (something you fill in) is a Stack — while it loads, and once it has');
});
