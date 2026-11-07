/**
 * 🔒 A BOX'S HINT CYCLES ITS EXAMPLES — only while empty and unfocused, still under reduced motion, never a render
 * (owner 2026-11-01). Drives `startHintCycle` with a hand-cranked timer, then pins that the shared fields use it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HINT_EVERY_MS, startHintCycle, type HintTarget } from './rotating-hint';

function crank() {
  let tick: (() => void) | null = null;
  let ms = 0;
  let stopped = false;
  return {
    every: (fn: () => void, every: number) => {
      tick = fn;
      ms = every;
      return () => {
        stopped = true;
      };
    },
    step: () => tick?.(),
    get ms() {
      return ms;
    },
    get stopped() {
      return stopped;
    },
  };
}

test('the empty box steps from its name through each example, every ~3 s, and round again', () => {
  const el: HintTarget = { value: '', placeholder: 'Search guests' };
  const t = crank();
  startHintCycle(el, 'Search guests', ['e.g. A', 'e.g. B'], { reduced: false, focused: () => false, every: t.every });
  assert.equal(t.ms, HINT_EVERY_MS);
  assert.ok(HINT_EVERY_MS >= 2500 && HINT_EVERY_MS <= 4000, 'about every three seconds');
  const seen = [el.placeholder];
  for (let i = 0; i < 4; i++) {
    t.step();
    seen.push(el.placeholder);
  }
  assert.deepEqual(seen, ['Search guests', 'e.g. A', 'e.g. B', 'Search guests', 'e.g. A']);
});

test('a typed word or a focused box freezes the hint where it is', () => {
  const el: HintTarget = { value: '', placeholder: 'Search guests' };
  let focused = false;
  const t = crank();
  startHintCycle(el, 'Search guests', ['e.g. A', 'e.g. B'], { reduced: false, focused: () => focused, every: t.every });
  t.step();
  assert.equal(el.placeholder, 'e.g. A');
  focused = true;
  t.step();
  t.step();
  assert.equal(el.placeholder, 'e.g. A', 'it moved while the box was focused');
  focused = false;
  el.value = 'Ana';
  t.step();
  assert.equal(el.placeholder, 'e.g. A', 'it moved while the box held words');
  el.value = '';
  t.step();
  assert.equal(el.placeholder, 'e.g. B', 'it did not resume once the box was empty and left');
});

test('reduced motion: ONE still example, no timer at all', () => {
  const el: HintTarget = { value: '', placeholder: 'Search guests' };
  const t = crank();
  startHintCycle(el, 'Search guests', ['e.g. A', 'e.g. B'], { reduced: true, focused: () => false, every: t.every });
  assert.equal(el.placeholder, 'e.g. A');
  assert.equal(t.ms, 0, 'a timer was started under reduced motion');
});

test('stopping puts the box’s own name back and stops the timer; no examples = nothing happens', () => {
  const el: HintTarget = { value: '', placeholder: 'Search guests' };
  const t = crank();
  const stop = startHintCycle(el, 'Search guests', ['e.g. A'], { reduced: false, focused: () => false, every: t.every });
  t.step();
  stop();
  assert.equal(el.placeholder, 'Search guests');
  assert.ok(t.stopped);
  const t2 = crank();
  startHintCycle(el, 'Search guests', [], { reduced: false, focused: () => false, every: t2.every });
  assert.equal(t2.ms, 0);
});

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

test('the hook never re-renders: no React state, only the input’s placeholder', () => {
  const hook = src('lib/use-rotating-hint.ts');
  assert.match(hook, /startHintCycle\(el,/, 'the hook does not drive the shared cycle on the input');
  assert.doesNotMatch(hook, /\buse(State|Reducer|SyncExternalStore)\b|\bsetState\b/, 'a hint step would re-render');
});

test('the shared fields use it: the thumb row’s field and the Guests add box', () => {
  assert.match(src('components/thumb-row.tsx'), /useRotatingHint\(ownInput,[^;]*field\.hints/, 'the thumb row field does not cycle its hints');
  assert.match(src('app/dashboard/[eventId]/guests/_components/capture-bar.tsx'), /useRotatingHint\(inputRef, placeholder, hints\)/, 'the add box does not cycle its hints');
  const screen = src('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /hints: writesOff \? undefined : hintLines/, 'the Guests search box is not given its examples');
  assert.match(screen, /quickAddTips\(\{[^}]*groupNames: groups\.map/, 'the Guests examples do not come from this event’s groups');
  assert.match(src('app/dashboard/[eventId]/guests/_components/add-guest-sheet.tsx'), /hints=\{tips\?\.examples/, 'the add sheet’s box is not given its examples');
});
