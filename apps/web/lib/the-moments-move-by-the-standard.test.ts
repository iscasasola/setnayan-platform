/**
 * the-moments-move-by-the-standard.test.ts — 🎞 THE MOTION STANDARD, PHASE 6 (MOMENTS): SEVEN SHARED MOTIONS, EACH
 * BUILT ONCE.
 *
 * Owner, 18 Nov 2026 — "Add all 10" (`MOTION_STANDARD_2026-11-18.md` § 4 rows 12 · 15 · 23 · 24 · 25 · 27 · 28; drawing
 * `prototypes/motion_standard_2026-11-18_fable.html` Part B "Glide" / "Drag lift", Part H); 19 Nov — "animations build
 * the rest". The house rules (§ 3): transform and opacity only · fill `backwards`, never `both` · no `var()` inside a
 * keyframe's timing function · the tokens, never a raw time or curve · every motion has a reduced-motion still.
 *
 * WHERE EACH LIVES (the map — a new shared part is named here and in the Phase 6 block of globals.css):
 *   Celebrate   app/_components/celebrate.tsx + lib/moment-once.ts      Long press  the shared hold (HOLD_MS) + Lift
 *   Lift        lib/lift.ts                                             Upload      app/_components/upload-ring.tsx
 *   Coach marks app/_components/spotlight-tour.tsx                      Offline bar app/_components/offline-bar.tsx
 *   Glide       app/_components/glide-mount.tsx + lib/glide.ts          (mounted by app/_components/motion-mounts.tsx)
 *
 *   0 · the Phase 6 block obeys the house rules — and its two new numbers are tokens, equal in CSS and in the table;
 *   1 · CELEBRATE — about 12 pieces, ~900 ms on Settle, the badge on Spring; ONCE (`playsOnce`); never a booking
 *       (that is The Tie); reduced: a still gold ring, no pieces; the tour's own confetti is gone;
 *   2 · LONG PRESS — the ONE hold (350 ms) everywhere; the lift is Lift, the menu is Pop, the dim is the one scrim;
 *   3 · LIFT — `scale` + the shadow's opacity, never the row's transform; every adopted drag wears it and none keeps a
 *       lift of its own;
 *   4 · UPLOAD — the ring is turned by the measured figure alone; ✓ is Done's pop; nothing spins beside a figure;
 *   5 · COACH MARKS — the ring glides by `translate` in Move on Settle; nothing in the tour animates left / top / width;
 *   6 · OFFLINE BAR — Quick in and out by `translate`; shown only after the browser SAID offline; "Back online ✓";
 *   7 · GLIDE — an inner scroller contains its overscroll (never `none`), one shared edge fade, the nudge is Quick on
 *       Spring and only on arrival.
 *
 * Sabotage (each proved RED once, 19 Nov 2026, then restored) — the table is in changelog.d/claude-motion-moments.md:
 *   0 `--sn-m-hold: 350ms` → 400ms · 1 `if (playsOnce(` → `if (true || playsOnce(` in celebrate.tsx · 2 `SEAT_HOLD_MS =
 *   HOLD_MS` → `300` · 3 `transform: ghostAt(r.left, r.top)` → `… + ' scale(1.02)'` in guest-role-drag.tsx · 4 a
 *   `transition: rotate 1s` on `.sn-m-upring-half > i` · 5 the ring's `transition:translate` → `transition:all` ·
 *   6 `useState<Phase>('hidden')` → `(navigator.onLine ? 'hidden' : 'off')` · 7 `overscroll-contain` →
 *   `overscroll-none` on the picked shell's scroller (its one exception is the x axis only).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { CELEBRATE_MS, HOLD_MS, MOTION_TABLE, MOVE_MS, QUICK_MS, REDUCED_MOTION, TAP_MS } from './motion-table';
import { CELEBRATE_MOMENTS, MOMENTS, forgetMomentsForTest, playsOnce } from './moment-once';
import { GLIDE_NUDGE, glideAt, nudgeOnArrive } from './glide';
import { LIFT_HOLD_MS, LIFT_SCALE, ghostAt } from './lift';
import { SEAT_HOLD_MS } from './seat-list-drop';
import { SCENE_HOLD_MS } from './maker-scene-drag';

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));
const RAW_CSS = raw('app/globals.css');
const CSS = read('app/globals.css');

/** The Phase 6 block: from its header to the next section's. Cut on the RAW sheet (the markers are comments). */
const BLOCK = (() => {
  const a = RAW_CSS.indexOf('THE MOTION STANDARD · PHASE 6 — MOMENTS');
  const b = RAW_CSS.indexOf('LOOK › BUTTONS', a);
  assert.ok(a > 0 && b > a, 'anti-vacuity: the Phase 6 block was not found in globals.css');
  const body = stripComments(RAW_CSS.slice(RAW_CSS.lastIndexOf('/*', a), RAW_CSS.lastIndexOf('/*', b)));
  assert.ok(body.length > 4000, 'anti-vacuity: the Phase 6 block is nearly empty');
  return body;
})();

