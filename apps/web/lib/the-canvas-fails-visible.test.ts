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
import { stripComments } from './strip-comments';
import {
  HUB_ARRANGEMENTS,
  HUB_DIRECTIONS,
  hubCanvasVars,
  hubInKeyframe,
  hubOutKeyframe,
  HUB_DURING,
  HUB_IN,
  HUB_MOTION_PRESETS,
  HUB_OUT,
  HUB_TIMELINE,
  hubCanvasClass,
} from './hub-canvas';

const RAW = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

/**
 * 🪤 COMMENTS ARE STRIPPED BEFORE ANYTHING IS SEARCHED, and this is not
 * tidiness. The canvas block opens with a long comment that NAMES the gates it
 * is describing, so the first version of this guard found the gate 1,500
 * characters early — inside the prose about the gate — and brace-counted from
 * an opening brace that belonged to nothing. A matcher that fires on the
 * DOCUMENTATION of the fix agrees with itself forever.
 *
 * 🔑 AND IT USES THE REPO'S ONE STRIPPER, not a regex of its own. The hand-
 * rolled version this file started with is the exact defect
 * `scripts/lint-one-comment-stripper.mjs` exists to stop: strip block comments
 * with a single non-greedy regex and a LINE comment containing `video` plus a
 * slash-star opens a block that closes at the next real terminator, blanking
 * everything between — after which the guard asserts against a blank and
 * passes. Measured on this very branch, in `site-body.tsx`, where the same
 * class of mistake hid 7,500 characters of real code from a different guard.
 */
const CSS = stripComments(RAW);

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

  /* Every place an animation is BOUND — the longhand and the shorthand both.
     🪤 This counted only `animation-name:` and expected six of them, which was
     really a count of the sixteen-rule cross-product that used to live here.
     When that collapsed into one rule per timeline (driven by
     `--hub-in-kf`/`--hub-out-kf`), the guard went red for the code getting
     BETTER — and a guard that punishes an improvement teaches the next session
     to delete it. It now counts bindings of either form and asserts the
     PROPERTY: wherever they are, they are inside both gates. */
  const bindings = [...block.matchAll(/\banimation(-name)?\s*:/g)].map((m) => m.index ?? -1);
  assert.ok(bindings.length >= 3, `expected several bindings, found ${bindings.length}`);

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

/*
  🪤 THE TEST THAT STOOD HERE ASKED THE WRONG DIRECTION.

  It required a CSS rule for every class `hubCanvasClass` emits. That was right
  while each in/out choice WAS a class with its own rule. Those sixteen rules
  are gone — they were the bug (same specificity, later one wins, two of
  Cinematic's three choices silently dropped) — and the choice now travels as
  `--hub-in-kf` / `--hub-out-kf`. The state classes remain as an honest
  description of what a section is doing, and a description does not owe anyone
  a rule.

  What DOES matter is asked by the two tests below, in both directions: every
  VAR the contract emits must be read by a rule (a var nothing consumes is a
  dead setting), and no rule may branch on a class the contract cannot emit (a
  selector that can never match is dead CSS that reads as a feature).
*/

test('⛔ a section that asked for nothing carries no animation at all', () => {
  // "Still" must not leave a fill-mode behind that could pin a state.
  // 🪤 The selector grew a second arm when the parts learned to animate: the
  // all-off rule must silence BOTH levels, or a section set to Still would
  // still have its parts arriving one by one. Anchored on the declaration and
  // on both arms, not on the exact text of one selector.
  const block = canvasBlock();
  const m = /\.hub-in-none\.hub-out-none[^{]*\{([^}]*)\}/.exec(block);
  assert.ok(m, 'the all-off rule exists');
  assert.match(m[1] ?? '', /animation:\s*none/, 'it turns the animation off');
  assert.match(m[1] ?? '', /will-change:\s*auto/, 'and drops the layer hint');
  const selector = block.slice(block.indexOf('.hub-in-none'), block.indexOf('{', block.indexOf('.hub-in-none')));
  assert.match(selector, /\.hub-canvas-body\s*,/, 'the block level is silenced');
  assert.match(selector, /\.hub-canvas-body\s*>\s*\*\s*>\s*\*/, 'and so are the parts');
});

