/**
 * THE HUB MOVES, AND EVERY MOVEMENT MEANS SOMETHING (owner 2026-09-21: "make
 * the whole event hub fully animated" — build-sessions/ARRIVAL-S7-motion.md).
 *
 * What this protects:
 *  · ONE token set: the three values in lib/motion.ts are the ones globals.css
 *    declares, and every hub animation reads them.
 *  · reduced motion turns EVERY hub animation off.
 *  · only two things loop: the "happening now" dot and the music bars.
 *  · each of the movements is actually mounted where it belongs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { MOTION, arrivalSeenKey, shouldPlayArrival } from './motion';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const css = read('app/globals.css');
// Start at the block's opening `/*`, not inside its comment — a slice that
// begins mid-comment would leave the stripper reading prose as code.
const hubStart = css.lastIndexOf('/*', css.indexOf('THE EVENT HUB MOVES, AND EVERY MOVEMENT MEANS SOMETHING'));
const hub = css.slice(hubStart);

test('precondition: the hub motion block exists', () => {
  assert.ok(hubStart > 0, 'the hub motion block is missing from globals.css');
});

/** The hub block with comments removed (the ONE shared stripper), split at the reduced-motion block. */
const noComments = stripComments(hub);
const offAt = noComments.indexOf('@media (prefers-reduced-motion: reduce)');
const moving = noComments.slice(0, offAt);
const off = noComments.slice(offAt);

test('one token set: the hub reads the EXISTING tokens, and lib/motion.ts mirrors them', () => {
  assert.match(css, new RegExp(`--sn-dur-elem:\\s*${MOTION.elem};`));
  assert.match(css, new RegExp(`--sn-dur-enter:\\s*${MOTION.enter};`));
  const ease = MOTION.easeOut.replace(/[().]/g, (c) => `\\${c}`);
  assert.match(css, new RegExp(`--sn-ease-out:\\s*${ease};`));
  assert.doesNotMatch(css, /--sn-motion-/, 'a second token set has appeared');
});

test('every hub animation reads the tokens and runs `backwards`, never `both`', () => {
  const anims = [...moving.matchAll(/animation:\s*([^;]+);/g)].map((m) => m[1]!);
  assert.ok(anims.length >= 8, `precondition: found the hub animations (${anims.length})`);
  for (const a of anims) {
    assert.match(a, /var\(--sn-dur-(elem|enter)\) var\(--sn-ease-out\)/, `off-token animation: ${a}`);
    assert.match(a, /\bbackwards$/, `must run backwards: ${a}`);
    assert.doesNotMatch(a, /\bboth\b|infinite/, `holds its end state or loops: ${a}`);
  }
});

