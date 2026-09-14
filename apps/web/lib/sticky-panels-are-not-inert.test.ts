/**
 * TWO STICKIES WERE DECLARED AND INERT ON THE SAME PAGE, and each looked
 * exactly like "no sticky was ever written".
 *
 *   • the bulk-action bar carried `sticky top-20` inside a wrapper exactly as
 *     tall as itself — a sticky element can only slide within its PARENT's box,
 *     so with zero slack it scrolled away with the list;
 *   • the inspector rail set `overflow: hidden`, which makes it a SCROLL
 *     CONTAINER — and a sticky child cannot stick to the viewport from inside
 *     one, so `.sn-inspector-panel`'s `position: sticky` never applied.
 *
 * Both were reported by the owner as "it scrolls away", and in BOTH cases the
 * code and even the docblock said "sticky". The lesson these assertions encode:
 * a sticky declaration is not evidence of sticky behaviour — the ancestors are
 * part of the mechanism.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 🪤 STRIP COMMENTS FIRST. The fix's own explanatory comment names
// `.sn-inspector-panel` and the word `hidden`, so a matcher run over the raw
// file latches onto the PROSE instead of the rule — this guard failed on its
// own documentation before this line existed.
const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

/**
 * EVERY declaration block for a selector, not the first.
 *
 * 🪤 The first `.sn-inspector-rail` in globals.css is `{ display: none }` — the
 * mobile default — and the desktop rule that carries `overflow` is four lines
 * later inside a media query. A guard anchored on the first match asserted
 * against the wrong cell and passed/failed for reasons unrelated to the bug.
 */
function blocksFor(selector: string): string[] {
  const out: string[] = [];
  let at = css.indexOf(selector);
  while (at !== -1) {
    const open = css.indexOf('{', at);
    const close = css.indexOf('}', open);
    if (open === -1 || close === -1) break;
    out.push(css.slice(open, close));
    at = css.indexOf(selector, close);
  }
  assert.ok(out.length > 0, `${selector} is gone from globals.css`);
  return out;
}

test('the inspector panel still asks to be sticky', () => {
  const blocks = blocksFor('.sn-inspector-panel');
  assert.ok(
    blocks.some((b) => /position:\s*sticky/.test(b) && /top:\s*[\d.]/.test(b)),
    'no .sn-inspector-panel rule declares sticky WITH a top offset — a sticky with no top never pins',
  );
});

test('THE REGRESSION: the rail must not be a scroll container', () => {
  // `overflow: hidden` here silently disables the panel's sticky. `clip` clips
  // the same way during the width animation WITHOUT creating a scroll box.
  const rails = blocksFor('.sn-inspector-rail');
  for (const rail of rails) {
    assert.ok(
      !/overflow:\s*(hidden|auto|scroll)/.test(rail),
      'a scrolling overflow on .sn-inspector-rail makes the sticky inspector inert — use clip',
    );
  }
  assert.ok(
    rails.some((r) => /overflow:\s*clip/.test(r)),
    'the rail must still clip during the open animation',
  );
});

test('no ancestor of the panel re-introduces a scrolling overflow', () => {
  // The shell is the rail's parent; the same rule applies one level up.
  for (const shell of blocksFor('.sn-inspector-shell')) {
    assert.ok(
      !/overflow:\s*(hidden|auto|scroll)/.test(shell),
      'a scrolling overflow on .sn-inspector-shell would disable the sticky again',
    );
  }
});