test('⛔ THE ANIMATED LAYER MUST GENERATE A BOX — never `display: contents`', () => {
  /*
    🔴 MEASURED ON THIS BRANCH. When the motion moved off the frame and onto
    `.hub-canvas-body`, the no-media rule still read `display: contents` — and a
    `contents` box is not generated at all, so it CANNOT BE ANIMATED. Every
    section without a background photo would have silently lost its arrival and
    its handoff. The markup was right, the classes were right, the vars were
    right, and nothing moved.

    A sabotage that put `contents` back left every other guard in this file
    green, which is why this one exists.
  */
  const bodies = [...CSS.matchAll(/\.hub-canvas-body\s*\{([^}]*)\}/g)].map((m) => m[1] ?? '');
  assert.ok(bodies.length > 0, 'precondition: the body layer is styled');
  for (const body of bodies) {
    assert.doesNotMatch(
      body,
      /display\s*:\s*contents/,
      'the layer that carries the animation must generate a box',
    );
  }
  // And the same for the media layer, which carries the drift.
  for (const m of [...CSS.matchAll(/\.hub-canvas-media\s*\{([^}]*)\}/g)]) {
    assert.doesNotMatch(m[1] ?? '', /display\s*:\s*(contents|none)/);
  }
});

test('⛔ every custom property the contract EMITS is read by a rule', () => {
  /*
    🔑 THE GUARD THE FIRST VERSION WAS MISSING, and it would have caught two.
    `--hub-duration` and `--hub-stagger` were emitted on every arranged section
    and read by NOTHING: two values from the preset that looked like settings
    and moved no pixels. That is the same defect as a dead control, one layer
    down, and invisible from the dashboard because the markup looked right.

    A var that nothing consumes is either a bug or a promise; both must be
    resolved before it ships, not after.
  */
  const emitted = new Set<string>();
  for (const preset of HUB_MOTION_PRESETS) {
    for (const url of [null, 'https://example.test/a.jpg']) {
      for (const k of Object.keys(hubCanvasVars({ preset, focal: 3, zoom: 120 }, url))) {
        emitted.add(k);
      }
    }
  }
  assert.ok(emitted.size >= 5, `precondition: the contract emits several vars (${emitted.size})`);
  const unread = [...emitted].filter((v) => !CSS.includes(`var(${v}`));
  assert.deepEqual(unread, [], `emitted and read by no rule: ${unread.join(', ')}`);
});