test('reduced motion switches off every animated hub selector', () => {
  const animated = [...moving.matchAll(/([^{}]+)\{\s*animation:/g)].map((m) => m[1]!.trim());
  assert.ok(animated.length >= 8, `precondition: ${animated.length} animated selectors`);
  for (const sel of animated) {
    assert.ok(off.includes(sel), `not switched off under reduced motion: ${sel}`);
  }
  assert.match(off, /animation: none;/);
});

test('the hub adds no loop: "happening now" wears the one live pulse', () => {
  const schedule = stripComments(read('app/[slug]/_components/schedule-widget.tsx'));
  assert.doesNotMatch(schedule, /animate-pulse/, 'the dot uses the sanctioned live pulse');
  assert.match(schedule, /sn-live-dot inline-block/);
  assert.match(css, /\.sn-eq-bar \{[^}]*animation: sn-eq 0\.9s var\(--sn-ease\) infinite;/);
});

test('the arrival plays once, and the script and lib agree on the key', () => {
  assert.equal(shouldPlayArrival({ reducedMotion: false, seenBefore: false }), true);
  assert.equal(shouldPlayArrival({ reducedMotion: true, seenBefore: false }), false);
  assert.equal(shouldPlayArrival({ reducedMotion: false, seenBefore: true }), false);
  assert.equal(arrivalSeenKey('/cale-ice/'), 'sn-arrived:/cale-ice');
  assert.equal(arrivalSeenKey('/'), 'sn-arrived:/');
  const script = read('app/[slug]/_components/pahina-motion.tsx');
  const fn = script.slice(script.indexOf('export function ArrivalOnce'));
  assert.match(fn, /'sn-arrived:'\+\(location\.pathname\.replace\(/, 'the script builds the same key');
  assert.match(fn, /prefers-reduced-motion: reduce/, 'and stands down for reduced motion');
  assert.match(fn, /classList\.remove\('sn-arrive'\)/, 'and never leaves the class behind');
  const shell = stripComments(read('app/[slug]/_components/invitation-shell.tsx'));
  assert.match(shell, /<ArrivalOnce \/>/, 'it is mounted on the invitation');
});

/**
 * THE EMITTED SCRIPT MUST PARSE — the defect this test exists for reads
 * identically to a working feature until a real browser tries to run it.
 *
 * `ArrivalOnce` builds its de-dupe key with `location.pathname.replace(/\/+$/,'')`
 * written INSIDE a JS template literal. A template literal treats `\/` as an
 * unrecognised escape and drops the backslash, so the text that reaches the
 * browser was `replace(//+$/,'')` — and `//` opens a line comment that eats the
 * rest of the statement, including the `var` on the next line. Every guest
 * page threw `SyntaxError: Unexpected token 'var'` on load and the "arrive
 * once" motion never ran anywhere. `assert.match` against a string pattern (the
 * test above) cannot catch this: the substring `'sn-arrived:'+(location.pathname.replace(`
 * is present either way. Only asking a JS engine to parse the emitted text can.
 *
 * This renders each script-emitting export of `pahina-motion.tsx` with
 * react-dom/server — the same runtime step a real page takes — pulls the
 * `<script>` body out of the markup, and asks `new Function` to parse it.
 * `new Function` never runs the body (there is no browser `document` here),
 * it only compiles it, which is exactly the step that threw for guests.
 */
test('the emitted scripts are valid JS, not just plausible-looking text', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const mod = await import('../app/[slug]/_components/pahina-motion');
  const components: Array<[string, () => React.ReactElement]> = [
    ['ArrivalOnce', mod.ArrivalOnce],
    ['PahinaMotionRootFlag', mod.PahinaMotionRootFlag],
    ['PahinaCoverParallax', mod.PahinaCoverParallax],
    ['PahinaMotionObserver', mod.PahinaMotionObserver],
  ];
  for (const [name, Component] of components) {
    const html = renderToStaticMarkup(React.createElement(Component));
    const scriptMatch = html.match(/<script[^>]*>([\s\S]*)<\/script>/);
    assert.ok(scriptMatch, `${name} did not render a <script> tag`);
    const scriptText = scriptMatch![1]!;
    assert.ok(scriptText.length > 0, `${name} rendered an empty script`);
    try {
      new Function(scriptText);
    } catch (err) {
      assert.fail(`${name} emitted a script that does not parse: ${(err as Error).message}\n${scriptText}`);
    }
  }
});

test('each movement is mounted where it belongs', () => {
  const mast = stripComments(read('app/[slug]/_components/pahina-masthead.tsx'));
  // The masthead returns ONE of two layouts: the invitation card (`if (card)`)
  // and the classic masthead after it. A file-wide count of 3 marks would be
  // satisfied by all three landing in one branch and none in the other, so
  // each branch is counted on its own — the branch that never runs is exactly
  // the one a regression would strip.
  const cardAt = mast.indexOf('if (card) {');
  assert.ok(cardAt > 0, 'the masthead still branches on `card`');
  const classicAt = mast.indexOf('\n  return (', cardAt);
  assert.ok(classicAt > cardAt, 'the classic masthead still follows the card branch');
  const branches: Array<[string, string]> = [
    ['card', mast.slice(cardAt, classicAt)],
    ['classic', mast.slice(classicAt)],
  ];
  for (const m of ['arrive-mark', 'arrive-names', 'arrive-date']) {
    for (const [where, branch] of branches) {
      assert.equal(
        branch.split(`data-motion="${m}"`).length - 1,
        1,
        `the ${where} masthead carries ${m} once`,
      );
    }
  }
  const action = stripComments(read('app/[slug]/_components/arrival-action.tsx'));
  assert.match(action, /data-motion="arrive-action"/);
  assert.match(action, /data-motion=\{landed \? 'label-land' : undefined\}/);
  const body = stripComments(read('app/[slug]/_components/site-body.tsx'));
  assert.match(body, /landed=\{Boolean\(rsvpFlash && rsvpFlash\.tone !== 'error'\)\}/);
  const card = body.slice(body.indexOf('const passCard'), body.indexOf('const passCard') + 600);
  assert.match(card, /id=\{PASS_ANCHOR\}/);
  assert.match(card, /data-motion="pass"/, 'the pass lifts when opened');
  const ee = stripComments(read('app/[slug]/_components/everything-else-sheet.tsx'));
  assert.match(ee, /title="Everything else"\s+rise/);
  const cam = stripComments(read('app/papic/guest/_components/papic-guest-capture.tsx'));
  assert.equal(cam.split('className="sn-rise ').length - 1, 2, 'both first-tap camera cards rise');
  const sheet = stripComments(read('app/_components/sheet.tsx'));
  assert.match(sheet, /rise = false/, 'the shared sheet only rises when asked');
});
