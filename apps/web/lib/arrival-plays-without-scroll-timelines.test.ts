/**
 * arrival-plays-without-scroll-timelines.test.ts — ON ARRIVAL WORKS ON AN ENGINE WITHOUT SCROLL TIMELINES
 * (Safari before 26 — iOS 18 and older — and Firefox). The 2026-10-15 Animate walk, F12 / S2: every motion rule sat
 * behind `@supports (animation-timeline: view())`, so on those engines nothing moved at all — not even a Build in
 * that plays on arrival, which needs only the page's observer (`PahinaMotionObserver`) and the clock.
 *
 *   (1) THE STYLESHEET's other half (`@supports not (animation-timeline: view())`, inside the same reduced-motion
 *       gate) plays every scene's arrival once its frame is marked `.pahina-in` — whole, part after part, and a
 *       list's rows one by one — from the scene's own keyframe and seconds; a scene that follows the scroll arrives
 *       on arrival there. Sabotage: the scene rule removed → red.
 *   (2) IT NEVER PLAYS A BUILD OUT (a Build out follows the scroll; on a clock it would hide the words) and never
 *       names a timeline — and a hero part reads `--el-anim-t` (its arrival alone), never `--el-anim`.
 *       Sabotage: the hero rule reading `--el-anim` → red.
 *   (3) THE OBSERVER that marks the scenes is not itself gated on scroll timelines (it needs IntersectionObserver
 *       and motion allowed — nothing else), so the mark reaches those engines.
 *   (4) EVERY hero part's arrival-only list is its In (on the clock; a scroll-driven In on arrival) and its Drift —
 *       never an Out — for every motion the model allows.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hubElementArrivalOnly, hubElementInlineStyle, sanitizeHubElementMotion, type HubElementMotion } from './element-style';

const WEB = join(__dirname, '..');
const CSS = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');

function blockAt(css: string, at: number): string {
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}' && (depth -= 1) === 0) return css.slice(open + 1, i);
  }
  throw new Error('unclosed block');
}
/** The body of the no-scroll-timeline gate's reduced-motion block — the one in the page's stylesheet. */
function noViewRegion(): string {
  const at = CSS.indexOf('@supports not (animation-timeline: view())');
  assert.ok(at >= 0, 'there is no rule at all for an engine without scroll timelines');
  const inner = blockAt(CSS, at);
  const mq = inner.search(/@media [^{]*\(prefers-reduced-motion: no-preference\)/);
  assert.ok(mq >= 0, 'the arrival without scroll timelines ignores a guest who asked for less motion');
  return blockAt(inner, mq);
}
const ruleFor = (region: string, sel: RegExp) => {
  const m = new RegExp(`${sel.source}[^{]*\\{([^}]*)\\}`).exec(region);
  return m ? m[1]! : null;
};

test('(1) every scene’s arrival plays on the clock once the observer marks it — whole, parts, rows', () => {
  const r = noViewRegion();
  const whole = ruleFor(r, /:not\(\.hub-auto\) > \.hub-seq-whole\.pahina-in > \.hub-canvas-body,/);
  assert.ok(whole, 'a whole scene does not arrive');
  assert.match(whole, /animation:\s*var\(--hub-in-kf, none\) var\(--hub-duration, 1\.1s\) [^;]* both;/);
  assert.match(r, /:not\(\.hub-auto\) > \.hub-seq-parts\.pahina-in > \.hub-canvas-body > \* > \*,/, 'its parts do not arrive');
  assert.match(r, /\.hub-seq-parts\.pahina-in > \.hub-canvas-body > \* > \*:nth-child\(2\)[^{]*\{ animation-delay: calc\(var\(--hub-stagger, 0\.12s\) \* 1\); \}/, 'parts arrive together');
  assert.match(r, /\[data-hub-rows\] > \.pahina-in \{\s*animation-delay: calc\(var\(--hub-stagger, 0\.12s\) \* var\(--hub-row-at, 1\)\);/, 'rows arrive together');
  /* The drive is not asked: a scroll scene arrives on arrival there (no `.hub-tl-time` in the selectors). */
  assert.doesNotMatch(r, /hub-tl-time|hub-tl-scrub/, 'only one drive arrives without scroll timelines');
  /* …and a scene that asked for nothing is not animated. */
  assert.match(r, /\.hub-in-none\.hub-out-none > \.hub-canvas-body,[\s\S]*?\{\s*animation: none;\s*\}/);
});

test('(2) never a Build out, never a timeline — and a hero part plays its arrival alone', () => {
  const r = noViewRegion();
  assert.doesNotMatch(r, /--hub-out-kf|el-out-|animation-timeline|animation-range|view\(\)/, 'a Build out or a scroll timeline where the engine has none');
  const hero = ruleFor(r, /\[data-el-motion\]:not\(#el-own\)\s*/);
  assert.ok(hero, 'a hero part never moves without scroll timelines');
  assert.match(hero, /^\s*animation: var\(--el-anim-t, none\);\s*$/, `a hero part plays more than its arrival there: ${hero}`);
});

test('(3) the observer that marks the scenes is not gated on scroll timelines', () => {
  const src = readFileSync(join(WEB, 'app', '[slug]', '_components', 'pahina-motion.tsx'), 'utf8');
  const fn = src.slice(src.indexOf('export function PahinaMotionObserver'));
  const flag = src.slice(src.indexOf('export function PahinaMotionRootFlag'), src.indexOf('export function PahinaCoverParallax'));
  for (const s of [fn.slice(0, fn.indexOf('hio.observe(t)')), flag]) assert.doesNotMatch(s, /animation-timeline|view\(\)|ViewTimeline|ScrollTimeline/, 'the mark waits for scroll timelines');
  assert.match(fn, /t\.classList\.add\('pahina-in'\)/, 'the observer no longer marks a scene');
});

test('(4) every hero part’s arrival-only list is its In and its Drift — never an Out', () => {
  const ins = [{ fade: true }, { fade: true, move: 'below' }, { blur: true, size: 'grow' }];
  let n = 0;
  for (const i of [undefined, ...ins]) for (const during of [undefined, 'drift'] as const) for (const timeline of ['once', 'scroll'] as const) for (const out of [undefined, { fade: true }]) for (const delay of ['none', 'long'] as const) {
    const m = sanitizeHubElementMotion({ in: i, during, timeline, out, delay }) as HubElementMotion | null;
    if (!m) continue;
    const a = hubElementArrivalOnly(m) ?? '';
    assert.doesNotMatch(a, /el-out-|view\(\)/, `an Out in the arrival list: ${a}`);
    if (m.in) assert.match(a, /^\d+(?:\.\d+)?s cubic-bezier\([^)]*\) \d+(?:\.\d+)?s backwards el-in-/, `no arrival: ${JSON.stringify(m)} → ${a}`);
    else assert.doesNotMatch(a, /el-in-/);
    assert.equal(/el-during-drift/.test(a), m.during === 'drift');
    const inline = hubElementInlineStyle({ motion: m }) ?? {};
    assert.equal(inline['--el-anim-t'], a || undefined, 'the hero part does not carry its arrival list');
    n++;
  }
  assert.ok(n >= 40, `anti-vacuity ${n}`);
});
