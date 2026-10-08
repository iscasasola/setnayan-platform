/**
 * ✨ THE MAIN BACKGROUND KEEPS ITS EFFECT — ON EVERY SHAPE.
 *
 * Owner, 2026-10-08 (DECISION_LOG "LOOK EFFECTS ROUND 4" · "LOOK ROUNDS 4–5"; contract
 * `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 3): an effect lies on top of the background, whatever the
 * background is, and is stored on it — `config_json.main.effect = { kind, intensity, colour? }`.
 *
 * 🪤 WHY THIS FILE EXISTS: `sanitizeHubMainGround` is the ONE reader of that key, and it builds each shape field by
 * field — so before this, an effect written on any shape was silently DROPPED on the next read (and `{ ground:
 * 'none' }`, a plain colour, was returned as a fresh two-key object). A couple would have picked Sparkles, seen it
 * on the sample, pressed Apply, and guests would have seen nothing.
 *
 * WHAT IS TESTED: the sanitiser itself, run over every shape — with an effect (kept, exactly), without one (the
 * shape reads byte for byte as it always did), and with a broken one (dropped, the background untouched).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HUB_MAIN_EFFECTS,
  HUB_MAIN_EFFECT_COLOURS,
  HUB_MAIN_EFFECT_INTENSITIES,
  hubMainEffect,
  hubMainGround,
  hubMovingBackgroundIds,
  sanitizeHubMainEffect,
  sanitizeHubMainGround,
  type HubMainEffect,
} from './hub-canvas';
import { MAIN_SLOT } from './site-palette';
import { fadeMain } from './background-fade';

const REF = 'r2://setnayan-media/events/EV/hero/a.jpg';
const POSTER = 'r2://setnayan-media/events/EV/hero/a-still.jpg';
const TINT = { match: true, frame: ['#112233', '#445566'] };
const LOOP = hubMovingBackgroundIds()[0]!;

/** Every shape a main background can be stored as — each as the app writes it, with the extras it may carry. */
const SHAPES: Record<string, Record<string, unknown>> = {
  'the cover photo (a follow)': { follow: 'hero', of: REF, tint: TINT, shade: 'dark', blur: 'soft', focus: 'top' },
  'the page’s own background': { ground: 'theme' },
  'a plain colour': { ground: 'none' },
  'a pattern': { ground: 'pattern', pattern: 'dots' },
  'a video of ours': { ground: 'loop', loop: LOOP, shade: -40, blur: 'strong' },
  'their photo': { kind: 'photo', media: REF, tint: TINT, motion: 'parallax', shade: 30, focus: 'bottom' },
  'their clip': { kind: 'snippet', media: REF, poster: POSTER, tint: TINT, blur: 'soft' },
};

const EFFECTS: HubMainEffect[] = HUB_MAIN_EFFECTS.flatMap((kind) =>
  HUB_MAIN_EFFECT_INTENSITIES.flatMap((intensity) => [{ kind, intensity }, ...HUB_MAIN_EFFECT_COLOURS.map((colour) => ({ kind, intensity, colour }))]),
);

test('every shape keeps an effect — the kind, how much and the colour, exactly', () => {
  assert.equal(EFFECTS.length, 6 * 3 * 6, 'six effects × three amounts × (Original + the five)');
  for (const [name, shape] of Object.entries(SHAPES)) {
    for (const effect of EFFECTS) {
      const read = sanitizeHubMainGround({ ...shape, effect });
      assert.ok(read, `${name}: not read at all with an effect on it`);
      assert.deepEqual(hubMainEffect(read), effect, `${name}: the effect was dropped or changed — ${JSON.stringify(effect)}`);
      // …and the background under it is the one stored, to the key.
      const { effect: _fx, ...under } = read as Record<string, unknown>;
      assert.deepEqual(under, sanitizeHubMainGround(shape), `${name}: carrying an effect changed the background under it`);
      // Read from the hero row, as the page reads it.
      assert.deepEqual(hubMainEffect(hubMainGround({ main: { ...shape, effect } })), effect);
    }
  }
});

