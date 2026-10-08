/**
 * THE MAKER'S REVEAL SAYS LESS AND FINE-TUNES (owner 2026-09-27: *"less words as
 * our prompt says"* · *"where is the petal speed and other fine tuning?"*).
 *
 *   1. The couple's tune is a sparse override of the Reveal Studio's own knobs,
 *      in the SAME ranges the house resolver clamps to.
 *   2. The guest render plays the tuned look — and an untuned event plays the
 *      house look exactly as before.
 *   3. Only the knobs the opening's engine reads are offered for it.
 *   4. The tune rides the draft, and changing it is Pro at Apply.
 *   5. Fewer words: each opening is its label; the notes, the intro and "Where it
 *      plays" sit behind an ⓘ; the sliders fold shut by default.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  REVEAL_TUNE_KNOBS,
  resolveRevealEffects,
  resolveRevealTune,
  revealTuneHouse,
  revealTuneKnobsFor,
  tuneRevealLooks,
  type RevealTuneKey,
} from './std-reveal-effects';
import { DEFAULT_EFFECTS_LOOK, DEFAULT_VEIL_LOOK, mergeRevealConfig } from './reveal-config-pure';
import { revealEffectsWriteAllowed } from './reveal-access';

const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const KEYS = Object.keys(REVEAL_TUNE_KNOBS) as RevealTuneKey[];

/* ── 1 · the ranges are the house resolver's ─────────────────────────────── */

test('every fine-tune range is exactly the house resolver’s clamp', () => {
  assert.ok(KEYS.length >= 8, 'anti-vacuity: the knobs are gone');
  for (const key of KEYS) {
    const knob = REVEAL_TUNE_KNOBS[key];
    const side = knob.look;
    const lo = mergeRevealConfig({ [side]: { [key]: -1e9 } })[side] as Record<string, number>;
    const hi = mergeRevealConfig({ [side]: { [key]: 1e9 } })[side] as Record<string, number>;
    assert.equal(lo[key], knob.min, `${key}: slider min ≠ resolver min`);
    assert.equal(hi[key], knob.max, `${key}: slider max ≠ resolver max`);
    assert.ok(key in (side === 'veil' ? DEFAULT_VEIL_LOOK : DEFAULT_EFFECTS_LOOK), `${key} is not a ${side} knob`);
  }
});

test('a stored tune is sparse, finite, clamped and snapped — nothing else survives', () => {
  assert.deepEqual(resolveRevealTune(null), {});
  assert.deepEqual(resolveRevealTune([1, 2]), {});
  assert.deepEqual(
    resolveRevealTune({ wind: 250, feather: 1, petalFall: 'fast', butterflyCount: Number.NaN, tilePx: 10, petalSize: 41.4 }),
    { wind: 100, feather: 2, petalSize: 41 },
  );
  assert.deepEqual(resolveRevealTune({ feather: 3.3 }), { feather: 3.5 }, 'the veil speed snaps to its half-second step');
  // An untuned event's effects are byte-for-byte what they were.
  assert.equal('tune' in resolveRevealEffects({ petals: true }), false);
  assert.deepEqual(resolveRevealEffects({ tune: { wind: 20 } }).tune, { wind: 20 });
});

/* ── 2 · the guest render plays it ───────────────────────────────────────── */

test('the tune lays over the house look, clamped; no tune is the house look untouched', () => {
  const house = mergeRevealConfig(null);
  const same = tuneRevealLooks(house, undefined);
  assert.equal(same.veil, house.veil, 'an untuned event must get the very same house look');
  assert.equal(same.effects, house.effects);

  const tuned = tuneRevealLooks(house, { wind: 5, petalFall: 90, feather: 99 });
  assert.equal(tuned.veil?.wind, 5);
  assert.equal(tuned.veil?.feather, 8, 'clamped by the house resolver');
  assert.equal(tuned.effects?.petalFall, 90);
  assert.equal(tuned.veil?.folds, house.veil.folds, 'a knob the couple never touched stays the house value');
  assert.equal(tuned.effects?.butterflySize, house.effects.butterflySize);

  // Where an untuned slider rests: the house value.
  const rest = revealTuneHouse(house);
  assert.equal(rest.wind, house.veil.wind);
  assert.equal(rest.petalFall, house.effects.petalFall);
});

test('the opening on the guest page reads the tuned look, never the raw house look', () => {
  const overlay = stripComments(read('app/[slug]/_components/reveal/reveal-overlay.tsx'));
  assert.match(overlay, /const looks = tuneRevealLooks\(config, eventEffects\?\.tune\);/);
  assert.match(overlay, /look=\{looks\.veil\}/, 'the veil plays the tuned look');
  assert.equal((overlay.match(/effectLook=\{looks\.effects\}/g) ?? []).length, 2, 'both rigid openings play the tuned look');
  assert.doesNotMatch(overlay, /look=\{config\?\.veil\}|effectLook=\{config\?\.effects\}/, 'a raw house look is back');
});

/* ── 3 · only what the engine reads ──────────────────────────────────────── */

