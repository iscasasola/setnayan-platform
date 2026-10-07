/**
 * floating-rows-are-glass.test.ts — every row that floats over scrolling
 * content is glass, and the glass stays glass.
 *
 * BUTTON_RULE_2026-10-07_fable.md § Rule 7, "the floating row is glass".
 * Owner 2026-10-07 on the Guests thumb row: "the row with search add and
 * buttons needs to blur the background with its color. not a opaque. must blur
 * the content behind" → "apply this to all glass row".
 *
 * Two halves, because either alone is a green that proves nothing:
 *   1. the ONE recipe, `.sn-glass-row` in globals.css, keeps its blur (with
 *      the -webkit- prefix Safari needs), its clip, and has NO shadow and NO
 *      gradient;
 *   2. every known floating row (anchored by its `data-glass-row` key, never a
 *      line number) wears the class — and carries no opaque `bg-*`, no
 *      `shadow-*`, no `backdrop-blur*` and no border colour of its own, each of
 *      which would override the recipe from the utilities layer.
 *
 * Adding a row: put `sn-glass-row` + `data-glass-row="<key>"` on it and add the
 * key to ROWS. Rows deliberately NOT glass (a modal footer, a row whose
 * dropdown opens out of it, the dark selection bar) are listed in the PR that
 * introduced this guard (rd/glass-row-everywhere) with their reasons.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const CSS = stripComments(read('app/globals.css'));

const E = 'app/dashboard/[eventId]';
/** key → the file that renders it. */
const ROWS: ReadonlyArray<readonly [key: string, file: string]> = [
  ['mood-board-pdfs', `${E}/studio/mood-board/_components/mood-board-editor.tsx`],
  ['control-room-tabs', `${E}/studio/panood/broadcast/control-room.tsx`],
  ['budget-save-plan', `${E}/budget/_components/budget-allocation-planner.tsx`],
  ['half-sheet-slim', `${E}/launch/_components/maker-sheet.tsx`],
  ['pay-bar', 'app/pay/[reference]/_components/pay-panel.tsx'],
  ['onboarding-nav', 'app/onboarding/[type]/_components/generic-onboarding.tsx'],
];

function ruleBody(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const all = [...CSS.matchAll(new RegExp(`(^|[\\s,}])${esc}\\s*\\{([^}]*)\\}`, 'g'))];
  assert.equal(all.length, 1, `expected exactly one ${selector} rule in globals.css, found ${all.length}`);
  return all[0]![2] ?? '';
}

/** The className of the JSX tag that carries `data-glass-row="<key>"`. */
function classOf(src: string, key: string): string {
  const marker = `data-glass-row="${key}"`;
  const at = src.indexOf(marker);
  assert.notEqual(at, -1, `the floating row "${key}" lost its data-glass-row anchor`);
  assert.equal(src.indexOf(marker, at + 1), -1, `"${key}" is anchored twice`);
  const tagStart = src.lastIndexOf('<', at);
  const tail = src.slice(tagStart);
  const m = tail.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/);
  assert.ok(m && m.index !== undefined && m.index < tail.indexOf('>', tail.indexOf(marker)), `"${key}" has no className on its own tag`);
  return m[1] ?? m[2] ?? '';
}

test('Rule 7: .sn-glass-row blurs, clips, and has no shadow or gradient', () => {
  const r = ruleBody('.sn-glass-row');
  assert.match(r, /(^|[\s;])backdrop-filter:\s*var\(--sn-glass-row-blur\)/, 'lost its backdrop-filter');
  assert.match(r, /-webkit-backdrop-filter:\s*var\(--sn-glass-row-blur\)/, 'lost the -webkit- prefix Safari needs');
  for (const m of r.matchAll(/box-shadow:\s*([^;]+)/g)) {
    assert.equal(m[1]!.trim(), 'none', `gained a box-shadow (${m[1]!.trim()}) — a shadow reads as a box (owner)`);
  }
  assert.doesNotMatch(r, /gradient\((?!white, black)/, 'gained a gradient');
  assert.doesNotMatch(r, /background-image/, 'gained a background image');
  assert.match(r, /background:\s*color-mix\(in srgb, rgb\(var\(--color-cream\)\) var\(--sn-glass-row-alpha\), transparent\)/, 'the fill is no longer translucent paper');
  assert.match(r, /border:\s*1px solid var\(--sn-glass-line\)/, 'lost its faint ink edge');
  assert.match(r, /overflow:\s*hidden/, 'the blur is no longer clipped to the row');
  assert.match(r, /isolation:\s*isolate/);
  assert.match(r, /-webkit-mask-image:\s*-webkit-radial-gradient\(white, black\)/, 'lost the Safari clip');
});

test('Rule 7 numbers: ≈62 % paper over blur(16px) saturate(1.3), light and dark', () => {
  const root = CSS.match(/--sn-glass-row-alpha:\s*([^;]+);/g) ?? [];
  assert.ok(root.length >= 2, 'the alpha needs a light AND a dark (html.dark) definition');
  for (const d of root) assert.match(d, /62%/);
  const blur = CSS.match(/--sn-glass-row-blur:\s*([^;]+);/g) ?? [];
  assert.ok(blur.length >= 2, 'the blur needs a light AND a dark definition');
  for (const d of blur) assert.match(d, /blur\(16px\) saturate\(1\.3\)/);
});

for (const [key, file] of ROWS) {
  test(`the floating row "${key}" is glass`, () => {
    const cls = classOf(read(file), key);
    const words = cls.split(/\s+/);
    assert.ok(words.includes('sn-glass-row'), `"${key}" (${file}) lacks .sn-glass-row`);
    const opaque = words.filter((w) => /^(?:[a-z-]+:)*(?:bg-(?!transparent\b)|shadow|backdrop-blur|border-(?:ink|white|black|cream|paper)\b)/.test(w));
    assert.deepEqual(opaque, [], `"${key}" carries utilities that override the glass: ${opaque.join(' ')}`);
  });
}
