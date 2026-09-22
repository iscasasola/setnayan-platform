/**
 * the-canvas-fails-visible.test.ts — A SECTION CAN NEVER GET STUCK INVISIBLE.
 *
 * The Event Hub canvas animates with `animation-timeline`, which means the
 * browser, not a script, decides whether anything moves. That is the point —
 * no JavaScript crosses to the guest page — and it is also the risk: a rule
 * that sets `opacity: 0` and then relies on an animation to bring it back
 * leaves the section BLANK on any browser that does not run the animation.
 *
 * A guest's wedding page rendering empty is the worst failure this product has,
 * and it renders identically to "the couple wrote nothing". So the property is
 * structural rather than stylistic:
 *
 *   🔒 EVERY rule that can hide a `.hub-` element lives inside BOTH
 *      `@supports (animation-timeline: view())` AND
 *      `@media (prefers-reduced-motion: no-preference)`.
 *
 * A keyframe that *contains* `opacity: 0` is fine and is deliberately allowed
 * outside: a keyframe binds to nothing on its own. It is the `animation-name`
 * that hides, so that is what this counts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HUB_ARRANGEMENTS,
  HUB_DURING,
  HUB_IN,
  HUB_MOTION_PRESETS,
  HUB_OUT,
  HUB_TIMELINE,
  hubCanvasClass,
} from './hub-canvas';

const RAW = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

/**
 * \ud83e\udea4 COMMENTS ARE STRIPPED BEFORE ANYTHING IS SEARCHED, and this is not
 * tidiness. The canvas block opens with a long comment that NAMES the gates it
 * is describing \u2014 "`@supports (animation-timeline: view())` and
 * `@media (prefers-reduced-motion: no-preference)`" \u2014 so the first version of
 * this guard found the gate 1,500 characters early, inside the prose about the
 * gate, and brace-counted from a `{` that belonged to nothing. A matcher that
 * fires on the DOCUMENTATION of the fix agrees with itself forever.
 */
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, '');

/** The canvas block, from its first rule to the end of the file. */
function canvasBlock(): string {
  const at = CSS.indexOf('.hub-canvas');
  assert.ok(at > 0, 'the canvas block must exist in globals.css');
  assert.ok(RAW.includes('THE EVENT HUB CANVAS'), 'and it must still carry its banner comment');
  return CSS.slice(at);
}

/**
 * The region inside `@supports (animation-timeline: view())` →
 * `@media (prefers-reduced-motion: no-preference)`, found by BRACE COUNTING
 * rather than by the next `}` — a guard window that stops at the first brace
 * would end inside the first rule and call everything after it "outside",
 * which is the mistake that makes a source guard agree with itself.
 */
function guardedRegion(): string {
  const block = canvasBlock();
  const at = block.indexOf('@supports (animation-timeline: view())');
  assert.ok(at > 0, 'the @supports gate must exist');
  const open = block.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < block.length; i += 1) {
    if (block[i] === '{') depth += 1;
    else if (block[i] === '}') {
      depth -= 1;
      if (depth === 0) return block.slice(open, i);
    }
  }
  assert.fail('the @supports block never closes');
}

test('🔒 every animation binding on a .hub- selector is inside BOTH gates', () => {
  const block = canvasBlock();
  const guarded = guardedRegion();
  assert.match(guarded, /prefers-reduced-motion:\s*no-preference/, 'the second gate is inside the first');

  // Each `animation-name:` in the canvas block, with the selector it belongs to.
  const bindings = [...block.matchAll(/animation-name\s*:/g)].map((m) => m.index ?? -1);
  assert.ok(bindings.length >= 6, `expected several bindings, found ${bindings.length}`);

  const guardedStart = block.indexOf(guarded);
  const guardedEnd = guardedStart + guarded.length;
  for (const at of bindings) {
    assert.ok(
      at > guardedStart && at < guardedEnd,
      `an animation-name at offset ${at} sits OUTSIDE the @supports + reduced-motion gates — ` +
        'a browser without scroll-driven animations would render that section blank',
    );
  }
});

test('🔒 nothing outside the gates sets opacity or a transform on a .hub- rule', () => {
  const block = canvasBlock();
  const guarded = guardedRegion();
  const outside = block.replace(guarded, '');
  // Keyframes are allowed out here: they bind to nothing by themselves, and
  // their names are `hub-in-*` / `hub-out-*` which would otherwise read as
  // `.hub-` selectors to the regexes below.
  const withoutKeyframes = outside.replace(/@keyframes[\s\S]*?\n}/g, '');
  assert.doesNotMatch(
    withoutKeyframes,
    /\.hub-[^{]*\{[^}]*opacity\s*:\s*0/,
    'an ungated rule hides a section',
  );
  assert.doesNotMatch(
    withoutKeyframes,
    /\.hub-[^{]*\{[^}]*visibility\s*:\s*hidden/,
    'same, the other way of disappearing',
  );
});

test('⭐ every class the contract can emit has a rule — no orphan choices', () => {
  const block = canvasBlock();
  // A control that stores a value and moves no pixels is the defect this whole
  // build exists to remove. If the contract can emit a class, the CSS must know it.
  const emitted = new Set<string>();
  for (const preset of HUB_MOTION_PRESETS) {
    for (const arr of HUB_ARRANGEMENTS) {
      for (const cls of hubCanvasClass({ preset, arrangement: arr }).split(' ')) emitted.add(cls);
    }
  }
  for (const v of HUB_IN) emitted.add(`hub-in-${v}`);
  for (const v of HUB_OUT) emitted.add(`hub-out-${v}`);
  for (const v of HUB_DURING) emitted.add(`hub-during-${v}`);
  for (const v of HUB_TIMELINE) emitted.add(`hub-tl-${v}`);

  const missing = [...emitted].filter((c) => !block.includes(`.${c}`));
  // The ones that are KNOWINGLY not drawn yet, each named in the CSS comment
  // with the reason: left/right need two slots a widget does not expose.
  const declaredUnbuilt = ['hub-arr-left', 'hub-arr-right'];
  assert.ok(declaredUnbuilt.length > 0);
  assert.match(
    RAW,
    /LEFT \/ RIGHT arrangements/,
    'an unbuilt arrangement must be named in the CSS as unbuilt, not silently absent',
  );
  const unexplained = missing.filter((c) => !declaredUnbuilt.includes(c));
  assert.deepEqual(unexplained, [], 'every other class the contract emits is drawn');
});

test('⛔ a section that asked for nothing carries no animation at all', () => {
  // "Still" must not leave a fill-mode behind that could pin a state.
  assert.match(
    canvasBlock(),
    /\.hub-in-none\.hub-out-none\.hub-during-still\s*\{[^}]*animation-name:\s*none/,
    'the all-off combination turns the animation off by name',
  );
});

/*
  🪤 THE GUARD THAT USED TO SIT HERE MOVED, AND WAS NOT DELETED.

  It read `hideable-widget-render.tsx` for the null check and the
  "arranged nothing" check, by source. Both then moved into the shared
  `hub-canvas-frame.tsx` — because there turned out to be TWO dispatchers and
  the wrapper had only ever been written into one of them, so an anonymous
  visitor on an open-browse event saw the page unarranged.

  Its property now lives in `every-dispatcher-frames-the-canvas.test.ts`, which
  is strictly stronger in two ways: it RENDERS the frame instead of grepping for
  it, and it finds dispatchers by what they DO rather than by naming two files,
  so a third door added later cannot skip the frame quietly.

  A red guard can mean the design moved. Re-anchor it; never delete it to go
  green, and never leave two copies to drift.
*/
