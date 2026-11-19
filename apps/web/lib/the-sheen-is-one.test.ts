/**
 * the-sheen-is-one.test.ts — ✨ ONE SHEEN, BY TRANSFORM, 1400 ms (motion standard 18 Nov 2026, § 4 #7 Sheen · § 3
 * rule 2 "transform and opacity only" · owner: *"shimmer ok, bounce off"*).
 *
 * Held here:
 *   1. the Sheen is ONE keyframe (`sn-sheen`), declared once, and it moves by `transform` alone;
 *   2. it loops `--sn-m-sheen` (1400 ms, `SHEEN_MS`) linear — never a raw time — on a PSEUDO-ELEMENT of the block,
 *      so the block itself never repaints; `.skeleton` and `.sn-skeleton` are the same part;
 *   3. the retired loaders stay retired: `sk-shimmer`, `sn-shimmer`, `sn-indet`, `sn-dots`, `sd-spin`;
 *   4. NO keyframe a loading part plays animates anything but transform / opacity (never `background-position`,
 *      `left`, `width`…), and none of them is filled `both`;
 *   5. reduced motion: the strip is gone and the block is a still grey;
 *   6. the top line moves by transform and opacity, on tokens.
 *
 * Seen RED once each (2026-11-18), then restored — see the changelog fragment `claude-motion-loading.md`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { SHEEN_MS } from '@/lib/motion-table';

const WEB = join(__dirname, '..');
const css = stripComments(readFileSync(join(WEB, 'app/globals.css'), 'utf8'));

/** Every `@keyframes name { … }` in the stylesheet, body included. */
function keyframes(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    let depth = 1;
    let i = m.index! + m[0].length;
    const start = i;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    out.set(m[1]!, [...(out.get(m[1]!) ?? []), css.slice(start, i - 1)]);
  }
  return out;
}

/** Every plain rule `selector { declarations }` (innermost blocks only). */
function rules(): Array<{ selector: string; body: string }> {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1]!.trim(), body: m[2]! }));
}

/** A selector that is a loading part. */
/** (The branded veil — `.sd-*` — stays as it is: the Jul 5 rule, and Phase 2 owns the button under it.) */
const LOADING_PART = /(?:^|[\s,.])\.?(?:skeleton|sn-skeleton|sn-busy-bar|loading-status-line)\b/;

