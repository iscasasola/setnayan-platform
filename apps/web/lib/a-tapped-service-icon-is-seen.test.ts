/**
 * a-tapped-service-icon-is-seen.test.ts — A TAP ON A DRAWN ICON CAN BE SEEN, EVEN WHEN THE TAP LEAVES THE SCREEN.
 *
 * Owner, live, 18 Nov 2026: *"when i tap the icons nothing is happening"*. Measured that day on production: the press
 * did start the play (`.go` landed, each part's animation was created) — but the tiles these icons sit in open another
 * screen, so the tile left the page with its icon a frame or two later. The play was real and unseeable.
 *
 *   1 · the play starts on TOUCH-DOWN (before the click that navigates), a link counts as a host, and nothing in the
 *       player holds the navigation back;
 *   2 · an icon whose tile leaves the page mid-play is CARRIED — a still-playing copy where it was, going on from
 *       where the play had got to (`carryPlan`), on a layer above the next screen, taking no tap;
 *   3 · an icon that stays keeps `.go` through a re-render that rewrites its class;
 *   4 · the link tile shows a pressed state (a plain link is not one of the press feel's own targets);
 *   5 · the play is on the motion standard's tokens — and still only transform + opacity.
 *
 * Sabotage (each proved red, 18 Nov 2026): the listener moved from `pointerdown` to `click` (1) · `a` dropped from the
 * hosts (1) · the carry removed from `onPageChange` (2) · `.si-carry`'s `--si-skip` delay dropped, so the copy starts
 * the play again (2) · `sn-press` taken off the folder link (4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { MOVE_MS, QUICK_MS, RISE_MS_STANDARD } from './motion-table';
import { HOLD_MS, PLAY_MS, carryPlan } from '../app/_components/service-icon-play';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PLAYER = read('app/_components/service-icon-play.tsx');
const CSS = read('app/service-icons.css');

test('1 · the play starts on touch-down, a link is a host, and the navigation is never held back', () => {
  // Touch-down — the click that navigates comes later; a `click` listener would start the play as the page leaves.
  assert.match(PLAYER, /document\.addEventListener\('pointerdown', onDown, true\);/, 'the play does not start on touch-down');
  assert.match(PLAYER, /const onDown = \(e: PointerEvent\) => \{\s*if \(e\.target instanceof Element\) playServiceIcons\(e\.target\);\s*\};/);
  // The keyboard's press (a click with no pointer) plays too — and only that click.
  assert.match(PLAYER, /if \(e\.detail === 0 && e\.target instanceof Element\) playServiceIcons\(e\.target\);/);
  // A link counts.
  const hosts = /const HOSTS = "([^"]+)";/.exec(PLAYER)?.[1]?.split(/,\s*/) ?? [];
  assert.ok(hosts.includes('a'), `a link is not a host (${hosts.join(' · ')}) — a link tile's icon never plays`);
  assert.ok(hosts.includes('button'), 'anti-vacuity: a button is not a host');
  // Nothing holds the tap: no preventDefault, no stopPropagation, no router, no awaiting before the page may go.
  assert.doesNotMatch(PLAYER, /preventDefault|stopPropagation|stopImmediatePropagation|useRouter|router\.|location\.|\bawait\b/, 'the player holds, wraps or redirects the tap — the navigation must never wait for the play');
  // `.go` goes on at once (synchronously in the press), not after a frame or a timer.
  assert.match(PLAYER, /icon\.classList\.remove\('go'\);\s*const r = icon\.getBoundingClientRect\(\);[^\n]*\n\s*icon\.classList\.add\('go'\);/, '`.go` is not put on in the press itself');
  // Mounted once, on every page.
  assert.match(read('app/layout.tsx'), /<ServiceIconPlay \/>/, 'the player is not mounted in the root layout');
  assert.match(read('app/layout.tsx'), /import '\.\/service-icons\.css';/);
});