test('each opening offers only the knobs its engine reads', () => {
  const on = { petals: true, butterflies: true };
  const keys = (opening: string, fx = on) => revealTuneKnobsFor(opening, fx).map((k) => k.key);
  assert.deepEqual(keys('veil-sheer'), ['feather', 'wind', 'petalsDensity']);
  assert.deepEqual(keys('veil-sheer', { petals: false, butterflies: false }), ['feather', 'wind']);
  assert.deepEqual(keys('church-doors'), ['petalDensity', 'petalSize', 'petalFall']);
  for (const env of ['four-flap', 'two-flap-vertical', 'two-flap-horizontal']) {
    assert.deepEqual(keys(env), ['butterflyCount', 'butterflySpeed', 'butterflySize'], env);
    assert.deepEqual(keys(env, { petals: true, butterflies: false }), [], `${env}: no butterflies, nothing to tune`);
  }
  assert.deepEqual(keys('none'), []);
});

/* ── 4 · the draft, and Pro at Apply ─────────────────────────────────────── */

test('a tune rides the draft and is Pro at Apply', async () => {
  const { mergeHubDraft, emptyHubDraft, planHubDraftApply } = await import('./hub-draft');
  const live = { events: { std_reveal_effects: null }, widgets: [] };
  const tuned = mergeHubDraft(emptyHubDraft(), {
    events: { std_reveal_effects: { ...resolveRevealEffects(null), tune: { petalFall: 80 } } },
  });
  assert.deepEqual(
    (tuned.events as Record<string, { tune?: unknown }>).std_reveal_effects?.tune,
    { petalFall: 80 },
    'the draft dropped the tune',
  );
  assert.equal(planHubDraftApply(tuned, live, false).refused.length, 1, 'a tune needs Pro');
  assert.equal(planHubDraftApply(tuned, live, true).apply.length, 1);

  // The Save-the-Date studio's own rule sees the tune as a reveal change too.
  const stored = resolveRevealEffects(null) as unknown as Record<string, unknown>;
  const incoming = resolveRevealEffects({ tune: { wind: 10 } }) as unknown as Record<string, unknown>;
  assert.equal(revealEffectsWriteAllowed(stored, incoming, false), false);
  assert.equal(revealEffectsWriteAllowed(stored, stored, false), true);

  // The Maker posts it through the one draft door (+0 server actions).
  const picker = stripComments(read('app/dashboard/[eventId]/launch/_components/maker-reveal.tsx'));
  assert.match(picker, /JSON\.stringify\(\{ events: \{ std_reveal_effects: next \} \}\)/);
  assert.match(picker, /tune: \{ \.\.\.\(effects\.tune \?\? \{\}\), \[knob\.key\]: value \}/);
});

/* ── 5 · fewer words, and the fold ───────────────────────────────────────── */

test('each opening is its label — the notes, the intro and "Where it plays" sit behind an ⓘ', () => {
  const src = stripComments(read('app/dashboard/[eventId]/launch/_components/maker-reveal.tsx'));
  const row = src.slice(src.indexOf('const Row = '), src.indexOf('return (\n    <section'));
  assert.ok(row.length > 200, 'anti-vacuity: the Row was not found');
  assert.match(row, /<InfoTip[\s\S]*?label=\{label\}[\s\S]*?>\s*\{note\}\s*<\/InfoTip>/, 'the note is not behind the ⓘ');
  assert.equal((row.match(/\{note\}/g) ?? []).length, 1, 'the note is printed outside the ⓘ too');
  // The intro and the "Where it plays" explanation are InfoTip children.
  assert.match(src, /<InfoTip label="Opening"[\s\S]*?How your Event Hub opens for a guest[\s\S]*?<\/InfoTip>/);
  assert.match(src, /<InfoTip label="Where it plays"[\s\S]*?once opened, it is gone\.\s*<\/InfoTip>/);
  assert.equal((src.match(/How your Event Hub opens for a guest/g) ?? []).length, 1);
  assert.equal((src.match(/once opened, it is gone/g) ?? []).length, 1);
  // Switches are labels only.
  assert.doesNotMatch(src, /\bhint=/, 'a switch grew its sentence back');
  // The diamond / padlock marks stay.
  assert.match(row, /<PaidMark\b/);
});

test('the fine-tune sliders fold shut by default and save when let go', () => {
  const src = stripComments(read('app/dashboard/[eventId]/launch/_components/maker-reveal.tsx'));
  const fold = src.slice(src.indexOf('function TuneFold('), src.indexOf('function TuneSlider('));
  assert.match(fold, /const \[open, setOpen\] = useState\(false\);/, 'the fold must start shut');
  assert.match(fold, /aria-expanded=\{open\}/);
  assert.match(fold, /\{open \? \(/, 'the sliders must render only when open');
  const slider = src.slice(src.indexOf('function TuneSlider('), src.indexOf('function ColourRow('));
  /* The app's one slider since 2026-10-09 (`app/_components/slider.tsx`): it is the range, and IT commits on let-go. */
  assert.match(slider, /<Slider\b[^>]*onChange=\{setLocal\} onCommit=\{onCommit\} \/>/, 'a slider saves when let go');
  const shared = stripComments(read('app/_components/slider.tsx'));
  assert.match(shared, /type="range"/);
  assert.match(shared, /onPointerUp=\{onCommit \? \(e\) => onCommit\(Number\(e\.currentTarget\.value\)\) : undefined\}/, 'a slider saves when let go');
  assert.match(shared, /onKeyUp=\{onCommit \? \(e\) => onCommit\(Number\(e\.currentTarget\.value\)\) : undefined\}/);
  assert.doesNotMatch(slider, /onChange=\{[^}]*onCommit/, 'a slider must not save on every tick');
  assert.match(src, /<TuneFold\s+knobs=\{revealTuneKnobsFor\(opening, effects\)\}/);
});