const KF = keyframes();
const RULES = rules();
const props = (body: string) =>
  [...body.matchAll(/(?:^|[;{\s])([a-z-]+)\s*:/g)].map((m) => m[1]!).filter((p) => p !== 'animation-timing-function');

test('1 · the Sheen is one keyframe, and it moves by transform alone', () => {
  const sheen = KF.get('sn-sheen');
  assert.ok(sheen, '@keyframes sn-sheen is gone — the Sheen has no motion');
  assert.equal(sheen.length, 1, `@keyframes sn-sheen is declared ${sheen.length} times`);
  assert.deepEqual([...new Set(props(sheen[0]!))], ['transform'], 'the Sheen animates something other than transform');
  assert.match(sheen[0]!, /translateX\(/, 'the Sheen does not travel across the block');
});

test('2 · 1400 ms linear, on a pseudo-element, the same part for .skeleton and .sn-skeleton', () => {
  assert.equal(SHEEN_MS, 1400);
  const users = RULES.filter((r) => /animation[^;]*\bsn-sheen\b/.test(r.body));
  assert.ok(users.length >= 2, 'nothing plays the Sheen');
  for (const u of users) {
    assert.match(u.selector, /::after/, `"${u.selector}" plays the Sheen on the block itself — it must be a pseudo-element`);
    const decl = /animation\s*:\s*([^;]+)/.exec(u.body)![1]!.trim();
    assert.equal(decl, 'sn-sheen var(--sn-m-sheen) linear infinite', `"${u.selector}" plays the Sheen as "${decl}"`);
  }
  const block = users.find((u) => /\.skeleton::after/.test(u.selector));
  assert.ok(block, '.skeleton::after does not play the Sheen');
  assert.match(block.selector, /\.sn-skeleton::after/, '.sn-skeleton is no longer the same part as .skeleton');
  const strip = RULES.filter((r) => /\.skeleton::after/.test(r.selector) && /content\s*:\s*''/.test(r.body));
  assert.equal(strip.length, 1, 'the strip is drawn by more than one rule');
});

test('3 · the retired loaders stay retired', () => {
  const retired = ['sk-shimmer', 'sn-shimmer', 'sn-indet', 'sn-dots', 'sd-spin'];
  for (const name of retired) {
    assert.ok(!KF.has(name), `@keyframes ${name} is back in globals.css`);
    assert.ok(!new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(css), `${name} is still named in globals.css`);
  }
  let hits = '';
  try {
    hits = execFileSync(
      'grep',
      ['-rlE', `(^|[^A-Za-z0-9_-])(${retired.join('|')})([^A-Za-z0-9_-]|$)`, 'app', 'components', '--include=*.tsx', '--include=*.css', '--include=*.ts', '--exclude=*.test.ts', '--exclude=globals.css'],
      { cwd: WEB, encoding: 'utf8' },
    );
  } catch {
    /* grep exits 1 when nothing matches — the wanted answer */
  }
  assert.equal(hits.trim(), '', `a retired loader keyframe is used again in:\n${hits}`);
  // …and no keyframe anywhere is a shimmer by background-position under another name.
  for (const [name, bodies] of KF) {
    // `el-during-*` are the couple's own Event Hub effects (out of scope: the standard never changes a couple's choices).
    if (!/sheen|shimmer|skeleton|indet/.test(name) || name.startsWith('el-during-')) continue;
    for (const b of bodies) assert.ok(!/background-position|(?<![-\w])left\s*:/.test(b), `@keyframes ${name} sweeps by background-position / left`);
  }
});

test('4 · every keyframe a loading part plays is transform / opacity only, and none is filled `both`', () => {
  const played = new Map<string, string>();
  for (const r of RULES) {
    if (!LOADING_PART.test(r.selector)) continue;
    for (const m of r.body.matchAll(/animation\s*:\s*([^;]+)/g)) {
      const name = m[1]!.trim().split(/\s+/)[0]!;
      if (name === 'none') continue;
      played.set(name, r.selector);
      // The veil (`.sd-overlay`, Phase 2 / the Jul 5 rule) keeps its own fill; every part this phase owns is `backwards` or unfilled.
      if (/skeleton|busy/.test(r.selector)) {
        assert.ok(!/\b(both|forwards)\b/.test(m[1]!) || /gives-up/.test(r.selector), `"${r.selector}" fills its animation \`both\`/\`forwards\`: ${m[1]}`);
      }
    }
  }
  for (const must of ['sn-sheen', 'sn-load-wait']) {
    assert.ok(played.has(must), `no loading part plays ${must} — this rule would be vacuous`);
  }
  // The one spinner turn (the veil's orbits ride it) is a rotation and nothing else.
  played.set('sn-spin', 'the spinner');
  const allowed = new Set(['transform', 'opacity', 'visibility']);
  for (const [name, selector] of played) {
    const bodies = KF.get(name);
    assert.ok(bodies, `"${selector}" plays @keyframes ${name}, which is not defined`);
    for (const b of bodies) {
      const bad = props(b).filter((p) => !allowed.has(p));
      assert.deepEqual(bad, [], `@keyframes ${name} (played by "${selector}") animates ${bad.join(', ')} — transform and opacity only`);
    }
  }
});

test('5 · reduced motion: no strip — a still grey block', () => {
  const reduced = [...css.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map((m) => m[1]!);
  const off = reduced.some((b) => /\.skeleton::after\s*,\s*\.sn-skeleton::after\s*\{\s*content\s*:\s*none/.test(b));
  assert.ok(off, 'under prefers-reduced-motion the Sheen strip is still drawn (it would park as a pale band on every block)');
  const block = RULES.find((r) => /^\.skeleton\s*,\s*\.sn-skeleton$/.test(r.selector.replace(/\s+/g, ' ')));
  assert.ok(block, 'the .skeleton, .sn-skeleton rule is gone');
  assert.match(block.body, /background-color\s*:/, 'the block has no grey of its own — reduced motion would show nothing');
  assert.ok(!/background-image|background-size|background-position/.test(block.body), 'the block paints a gradient again');
});

test('6 · the top line moves by transform and opacity, on tokens', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/_components/nav-progress.tsx'), 'utf8'));
  assert.match(src, /transform: `scaleX\(\$\{scale\}\)`/, 'the line is not scaled by transform');
  assert.match(src, /transformOrigin: '0 50%'/);
  const transitions = [...src.matchAll(/'((?:transform|opacity|width|left|right)[^']*var\([^']*)'/g)].map((m) => m[1]!);
  assert.ok(transitions.length >= 2, 'the line has no transition');
  for (const t of transitions) {
    for (const part of t.split(/,\s*(?![^(]*\))/)) {
      assert.match(part.trim(), /^(transform|opacity) var\(--sn-m-quick\) var\(--sn-m-settle\)( var\(--sn-m-quick\))?$/, `the line transitions "${part.trim()}"`);
    }
  }
  assert.ok(!/\bwidth\s*:\s*`/.test(src) && !/transition[^\n]*\b(width|left)\b/.test(src), 'the line animates width / left again');
});