test('2 · an icon whose tile leaves the page mid-play is carried, from where the play had got to', () => {
  // The plan: skip what has run, live for what is left; nothing once the play has run.
  assert.deepEqual(carryPlan(0), { skipMs: 0, leftMs: PLAY_MS });
  assert.deepEqual(carryPlan(120), { skipMs: 120, leftMs: PLAY_MS - 120 });
  assert.equal(carryPlan(PLAY_MS), null, 'a finished play is carried');
  assert.equal(carryPlan(PLAY_MS + 50), null);
  assert.equal(carryPlan(-5), null);
  assert.deepEqual(carryPlan(100, MOVE_MS), { skipMs: 100, leftMs: MOVE_MS - 100 }, 'under “reduce motion” the play is Move');
  // The page is watched only while a play runs, for the tile leaving — and what left is carried.
  assert.match(PLAYER, /watch = new MutationObserver\(onPageChange\);\s*watch\.observe\(document\.body, \{ childList: true, subtree: true, attributes: true, attributeFilter: \['class'\] \}\);/);
  assert.match(PLAYER, /if \(!icon\.isConnected\) \{\s*window\.clearTimeout\(play\.timer\);\s*plays\.delete\(icon\);\s*carry\(icon, play\);/, 'an icon that leaves the page mid-play is not carried');
  assert.match(PLAYER, /if \(plays\.size === 0 && watch\) \{\s*watch\.disconnect\(\);\s*watch = null;/, 'the page is watched for ever');
  // The copy: where the icon was at the press, still playing, on <body>, said to nobody, taking no tap.
  assert.match(PLAYER, /const copy = icon\.cloneNode\(true\) as Element;\s*copy\.classList\.add\('go'\);/);
  assert.match(PLAYER, /box\.className = 'si-carry';\s*box\.setAttribute\('aria-hidden', 'true'\);/);
  assert.match(PLAYER, /--si-skip:-\$\{plan\.skipMs\}ms/, 'the copy starts the play again instead of going on');
  assert.match(PLAYER, /document\.body\.appendChild\(box\);/);
  const box = /\.si-carry\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
  assert.match(box, /position:fixed/, 'the copy is not laid over the next screen');
  assert.match(box, /pointer-events:none/, 'the copy takes a tap');
  assert.match(box, /z-index:calc\(var\(--sn-z-panel\) \+ 1\)/, 'the copy is under the loading state or a sheet');
  // It goes on from where the play had got to — every part, the staggered ones included.
  assert.match(CSS, /\.si-carry\.si-carry svg\.si\.go \*\{animation-delay:var\(--si-skip,0s\)!important\}/);
  for (const [q, share] of [['q1', '.12'], ['q2', '.24'], ['q3', '.06'], ['q4', '.18'], ['q5', '.3']] as const) {
    assert.ok(CSS.includes(`svg.si.go .${q}{`), `anti-vacuity: the stagger .${q} is gone`);
    assert.ok(CSS.includes(`.si-carry.si-carry svg.si.go .${q}{animation-delay:calc(var(--si-skip,0s) + var(--md)*${share})!important}`), `the carried .${q} loses its stagger`);
  }
  // It ends: a fade in Quick, then it is taken off the page.
  assert.match(PLAYER, /box\.animate\(\[\{ opacity: 1 \}, \{ opacity: 0 \}\], \{ duration: QUICK_MS, easing: EASE_SETTLE, fill: 'forwards' \}\)\.finished\.then\(gone, gone\);/);
});

test('3 · an icon that stays keeps its play through a re-render that rewrites its class', () => {
  assert.match(PLAYER, /\} else if \(!icon\.classList\.contains\('go'\)\) \{\s*icon\.classList\.add\('go'\);/, 'a re-render that rewrites the class cuts the play');
  // …and a second quick press still restarts it (the play is forgotten while `.go` is taken off).
  assert.match(PLAYER, /plays\.delete\(icon\);[^\n]*\n\s*icon\.classList\.remove\('go'\);/);
});

test('4 · the link tile shows a pressed state', () => {
  const strip = read('app/(shell)/explore/_components/icon-tile-folder-strip.tsx');
  assert.match(strip, /<a\s+href=\{href\}/, 'anti-vacuity: the folder tile is no longer a plain link');
  assert.match(strip, /'sn-press group flex h-\[78px\] w-\[96px\]/, 'the folder link has no pressed state — a plain link is not a press-feel target');
  const press = read('app/_components/press-feel.tsx');
  const targets = /export const PRESS_TARGETS = "([^"]+)";/.exec(press)?.[1] ?? '';
  assert.ok(targets.split(/,\s*/).includes('.sn-press'), 'anti-vacuity: `.sn-press` is no longer a press target');
  assert.ok(!targets.split(/,\s*/).includes('a'), 'a plain link became a press target — the `sn-press` on the tile is then moot; re-point this guard');
});

test('5 · the play is on the standard’s tokens — and still only transform + opacity', () => {
  assert.equal(PLAY_MS, RISE_MS_STANDARD);
  assert.equal(HOLD_MS, RISE_MS_STANDARD + QUICK_MS);
  assert.match(CSS, /svg\.si\{--md:var\(--sn-m-rise\);/, 'the play is not Rise');
  assert.match(CSS, /transition:color var\(--sn-m-rise\) var\(--sn-m-settle\)\}/, 'the colour does not fade back over Rise on Settle');
  assert.match(CSS, /svg\.si\.go\{color:rgb\(var\(--color-mulberry\)\);transition:color var\(--sn-m-tap\) var\(--sn-m-settle\)\}/, 'the colour does not come on in Tap');
  assert.match(CSS, /@media \(prefers-reduced-motion:reduce\)\{svg\.si\{--md:var\(--sn-m-move\)\}\}/, 'under “reduce motion” the play is not shortened to Move');
  assert.doesNotMatch(CSS, /cubic-bezier\(/, 'a raw curve is back in the icon plays');
  assert.doesNotMatch(CSS, /(?:animation|transition)[^;{}]*?[\s:](?:\d*\.)?\d+m?s\b/, 'a raw time is back in the icon plays');
  // Every part's play: `var(--md)`, filled, and one of the two curves or a keyword.
  const plays = [...CSS.matchAll(/animation:si-[A-Za-z0-9]+ ([^;}!]+)!important/g)].map((m) => m[1]!.trim());
  assert.ok(plays.length > 90, `anti-vacuity: only ${plays.length} part plays were found`);
  for (const p of plays) assert.match(p, /^var\(--md\) (?:ease-in-out|ease-out|ease-in|ease|linear|var\(--sn-m-settle\)|var\(--sn-m-spring\)) both$/, `a part plays as “${p}”`);
  // Only transform and opacity move.
  const frames = [...CSS.matchAll(/@keyframes si-[A-Za-z0-9]+\{((?:[^{}]*\{[^{}]*\})+)\}/g)];
  assert.ok(frames.length > 90, `anti-vacuity: only ${frames.length} keyframes were found`);
  for (const f of frames) {
    for (const m of f[1]!.matchAll(/(?:^|[;{])\s*([a-z-]+)\s*:/g)) {
      assert.ok(['transform', 'opacity', 'transform-origin'].includes(m[1]!), `${f[0].slice(0, 40)}… animates “${m[1]}”`);
    }
  }
});