const MAY_MOVE = new Set(['opacity', 'transform', 'translate', 'scale', 'rotate']);
/** A raw time or curve inside a transition / animation declaration. */
const RAW_TIMING = /(?:\d|\.\d)\d*(?:ms|s)\b|cubic-bezier\(|linear\(|\bease(?:-in|-out|-in-out)?\b/;
const motionDecls = (css: string) => [...css.matchAll(/(?<![\w-])(transition|animation)(?:-[a-z-]+)?\s*:\s*([^;}]+)/g)].map((m) => ({ prop: m[1]!, value: m[2]!.trim() }));
/** Body of a rule in the block, by exact selector. */
function rule(sel: string, css = BLOCK): string {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(m, `globals.css (Phase 6) has no rule “${sel}”`);
  return m[1]!;
}
function keyframes(name: string): string {
  const at = BLOCK.search(new RegExp(`@keyframes ${name}\\s*\\{`));
  assert.ok(at >= 0, `the Phase 6 block has no @keyframes ${name}`);
  let depth = 0;
  for (let i = BLOCK.indexOf('{', at); i < BLOCK.length; i++) {
    if (BLOCK[i] === '{') depth++;
    else if (BLOCK[i] === '}' && --depth === 0) return BLOCK.slice(BLOCK.indexOf('{', at) + 1, i);
  }
  throw new Error(`@keyframes ${name} never closes`);
}
const reducedBlock = () => {
  const at = BLOCK.lastIndexOf('@media (prefers-reduced-motion: reduce)');
  assert.ok(at > 0, 'the Phase 6 block has no reduced-motion rules');
  return BLOCK.slice(at);
};
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(WEB, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = `${dir}/${name}`;
    if (statSync(join(WEB, p)).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('0 · the Phase 6 block obeys the house rules, and its two numbers are tokens', () => {
  // The two new numbers: one value each, the same in the table and in the sheet.
  const decl = (name: string) => [...CSS.matchAll(new RegExp(`${name}:\\s*([^;]+);`, 'g'))].map((m) => m[1]!.trim());
  assert.deepEqual(decl('--sn-m-hold'), [`${HOLD_MS}ms`], '--sn-m-hold is not the table’s HOLD_MS, declared once');
  assert.deepEqual(decl('--sn-m-celebrate'), [`${CELEBRATE_MS}ms`], '--sn-m-celebrate is not the table’s CELEBRATE_MS, declared once');
  assert.deepEqual([HOLD_MS, CELEBRATE_MS], [350, 900], 'the standard says: hold 350 ms, Celebrate about 900 ms');

  // Every keyframe moves only the transform family and opacity, with no var() in a timing function.
  const names = [...BLOCK.matchAll(/@keyframes ([\w-]+)/g)].map((m) => m[1]!);
  assert.deepEqual(names.sort(), ['sn-m-burst', 'sn-m-cele-in', 'sn-m-cele-pop'], 'the Phase 6 keyframes changed — name the new one here and check it');
  for (const n of names) {
    const body = keyframes(n);
    const props = [...body.matchAll(/(?:^|[;{\s])([a-z-]+)\s*:/g)].map((m) => m[1]!);
    assert.ok(props.length > 0, `anti-vacuity: @keyframes ${n} declares nothing`);
    for (const p of props) assert.ok(MAY_MOVE.has(p), `@keyframes ${n} animates “${p}” — transform and opacity only`);
    assert.doesNotMatch(body, /animation-timing-function/, `@keyframes ${n} carries a timing function — the curve goes on the element`);
  }
  // Every transition / animation reads the tokens; an animation fills backwards; a transition moves only what may move.
  const decls = motionDecls(BLOCK);
  assert.ok(decls.length >= 10, `anti-vacuity: only ${decls.length} motion declarations were read`);
  for (const { prop, value } of decls) {
    if (/^none\b/.test(value)) continue;
    assert.doesNotMatch(value, RAW_TIMING, `a raw time or curve in the Phase 6 block: “${prop}: ${value}”`);
    if (prop === 'animation') {
      for (const part of value.split(',')) assert.match(part, /\bbackwards\b/, `an animation that does not fill backwards: “${part.trim()}”`);
      assert.doesNotMatch(value, /\b(?:both|forwards|infinite)\b/, `Phase 6 has no held fill and no loop: “${value}”`);
    } else {
      for (const part of value.split(',')) {
        const moved = part.trim().split(/\s+/)[0]!;
        assert.ok(MAY_MOVE.has(moved), `a transition on “${moved}” — transform and opacity only (“${value}”)`);
      }
    }
  }
  // Every motion has its still, in words (the table) and in the sheet.
  for (const k of ['celebrate', 'longPress', 'lift', 'upload', 'coach', 'offline', 'glide'] as const) assert.ok(REDUCED_MOTION[k], `no reduced-motion fallback written for ${k}`);
  const still = reducedBlock();
  for (const sel of ['.sn-m-cele-piece', '.sn-m-cele-pop', '.sn-m-lift', '.sn-m-offline']) assert.ok(still.includes(sel), `${sel} has no reduced-motion rule`);
});

test('1 · Celebrate — twelve pieces, ~900 ms on Settle, the badge on Spring, ONCE, and never for a booking', async () => {
  const src = read('app/_components/celebrate.tsx');
  const { CELEBRATE_PIECES } = await import('../app/_components/celebrate');
  assert.equal(CELEBRATE_PIECES.length, MOTION_TABLE.celebratePieces);
  assert.equal(MOTION_TABLE.celebratePieces, 12);
  assert.match(rule('.sn-m-cele-piece'), /animation:\s*sn-m-burst var\(--sn-m-celebrate\) var\(--sn-m-settle\) backwards/);
  assert.match(rule('.sn-m-cele-pop'), /sn-m-cele-pop var\(--sn-m-quick\) var\(--sn-m-spring\) backwards,\s*sn-m-cele-in var\(--sn-m-quick\) var\(--sn-m-settle\) backwards/, 'the badge: size on Spring, fade on Settle');
  assert.match(rule('.sn-m-cele-piece'), /opacity:\s*0/, 'a piece must rest at opacity 0 — nothing is left on the page');
  // Reduced: a still gold ring, no pieces.
  const still = reducedBlock();
  assert.match(still, /\.sn-m-cele-piece\s*\{\s*display:\s*none/);
  assert.match(still, /\.sn-m-cele-ring\s*\{\s*opacity:\s*1/);
  // ONCE — the part asks the gate before it draws a single piece, after mount.
  assert.match(src, /useEffect\(\(\) => \{\s*if \(playsOnce\(moment, onceKey, scope\)\) setBurst\(true\);/, 'the burst is not gated on playsOnce');
  assert.match(src, /\{burst \? \(\s*<span className="sn-m-cele-burst"/, 'pieces are drawn without the gate');
  // The gate itself: true once, then false — per moment and key.
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  (globalThis as { window?: unknown }).window = { sessionStorage: store, localStorage: store };
  try {
    forgetMomentsForTest();
    assert.equal(playsOnce('payment', 'ORD-1'), true);
    assert.equal(playsOnce('payment', 'ORD-1'), false, 'the same payment celebrated twice in one visit');
    assert.equal(playsOnce('payment', 'ORD-2'), true, 'a second payment is its own moment');
    forgetMomentsForTest();
    assert.equal(playsOnce('payment', 'ORD-1'), false, 'the visit’s memory (storage) was not read');
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
  // Payments and badges (and a tour's end). A booking is The Tie's — it is a moment, but not Celebrate's.
  assert.deepEqual([...CELEBRATE_MOMENTS], ['payment', 'badge', 'tour']);
  assert.ok((MOMENTS as readonly string[]).includes('tie'), 'The Tie lost its hook in the once-gate');
  const users = walk('app').filter((f) => /<Celebrate\b/.test(read(f)));
  assert.deepEqual(users.sort(), ['app/_components/spotlight-tour.tsx', 'app/pay/[reference]/page.tsx', 'app/vendor-dashboard/_components/badge-earned-line.tsx'], 'who celebrates changed — add the new place here on purpose');
  for (const f of users) assert.doesNotMatch(read(f), /<Celebrate\b[^>]*moment="(?!payment"|badge"|tour")/, `${f} celebrates something that is not a payment, a badge or a tour`);
  // The tour's own 70-piece fall is gone.
  const tour = read('app/_components/spotlight-tour.tsx');
  assert.doesNotMatch(tour, /sn-spot-fall|sn-spot-confetti|function Confetti/, 'the tour still throws confetti of its own');
});

test('2 · Long press — ONE hold (350 ms), read by every hold; the lift is Lift', () => {
  assert.equal(LIFT_HOLD_MS, HOLD_MS);
  // Every hold the app waits before a lift is the SAME number, read from the table.
  assert.equal(SEAT_HOLD_MS, HOLD_MS, 'the seat plan holds for a time of its own');
  // (The Maker's scene drag keeps its number typed — its imports are fenced off the first load — so it is held EQUAL.)
  assert.equal(SCENE_HOLD_MS, HOLD_MS, 'the Maker’s scene drag holds for a time of its own');
  assert.match(read('app/dashboard/[eventId]/guests/_components/guest-role-drag.tsx'), /export const ROLE_HOLD_MS = LIFT_HOLD_MS;/);
  assert.match(read('app/dashboard/[eventId]/launch/_components/rsvp-canvas-drag.ts'), /export const RSVP_HOLD_MS = HOLD_MS;/);
  assert.match(read('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx'), /const LONG_PRESS_MS = HOLD_MS;/);
  // The hold-menu part (`long-press.tsx`) was removed on 19 Nov: no screen mounted it (ugat both-ends). Until a screen
  // opens a menu on a hold, the long press IS the one hold above plus Lift — and no stray menu rules ship.
  // (If a menu part comes back, ugat-both-ends holds it to a real mount; this only keeps its rules from shipping alone.)
  assert.doesNotMatch(BLOCK, /\.sn-m-hold-menu\b/, 'menu rules ship with no menu');
});

test('3 · Lift — scale and the shadow’s opacity, never the row’s transform; no drag keeps a lift of its own', () => {
  assert.equal(LIFT_SCALE, 1.03);
  assert.equal(ghostAt(12, 34), 'translate(12px,34px)', 'the ghost’s transform must be the translate alone');
  assert.match(rule('.sn-m-lift'), /transition:\s*scale var\(--sn-m-quick\) var\(--sn-m-spring\)/, 'the lift: Quick on Spring');
  assert.match(rule('.sn-m-lift::after'), /transition:\s*opacity var\(--sn-m-quick\) var\(--sn-m-settle\)/, 'the shadow: Settle, opacity only');
  assert.match(rule('.sn-m-lift::after'), /box-shadow:[^;]+;\s*opacity:\s*0/, 'the shadow is a layer whose opacity moves — a box-shadow is never animated');
  assert.match(rule('.sn-m-lift[data-lifted],\n.sn-m-lift[data-lift-ghost]'), new RegExp(`scale:\\s*${LIFT_SCALE}`));
  assert.match(rule('.sn-m-lift[data-lift-dropping]'), /transition:\s*scale var\(--sn-m-move\) var\(--sn-m-settle\)/, 'the drop: Move on Settle');
  assert.match(rule('.sn-m-lift-room'), /transition:\s*translate var\(--sn-m-move\) var\(--sn-m-settle\)/, 'the others make room: Move on Settle');
  assert.match(BLOCK, /@starting-style\s*\{\s*\.sn-m-lift\[data-lift-ghost\]\s*\{\s*scale:\s*1;/, 'a ghost’s lift is an @starting-style entrance');
  assert.match(reducedBlock(), /\.sn-m-lift\[data-lifted\],\s*\.sn-m-lift\[data-lift-ghost\]\s*\{\s*scale:\s*1;/, 'reduced: no scale');
  const lift = read('lib/lift.ts');
  assert.doesNotMatch(lift, /scale\(/, 'lift.ts writes a scale into a transform');
  // The adopted drags: each dresses its ghost with the one Lift and drops it the one way.
  const drags = [
    'app/dashboard/[eventId]/guests/_components/guest-role-drag.tsx',
    'app/dashboard/[eventId]/seating/_components/seat-list.tsx',
    'app/dashboard/[eventId]/seating/_components/seat-face-tray.tsx',
  ];
  for (const f of drags) {
    const s = read(f);
    assert.match(s, /liftGhost\(ghost\);\s*\n[^\n]*appendChild\(ghost\)/, `${f}: the ghost is not dressed before it is added (the entrance would not play)`);
    assert.match(s, /void dropGhost\(/, `${f}: the ghost is removed without the drop`);
    assert.doesNotMatch(s, /scale\(1\.0\d\)/, `${f}: a lift scale of its own`);
    assert.doesNotMatch(s, /ghost[\s\S]{0,400}boxShadow:/, `${f}: a lift shadow of its own`);
  }
});

test('4 · Upload — the ring is turned by the measured figure alone, then ✓ is Done’s pop', async () => {
  const { uploadRingTurns } = await import('../app/_components/upload-ring');
  assert.deepEqual([0, 25, 50, 75, 100].map((p) => uploadRingTurns(p)), [
    { a: 0, b: 0 },
    { a: 90, b: 0 },
    { a: 180, b: 0 },
    { a: 180, b: 90 },
    { a: 180, b: 180 },
  ]);
  assert.deepEqual(uploadRingTurns(null), { a: 0, b: 0 }, 'an unknown progress must be the track alone — never a made-up figure');
  assert.deepEqual(uploadRingTurns(140), { a: 180, b: 180 });
  // Reduced: quarter steps.
  assert.deepEqual(uploadRingTurns(60, true), uploadRingTurns(50));
  assert.deepEqual(uploadRingTurns(24, true), uploadRingTurns(0));
  // It follows the upload: no curve, no speed, no spin of its own.
  for (const sel of [".sn-m-upring-half[data-half='r'] > i", ".sn-m-upring-half[data-half='l'] > i", '.sn-m-upring-half > i']) {
    assert.doesNotMatch(rule(sel), /transition|animation/, `${sel}: the ring has a motion of its own — it must follow the upload`);
  }
  assert.match(rule(".sn-m-upring-half[data-half='r'] > i"), /rotate:\s*var\(--ur-a, 0deg\)/);
  assert.match(rule(".sn-m-upring-half[data-half='l'] > i"), /rotate:\s*var\(--ur-b, 0deg\)/);
  const src = read('app/_components/upload-ring.tsx');
  assert.match(src, /className="sn-m-upring-done sn-m-done"/, '✓ is not Done’s pop (Quick on Spring)');
  assert.match(src, /usePrefersReducedMotion\(\)/);
  // Who wears it — and none of them still draws a pie or a bar of its own.
  for (const f of ['app/_components/file-upload.tsx', 'app/dashboard/[eventId]/launch/_components/studio-prints-six.tsx']) {
    const s = read(f);
    assert.match(s, /<UploadRing\b/, `${f} lost the upload ring`);
    assert.doesNotMatch(s, /conic-gradient\([^)]*progress|data-upload-pie|conic-gradient\(rgb\(var\(--sn-accent\)\) \$\{pct\}/, `${f} draws a progress pie of its own`);
  }
  assert.equal((read('app/_components/file-upload.tsx').match(/<UploadRing\b/g) ?? []).length, 4, 'the uploader’s four in-flight drawings (row circle, thumb, gallery tile, list row) do not all wear the ring');
  assert.match(read('app/papic/_components/upload-chip.tsx'), /kind === 'saved' \? ' sn-m-done'/, 'the Papic chip’s "All saved" ✓ lost its pop');
});

test('5 · Coach marks — the ring glides by translate in Move on Settle; nothing in the tour lays the page out to move', () => {
  const src = read('app/_components/spotlight-tour.tsx');
  const css = /const CSS_TEXT = `([\s\S]*?)`;/.exec(src)?.[1];
  assert.ok(css && css.length > 1500, 'anti-vacuity: the tour’s stylesheet was not found');
  assert.match(css, /\.sn-spot-ring\{[^}]*transition:translate var\(--sn-m-move\) var\(--sn-m-settle\)/, 'the ring does not glide in Move on Settle');
  assert.match(src, /data-coach-ring=""\s*style=\{\{ translate: `\$\{box\.x\}px \$\{box\.y\}px`, width: box\.w, height: box\.h/, 'the ring is placed by left / top again — it must be translate');
  const decls = motionDecls(css);
  assert.ok(decls.length >= 6, 'anti-vacuity: the tour’s motion declarations were not read');
  for (const { prop, value } of decls) {
    if (/^none\b/.test(value)) continue;
    assert.doesNotMatch(value, RAW_TIMING, `a raw time or curve in the tour: “${prop}: ${value}”`);
    if (prop === 'transition') {
      for (const part of value.split(',')) assert.ok(MAY_MOVE.has(part.trim().split(/\s+/)[0]!), `the tour transitions “${part.trim().split(/\s+/)[0]}” — transform and opacity only`);
    }
  }
  for (const m of css.matchAll(/@keyframes [\w-]+\{([^@]*?\})\}/g)) {
    for (const p of [...m[1]!.matchAll(/([a-z-]+):/g)].map((x) => x[1]!)) assert.ok(MAY_MOVE.has(p), `a tour keyframe animates “${p}”`);
  }
  assert.equal(MOTION_TABLE.coachMs, MOVE_MS);
  // Reduced: the ring jumps (its transition is off).
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.sn-spot-ring,[^{]*\{animation:none!important;transition:none!important\}/);
});

test('6 · Offline bar — Quick in and out by translate; only after the browser said offline; "Back online ✓"', async () => {
  assert.match(rule('.sn-m-offline'), /transition:\s*translate var\(--sn-m-quick\) var\(--sn-m-settle\)/);
  assert.match(BLOCK, /@starting-style\s*\{\s*\.sn-m-offline\s*\{\s*translate:\s*0 -100%;/, 'the bar’s entrance is not @starting-style');
  assert.match(rule('.sn-m-offline[data-leaving]'), /translate:\s*0 -100%/);
  assert.match(rule('.sn-m-offline > span'), /transition:\s*opacity var\(--sn-m-quick\) var\(--sn-m-settle\)/, 'the words cross-fade in Quick on Settle');
  assert.match(rule('.sn-m-offline'), /pointer-events:\s*none/, 'the bar must take no tap');
  assert.equal(MOTION_TABLE.offlineMs, QUICK_MS);
  const { OFFLINE_WORDS, BACK_ONLINE_WORDS } = await import('../app/_components/offline-bar');
  assert.equal(BACK_ONLINE_WORDS, 'Back online ✓');
  assert.match(OFFLINE_WORDS, /^You're offline/);
  const src = read('app/_components/offline-bar.tsx');
  // Never from navigator.onLine on load: a bar on every cold start of a waking phone would be a false alarm.
  assert.match(src, /useState<Phase>\('hidden'\)/);
  assert.doesNotMatch(src, /navigator\.onLine/, 'the bar reads navigator.onLine — it must wait for the browser’s own `offline` event');
  assert.match(src, /addEventListener\('offline', off\)/);
  assert.match(src, /addEventListener\('online', on\)/);
  assert.match(src, /setPhase\(\(p\) => \(p === 'off' \? 'back' : p\)\)/, '"Back online" must only follow a bar that was up');
  // One mount for every screen, loaded after the page (never in the shared first load).
  assert.match(read('app/_components/motion-mounts.tsx'), /<OfflineBar \/>\s*<GlideMount \/>/);
  assert.match(read('app/providers.tsx'), /const MotionMounts = dynamic\(\(\) => import\('\.\/_components\/motion-mounts'\)\.then\(\(m\) => m\.MotionMounts\), \{ ssr: false \}\);/);
  assert.match(read('app/providers.tsx'), /<MotionMounts \/>/);
});

test('7 · Glide — an inner scroller contains its overscroll, one shared edge fade, the nudge only on arrival', () => {
  assert.match(rule('.sn-glide-x'), /overscroll-behavior-x:\s*contain/);
  assert.match(rule('.sn-glide-y'), /overscroll-behavior-y:\s*contain/);
  for (const sel of ['.sn-glide-x', '.sn-glide-y']) {
    assert.match(rule(sel), /mask-image:\s*linear-gradient\([^;]*var\(--gl-a\)[^;]*var\(--gl-b\)/, `${sel} lost the shared edge fade`);
    assert.doesNotMatch(rule(sel), /transition|animation/, `${sel}: the edge fade is still — it never animates`);
  }
  // Where a scroller stands decides which edge fades.
  assert.deepEqual(
    [glideAt(0, 300, 300), glideAt(0, 900, 300), glideAt(120, 900, 300), glideAt(600, 900, 300), glideAt(599.6, 900, 300), glideAt(-600, 900, 300)],
    ['none', 'start', 'mid', 'end', 'end', 'end'],
  );
  // The nudge: only when a scroll ARRIVES at an end — never a rail already resting there, never one that cannot scroll.
  assert.deepEqual(
    [nudgeOnArrive('mid', 'end'), nudgeOnArrive('mid', 'start'), nudgeOnArrive('end', 'end'), nudgeOnArrive('none', 'start'), nudgeOnArrive('start', 'mid'), nudgeOnArrive('mid', 'none')],
    [-1, 1, 0, 0, 0, 0],
  );
  assert.deepEqual(GLIDE_NUDGE, { px: 12, outMs: TAP_MS, backMs: QUICK_MS }, 'the nudge: 12 px, back in Quick');
  const mount = read('app/_components/glide-mount.tsx');
  assert.match(mount, /easing: springEase\(\)/, 'the nudge comes back on the Spring');
  assert.match(mount, /if \(reduced \|\| native \|\| moving\.has\(el\)/, 'reduced motion (and a phone with its own rubber band) must get no nudge');
  assert.match(mount, /fill: 'none'/, 'the nudge must hold nothing when it ends');
  assert.doesNotMatch(mount, /transform|scrollTo\(|scrollBy\(|scrollLeft\s*=|scrollTop\s*=/, 'Glide retimes or moves a scroll — the slow-down is the phone’s own');
  // The page itself stays `none` (no page bounce); NO inner scroller says `none`.
  const offenders: string[] = [];
  const SCROLLS = /\boverflow(?:-[xy])?-(?:auto|scroll)\b/;
  const NONE = /\boverscroll(?:-[xy])?-none\b|\[overscroll-behavior(?:-[xy])?:none\]/;
  const PICKED_SHELL = 'app/_components/picked/picked-shell.tsx';
  for (const f of [...walk('app'), ...walk('components')].filter((p) => p.endsWith('.tsx'))) {
    for (const m of read(f).matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const cls = m[1] ?? m[2] ?? '';
      // ONE named exception, x axis only: the picked shell's body turns pages with a sideways swipe (#36) and must never
      // move sideways itself (§10 #26), so main keeps `[overscroll-behavior-x:none]` there; its vertical stays `contain`.
      const exempt = f === PICKED_SHELL && !/\boverscroll-none\b|\[overscroll-behavior(?:-y)?:none\]|overscroll-y-none/.test(cls) && /\boverscroll-contain\b/.test(cls);
      if (!exempt && NONE.test(cls) && (SCROLLS.test(cls) || /\boverscroll-contain\b/.test(cls))) offenders.push(`${f}: "${cls.slice(0, 90)}"`);
    }
  }
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1]!.trim();
    if (/overscroll-behavior(?:-[xy])?:\s*none/.test(m[2]!) && /overflow(?:-[xy])?:\s*(?:auto|scroll)/.test(m[2]!) && !/^(?:html|body|html,\s*body)/.test(sel)) offenders.push(`globals.css: ${sel}`);
  }
  assert.deepEqual(offenders, [], 'an inner scroller turns its overscroll OFF — Glide says `contain` (the phone’s rubber band stays inside the box)');
  // Who wears the rail class (a new rail is added here on purpose).
  const rails = [...walk('app'), ...walk('components')].filter((f) => f.endsWith('.tsx') && /className="[^"]*\bsn-glide-x\b/.test(read(f)));
  assert.deepEqual(rails.sort(), [
    'app/(shell)/explore/_components/icon-tile-folder-strip.tsx',
    'app/(shell)/explore/_components/sticky-marketplace-header.tsx',
    'app/dashboard/[eventId]/launch/_components/pass-card-design-picker.tsx',
    'app/dashboard/[eventId]/vendors/_components/find-inspiration.tsx',
    'app/vendor-dashboard/collections/_components/portfolio-sections.tsx',
    'app/vendor-dashboard/shop/_components/shop-badge-row.tsx',
    'app/vendor-dashboard/shop/_components/shop-makers.tsx',
    'app/vendor-dashboard/shop/promote/_components/shop-prints-section.tsx',
  ]);
});