test('a shape with no effect reads byte for byte as it always did', () => {
  /* What each shape read as BEFORE the effect existed — written out, never derived from the code under test. */
  const BEFORE: Record<string, string> = {
    'the cover photo (a follow)': `{"follow":"hero","of":"${REF}","tint":{"match":true,"frame":["#112233","#445566"]},"shade":"dark","blur":"soft","focus":"top"}`,
    'the page’s own background': '{"ground":"theme"}',
    'a plain colour': '{"ground":"none"}',
    'a pattern': '{"ground":"pattern","pattern":"dots"}',
    'a video of ours': `{"ground":"loop","loop":"${LOOP}","shade":-40,"blur":"strong"}`,
    'their photo': `{"kind":"photo","media":"${REF}","tint":{"match":true,"frame":["#112233","#445566"]},"motion":"parallax","shade":30,"focus":"bottom"}`,
    'their clip': `{"kind":"snippet","media":"${REF}","poster":"${POSTER}","tint":{"match":true,"frame":["#112233","#445566"]},"blur":"soft"}`,
  };
  assert.deepEqual(Object.keys(BEFORE), Object.keys(SHAPES));
  for (const [name, shape] of Object.entries(SHAPES)) {
    const read = sanitizeHubMainGround(shape);
    assert.equal(JSON.stringify(read), BEFORE[name], `${name}: a background with no effect no longer reads as it did`);
    assert.equal('effect' in (read as object), false, `${name}: grew an "effect" key out of nothing`);
    assert.equal(hubMainEffect(read), null);
  }
});

test('a broken effect is dropped — the background under it is untouched; a colour we do not know is the effect’s own', () => {
  const BROKEN: unknown[] = [
    null,
    'sparkles',
    [],
    {},
    { kind: 'sparkles' },
    { intensity: 'standard' },
    { kind: 'candlelight', intensity: 'standard' },
    { kind: 'confetti', intensity: 'standard' },
    { kind: 'sparkles', intensity: 'extreme' },
    { kind: 'sparkles', intensity: 1 },
    { kind: ['sparkles'], intensity: 'standard' },
  ];
  for (const [name, shape] of Object.entries(SHAPES)) {
    for (const effect of BROKEN) {
      assert.deepEqual(sanitizeHubMainGround({ ...shape, effect }), sanitizeHubMainGround(shape), `${name}: kept a broken effect — ${JSON.stringify(effect)}`);
    }
  }
  // A colour that is not one of the five is not a colour: the effect keeps its own. A hex is never stored.
  for (const colour of ['original', '#C5A059', 'gold', 4, null]) {
    assert.deepEqual(sanitizeHubMainEffect({ kind: 'lanterns', intensity: 'lavish', colour }), { kind: 'lanterns', intensity: 'lavish' }, `kept the colour ${String(colour)}`);
  }
  // Nothing else rides in on it.
  assert.deepEqual(sanitizeHubMainEffect({ kind: 'bokeh', intensity: 'subtle', colour: 'accent2', hex: '#fff', count: 900 }), { kind: 'bokeh', intensity: 'subtle', colour: 'accent2' });
  // An effect alone is not a background.
  assert.equal(sanitizeHubMainGround({ effect: { kind: 'sparkles', intensity: 'standard' } }), null);
});

test('the vocabulary: six effects, three amounts, and the colours ARE the palette’s five slots', () => {
  assert.deepEqual([...HUB_MAIN_EFFECTS].sort(), ['bokeh', 'capiz', 'lanterns', 'petals', 'shimmer', 'sparkles']);
  assert.deepEqual([...HUB_MAIN_EFFECT_INTENSITIES], ['subtle', 'standard', 'lavish']);
  assert.deepEqual([...HUB_MAIN_EFFECT_COLOURS], Object.keys(MAIN_SLOT), 'an effect’s colour is a palette slot by the palette’s own names — one fact, one home');
  assert.equal((HUB_MAIN_EFFECTS as readonly string[]).includes('candlelight'), false, 'Candlelight is not an effect (owner: "remove candlelight")');
});

test('the fade bar moves the fade and leaves the effect where it is', () => {
  const effect: HubMainEffect = { kind: 'petals', intensity: 'subtle', colour: 'neutral' };
  const main = sanitizeHubMainGround({ ...SHAPES['their photo'], effect })!;
  assert.deepEqual(hubMainEffect(fadeMain(main, -60)), effect);
  assert.deepEqual(hubMainEffect(fadeMain(main, 0)), effect);
});
