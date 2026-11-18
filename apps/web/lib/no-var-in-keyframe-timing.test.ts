/**
 * no-var-in-keyframe-timing.test.ts — 🎞 NEVER `var()` IN A KEYFRAME'S TIMING FUNCTION (motion standard house rule § 3.7,
 * specs `MOTION_STANDARD_2026-11-18.md`; owner 18 Nov 2026).
 *
 * Measured 18 Nov: inside a `@keyframes` block, `animation-timing-function: var(--x)` is ignored by Chrome and the
 * animation runs LINEAR — every easing in the standard's prototype ran linear until v6, and nothing looked broken
 * enough to notice. The token belongs on the element's `animation` / `transition` shorthand instead (or the curve is
 * written literally in the keyframe).
 *
 * Scans every `.css` (including `.module.css`) under `apps/web/app`, comments stripped with the repo's ONE stripper
 * (`lib/strip-comments.ts`), for `animation-timing-function: var(` inside a `@keyframes` block (braces counted, so a
 * nested frame selector is inside its block and a rule after the block is not).
 *
 * Seen RED (2026-11-18), then restored: `@keyframes sn-row-step { from { opacity: 0; animation-timing-function:
 * var(--sn-m-settle); … } }` in globals.css. The premise check below also fails if the scan finds no keyframes at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.css')) out.push(p);
  }
  return out;
}

/** Each `@keyframes` block's body (between its own braces). */
function keyframeBlocks(css: string): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = [];
  const re = /@(?:-webkit-)?keyframes\s+([^\s{]+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    out.push({ name: m[1]!, body: css.slice(re.lastIndex, i - 1) });
    re.lastIndex = i;
  }
  return out;
}

const VAR_IN_TIMING = /animation-timing-function\s*:\s*[^;}]*var\(/;

test('the scanner catches the trap (premise)', () => {
  const bad = '@keyframes a { from { opacity: 0; animation-timing-function: var(--sn-m-settle); } to { opacity: 1 } } .x { animation-timing-function: var(--ok); }';
  const blocks = keyframeBlocks(bad);
  assert.equal(blocks.length, 1);
  assert.match(blocks[0]!.body, VAR_IN_TIMING);
  assert.doesNotMatch(keyframeBlocks('@keyframes b { to { opacity: 1 } } .y { animation-timing-function: var(--ok); }')[0]!.body, VAR_IN_TIMING, 'a rule after the block is read as inside it');
});

test('no @keyframes block under app/ puts var() in its animation-timing-function', () => {
  const files = walk(join(WEB, 'app'));
  assert.ok(files.length > 10, `the walk found only ${files.length} stylesheets — the scan is not looking`);
  let blocks = 0;
  const offenders: string[] = [];
  for (const abs of files) {
    const css = stripComments(readFileSync(abs, 'utf8'));
    for (const k of keyframeBlocks(css)) {
      blocks++;
      if (VAR_IN_TIMING.test(k.body)) offenders.push(`${relative(WEB, abs)} @keyframes ${k.name}`);
    }
  }
  assert.ok(blocks > 100, `only ${blocks} @keyframes blocks found — the scan is not looking`);
  assert.deepEqual(offenders, [], 'var() inside a keyframe’s timing function runs LINEAR in Chrome — put the token on the element’s animation shorthand');
});
