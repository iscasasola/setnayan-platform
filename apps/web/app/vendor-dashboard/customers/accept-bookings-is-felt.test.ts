/**
 * 🎉 ACCEPT BOOKINGS IS FELT (Build 2 row #29, owner: *"turning off a date did not cross out the date… the date
 * crushing… a celebratory when it is going to turn on"* — prototype v118 `dayMark`, `@keyframes dcrush / dcheer`).
 *
 * Flipping the day bar's switch strikes / un-strikes the day's cell AT ONCE (month + week strip, in the picked fill
 * too) from what the switch shows — not when the re-read lands — then moves it: off = a squash with the strike drawing
 * in (620 ms), on = a pop (700 ms) + 12 confetti from each visible cell (820 ms). Reduced motion: the strike still
 * changes at once; nothing moves, nothing is thrown. A refused write drops the overlay (no motion).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DAY_FEEL, feelDay } from '@/app/_components/calendar-day-box';

const HERE = dirname(fileURLToPath(import.meta.url));
const CAL = readFileSync(join(HERE, '_components', 'customers-calendar.tsx'), 'utf8');
const SWITCH = readFileSync(join(HERE, '_components', 'day-open-switch.tsx'), 'utf8');
const BAR = readFileSync(join(HERE, '_components', 'day-bar.tsx'), 'utf8');

type Anim = { frames: Keyframe[]; opts: KeyframeAnimationOptions };
/** A stand-in for the DOM: one visible day mark, and a body that collects confetti. */
function stage(reduce: boolean) {
  const g = globalThis as unknown as Record<string, unknown>;
  const thrown: Anim[] = [];
  const box = {
    anims: [] as Anim[],
    animate(frames: Keyframe[], opts: KeyframeAnimationOptions) {
      this.anims.push({ frames, opts });
      return {};
    },
    getBoundingClientRect: () => ({ left: 100, top: 200, width: 30, height: 30, bottom: 230 }),
    closest: () => null,
  };
  g.window = { matchMedia: () => ({ matches: reduce }), innerHeight: 812 };
  g.getComputedStyle = () => ({ opacity: '1' });
  g.document = {
    createElement: () => ({
      dataset: {} as Record<string, string>,
      style: {},
      setAttribute() {},
      remove() {},
      animate(frames: Keyframe[], opts: KeyframeAnimationOptions) {
        thrown.push({ frames, opts });
        return {};
      },
    }),
    body: { appendChild() {} },
  };
  return { box, thrown, done: () => ['window', 'getComputedStyle', 'document'].forEach((k) => delete g[k]) };
}

test('the motion is the prototype’s: squash 620 ms, pop 700 ms, 12 confetti over 820 ms', () => {
  assert.deepEqual(
    { crush: DAY_FEEL.crushMs, cheer: DAY_FEEL.cheerMs, confetti: DAY_FEEL.confettiMs, pieces: DAY_FEEL.pieces },
    { crush: 620, cheer: 700, confetti: 820, pieces: 12 },
  );
});

test('off: the mark squashes while the strike draws in — and nothing is thrown', () => {
  const s = stage(false);
  try {
    assert.equal(feelDay([s.box as unknown as HTMLElement], true), 0);
    assert.equal(s.box.anims.length, 1);
    const [a] = s.box.anims;
    assert.equal(a!.opts.duration, 620);
    assert.equal(a!.frames[0]!.textDecorationColor, 'transparent', 'the strike does not draw in');
    assert.equal(a!.frames.at(-1)!.textDecorationColor, 'currentColor');
    assert.ok(a!.frames.some((f) => f.transform === 'scale(1.18,.55)'), 'not the squash');
    assert.equal(s.thrown.length, 0);
  } finally {
    s.done();
  }
});

test('on: the mark pops and 12 confetti burst from the cell', () => {
  const s = stage(false);
  try {
    assert.equal(feelDay([s.box as unknown as HTMLElement], false), 12);
    assert.equal(s.box.anims[0]!.opts.duration, 700);
    assert.ok(s.box.anims[0]!.frames.some((f) => String(f.transform).includes('scale(1.3)')), 'not the pop');
    assert.equal(s.thrown.length, 12);
    assert.ok(s.thrown.every((t) => t.opts.duration === 820 && t.frames.at(-1)!.opacity === 0), 'a confetti piece does not fade out');
  } finally {
    s.done();
  }
});

test('reduced motion: nothing moves, nothing is thrown', () => {
  const s = stage(true);
  try {
    assert.equal(feelDay([s.box as unknown as HTMLElement], false), 0);
    assert.equal(feelDay([s.box as unknown as HTMLElement], true), 0);
    assert.equal(s.box.anims.length + s.thrown.length, 0);
  } finally {
    s.done();
  }
});

test('the cell is struck AT ONCE from the switch, and a refusal or a re-read drops it', () => {
  // The switch tells only a person's flip and a refusal — never a re-read or a change of day.
  assert.match(SWITCH, /setOn\(next\);\s*setProblem\(null\);\s*onFlip\?\.\(day, next, 'flip'\);/);
  assert.match(SWITCH, /setOn\(!next\);\s*onFlip\?\.\(day, !next, 'refused'\);/);
  assert.doesNotMatch(SWITCH.slice(SWITCH.indexOf('useEffect(() => {'), SWITCH.indexOf('if (day < today)')), /onFlip/, 'a re-read is felt');
  assert.match(BAR, /onOpen=\{setOpen\} onFlip=\{onFlip\} \/>/);
  assert.match(CAL, /<DayBar day=\{picked\} today=\{todayIso\} blocks=\{blocks\} actions=\{dayActions\} onFlip=\{onFlip\} \/>/);
  // The overlay feeds the ONE `states` both the month and the week strip draw from.
  assert.match(CAL, /for \(const \[d, open\] of flipped\) out\.set\(d, \{ \.\.\.\(out\.get\(d\) \?\? \{\}\), blocked: !open \}\);/);
  assert.match(CAL, /states=\{states\}/);
  assert.match(CAL, /const st = inMonth \? states\.get\(d\) : undefined;/);
  assert.match(CAL, /useEffect\(\(\) => setFlipped\(\(f\) => \(f\.size \? new Map\(\) : f\)\), \[blocks\]\);/, 'the overlay outlives the re-read');
  assert.match(CAL, /if \(how === 'flip'\) next\.set\(day, open\);\s*else next\.delete\(day\);/);
  // Moved after the commit (the strike is on the cell first), only on a flip, only this calendar's marks.
  assert.match(CAL, /feel\.current = how === 'flip' \? \{ day, off: !open \} : null;/);
  assert.match(CAL, /rootRef\.current\.querySelectorAll<HTMLElement>\(\s*`\[data-calendar-day="\$\{f\.day\}"\] \[data-calendar-dn\], \[data-dates-week-day="\$\{f\.day\}"\] \[data-calendar-dn\]`/);
});