test('⛔ no rule branches on a class the contract can never emit', () => {
  // The other direction: a selector for a class nothing produces is a rule
  // that can never match — dead CSS that reads as a feature.
  const emitted = new Set<string>();
  for (const preset of HUB_MOTION_PRESETS) {
    for (const arrangement of HUB_ARRANGEMENTS) {
      for (const hasMedia of [true, false]) {
        for (const c of hubCanvasClass({ preset, arrangement }, hasMedia).split(' ')) emitted.add(c);
      }
    }
  }
  emitted.add('hub-canvas-media');
  emitted.add('hub-canvas-body');
  // The photo-BESIDE layers (left / right, Build 4). That the frame really
  // renders them — and only for those two — is asserted by rendering it in
  // `a-section-of-your-own-is-pro-and-laid-out.test.ts`, not by this list.
  emitted.add('hub-canvas-photo');
  emitted.add('hub-canvas-photo-img');
  for (const v of HUB_IN) emitted.add(`hub-in-${v}`);
  for (const v of HUB_OUT) emitted.add(`hub-out-${v}`);
  for (const v of HUB_DURING) emitted.add(`hub-during-${v}`);
  for (const v of HUB_TIMELINE) emitted.add(`hub-tl-${v}`);

  const used = new Set([...canvasBlock().matchAll(/\.(hub-[a-z0-9-]+)/g)].map((m) => m[1] as string));
  const orphanRules = [...used].filter((c) => !emitted.has(c));
  assert.deepEqual(orphanRules, [], `styled but never emitted: ${orphanRules.join(', ')}`);
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

test('⛔ EVERY keyframe the contract can COMPOSE exists in the stylesheet', () => {
  /*
    🔴 THE FAILURE THIS EXISTS FOR IS TOTAL SILENCE. `--hub-in-kf` carries a
    keyframe NAME composed from two axes — the effect and the direction. If the
    composition can produce a name `globals.css` does not declare, the browser
    resolves `animation-name: hub-in-move-below` to nothing: no error, no
    warning, no console line. The section simply does not move, and the editor
    still shows the couple's choice as saved.

    A rule per pair would have made this impossible and caused a worse bug
    instead (same specificity, later one wins, two of Cinematic's three choices
    silently dropped). So the composition stays, and this walks EVERY
    combination it can produce.
  */
  const declared = new Set(
    [...CSS.matchAll(/@keyframes\s+([a-z0-9-]+)/g)].map((m) => m[1] as string),
  );
  assert.ok(declared.size >= 10, `precondition: the stylesheet declares keyframes (${declared.size})`);

  const missing: string[] = [];
  let checked = 0;
  for (const i of HUB_IN) {
    for (const d of HUB_DIRECTIONS) {
      const name = hubInKeyframe({ in: i, inFrom: d });
      checked += 1;
      if (name !== 'none' && !declared.has(name)) missing.push(`in ${i}/${d} → ${name}`);
    }
  }
  for (const o of HUB_OUT) {
    for (const d of HUB_DIRECTIONS) {
      const name = hubOutKeyframe({ out: o, outTo: d });
      checked += 1;
      if (name !== 'none' && !declared.has(name)) missing.push(`out ${o}/${d} → ${name}`);
    }
  }
  assert.ok(checked >= 30, `anti-vacuity: every combination was walked (${checked})`);
  assert.deepEqual(missing, [], `composed but never declared — these animate NOTHING, silently:\n${missing.join('\n')}`);
});

test('⛔ "move" never touches opacity — that is the whole point of the pair', () => {
  // Owner: "move and fade out OR JUST MOVE OUT". If the move-only keyframes
  // faded too, the second half of that sentence would be unreachable while
  // every control still looked right.
  /*
    🪤 BRACE-COUNTED, NOT `\n}`-TERMINATED. The first version matched a keyframe
    body up to a closing brace ON ITS OWN LINE — and these are written on one
    line each, so it matched none of them and the count assertion was the only
    thing that noticed. A parser that silently finds nothing makes every
    per-body assertion below vacuously true.
  */
  const bodies = new Map<string, string>();
  for (const m of CSS.matchAll(/@keyframes\s+([a-z0-9-]+)\s*\{/g)) {
    const open = (m.index ?? 0) + m[0].length - 1;
    let depth = 0;
    for (let i = open; i < CSS.length; i += 1) {
      if (CSS[i] === '{') depth += 1;
      else if (CSS[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          bodies.set(m[1] as string, CSS.slice(open + 1, i));
          break;
        }
      }
    }
  }
  assert.ok(bodies.size >= 10, `precondition: keyframe bodies were parsed (${bodies.size})`);
  let moveOnly = 0;
  for (const [name, body] of bodies) {
    if (!/^hub-(in|out)-move-/.test(name)) continue;
    moveOnly += 1;
    assert.doesNotMatch(body, /opacity/, `${name} fades — "just move" must not`);
    assert.match(body, /translate3d/, `${name} must actually travel`);
  }
  assert.equal(moveOnly, 8, 'four directions in, four out');
  // And the paired fade variants DO fade, or the pair is one thing twice.
  let moveFade = 0;
  for (const [name, body] of bodies) {
    if (!/^hub-(in|out)-movefade-/.test(name)) continue;
    moveFade += 1;
    assert.match(body, /opacity/, `${name} must fade`);
    assert.match(body, /translate3d/, `${name} must also travel`);
  }
  assert.equal(moveFade, 8);
});

test('⛔ each direction genuinely goes a different way', () => {
  // Four names that all translate the same way would be four controls doing
  // one thing — and the couple would never know which they had chosen.
  const offsets = new Map<string, string>();
  for (const m of CSS.matchAll(/@keyframes\s+hub-in-move-([a-z]+)\s*\{[^}]*translate3d\(([^)]*)\)/g)) {
    offsets.set(m[1] as string, (m[2] as string).replace(/\s+/g, ''));
  }
  assert.equal(offsets.size, 4, 'all four directions are declared');
  assert.equal(new Set(offsets.values()).size, 4, 'and no two of them travel the same way');
  assert.match(offsets.get('below') ?? '', /^0,\d/, 'below starts lower down');
  assert.match(offsets.get('above') ?? '', /^0,-/, 'above starts higher up');
  assert.match(offsets.get('left') ?? '', /^-/, 'left starts to the left');
  assert.match(offsets.get('right') ?? '', /^\d/, 'right starts to the right');
});
