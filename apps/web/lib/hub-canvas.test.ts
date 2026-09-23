/**
 * hub-canvas.test.ts — THE CONTRACT THREE SURFACES HAVE TO AGREE ABOUT.
 *
 * The editor writes `config_json`, the guest page draws it, and the
 * controller's miniature shows the guest page. If any of the three read it
 * differently the drift is invisible until a couple sees their own page look
 * wrong — which is the disease this whole build exists to cure, one layer down.
 *
 * Two properties matter more than the rest and each has its own section below:
 *
 *   ⛔ NOTHING IS REPAIRED. A value this product did not write is dropped, not
 *      rounded or lower-cased into the nearest legal one.
 *   ⛔ AUTO IS AN ABSENCE. An unset fine-tune must not be stored as 'auto', or
 *      today's preset body freezes into a couple's saved page and a later
 *      change to what "Calm" means never reaches them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HUB_ARRANGEMENTS,
  HUB_DEFAULT_PRESET,
  HUB_DURATION,
  HUB_MOTION_PRESETS,
  HUB_PRESET_BODY,
  HUB_STAGGER,
  focalToObjectPosition,
  hubCanvasClass,
  hubCanvasVars,
  resolveHubMotion,
  sanitizeHubCanvas,
  type HubFocalPoint,
} from './hub-canvas';

/* ══ THE SHAPE ══════════════════════════════════════════════════════════ */

test('⭐ a section the couple arranged survives the round trip intact', () => {
  const stored = {
    arrangement: 'left',
    focal: 3,
    zoom: 120,
    preset: 'editorial',
    in: 'fade',
    duration: 1.8,
  };
  const c = sanitizeHubCanvas(stored);
  assert.deepEqual(c, { arrangement: 'left', focal: 3, zoom: 120, preset: 'editorial', in: 'fade', duration: 1.8 });
  const m = resolveHubMotion(c);
  assert.equal(m.in, 'fade', 'the override the couple reached in and set');
  assert.equal(m.out, HUB_PRESET_BODY.editorial.out, 'and the preset for everything they did not');
  assert.equal(m.duration, 1.8);
});

test('⭐ it also reads a config that nests the canvas under its own key', () => {
  // `config_json` is a shared bag — other widget settings live beside this one.
  const c = sanitizeHubCanvas({ someOtherWidgetSetting: true, canvas: { arrangement: 'text' } });
  assert.equal(c.arrangement, 'text');
});

/* ══ ⛔ NOTHING IS REPAIRED ═════════════════════════════════════════════ */

test('⛔ a value this product did not write is DROPPED, never rounded into place', () => {
  const c = sanitizeHubCanvas({
    arrangement: 'Left',      // capitalised — a different product's spelling
    focal: 10,                // off the keypad
    zoom: 137,                // between two legal values
    preset: 'dramatic',       // a preset that never existed
    in: 'RISE',
    out: 'explode',
    during: 'spin',
    timeline: 'onScroll',
    stagger: 0.2,             // near 0.25, and not it
    duration: 2,              // near 1.8, and not it
  });
  assert.deepEqual(c, {}, 'every one of them is absent, not repaired');
  // …and the section still draws, on the preset, rather than blanking.
  const m = resolveHubMotion(c);
  assert.deepEqual(m, HUB_PRESET_BODY[HUB_DEFAULT_PRESET], 'an unreadable config falls back whole');
});

test('⛔ config_json is data, not a promise about type', () => {
  for (const junk of [null, undefined, 'a string', 42, [], [{ arrangement: 'left' }], true]) {
    assert.deepEqual(sanitizeHubCanvas(junk), {}, `${JSON.stringify(junk)} must not become a canvas`);
  }
});

test('⛔ one bad field does not take the good ones with it', () => {
  const c = sanitizeHubCanvas({ arrangement: 'right', zoom: 999, preset: 'cinematic' });
  assert.equal(c.arrangement, 'right');
  assert.equal(c.preset, 'cinematic');
  assert.equal(c.zoom, undefined, 'only the unreadable one is gone');
});

/* ══ ⛔ AUTO IS AN ABSENCE ══════════════════════════════════════════════ */

test('⛔ "Auto" is never stored — it is the absence of the key', () => {
  const c = sanitizeHubCanvas({ preset: 'calm', in: 'auto', out: 'auto', duration: 'auto' });
  assert.equal('in' in c, false, 'Auto must not survive as a literal');
  assert.equal('out' in c, false);
  assert.equal('duration' in c, false);
  assert.equal(c.preset, 'calm');
});

test('⭐ so a couple on Auto MOVES when the preset body changes, and one who chose does not', () => {
  // The whole reason absence beats a literal. Simulated by reading the body.
  const onAuto = sanitizeHubCanvas({ preset: 'calm' });
  const chose = sanitizeHubCanvas({ preset: 'calm', in: 'slide' });
  assert.equal(resolveHubMotion(onAuto).in, HUB_PRESET_BODY.calm.in, 'follows the preset');
  assert.equal(resolveHubMotion(chose).in, 'slide', 'keeps their own answer');
});

/* ══ THE KEYPAD ════════════════════════════════════════════════════════ */

test('⭐ the focal point reads like a phone keypad: 1 top-left, 5 centre, 9 bottom-right', () => {
  assert.equal(focalToObjectPosition(1), '0% 0%');
  assert.equal(focalToObjectPosition(2), '50% 0%');
  assert.equal(focalToObjectPosition(3), '100% 0%');
  assert.equal(focalToObjectPosition(5), '50% 50%');
  assert.equal(focalToObjectPosition(7), '0% 100%');
  assert.equal(focalToObjectPosition(9), '100% 100%');
  // Every one of the nine is a real CSS position — no undefined creeping in.
  for (let f = 1 as number; f <= 9; f += 1) {
    assert.match(focalToObjectPosition(f as HubFocalPoint), /^(0|50|100)% (0|50|100)%$/);
  }
});

/* ══ WHAT REACHES THE PAGE ═════════════════════════════════════════════ */

test('⭐ the choices reach the RENDER as custom properties and classes', () => {
  const c = sanitizeHubCanvas({ arrangement: 'right', focal: 7, zoom: 150, preset: 'cinematic' });
  const vars = hubCanvasVars(c);
  assert.equal(vars['--hub-focal'], '0% 100%', 'the crop the couple chose');
  assert.equal(vars['--hub-zoom'], '1.5');
  assert.equal(vars['--hub-duration'], '1.8s', 'from the preset, already in CSS units');
  assert.equal(vars['--hub-in-kf'], 'hub-in-slide', 'the keyframe NAME, so one rule serves every pair');
  assert.equal(vars['--hub-out-kf'], 'hub-out-shrink');
  assert.equal(vars['--hub-ease'], 'linear', 'a scrubbed section follows the thumb — an ease would read as lag');
  // Cinematic sequences its parts, so the gap between them is a real value now.
  assert.equal(vars['--hub-stagger'], '0.25s', 'the gap between parts, in CSS units');
  const together = hubCanvasVars({ preset: 'calm' });
  assert.equal(
    '--hub-stagger' in together,
    false,
    'ABSENT — not zero — when the parts arrive together, so no rule can apply a delay of nothing',
  );
  const cls = hubCanvasClass(c);
  assert.match(cls, /\bhub-arr-right\b/);
  assert.match(cls, /\bhub-tl-scrub\b/, 'cinematic follows the scroll');
  assert.match(cls, /\bhub-during-lift\b/);
});

test('⭐ a TIMED section gets a real ease; a scrubbed one stays linear', () => {
  // The whole difference between "smooth" and "mechanical" at one duration.
  assert.match(hubCanvasVars({ preset: 'calm' })['--hub-ease'] ?? '', /cubic-bezier/);
  assert.equal(hubCanvasVars({ preset: 'editorial' })['--hub-ease'], 'linear');
});

test('⭐ "None" becomes the keyframe `none`, not a missing name', () => {
  const v = hubCanvasVars({ preset: 'still' });
  assert.equal(v['--hub-in-kf'], 'none', 'so the one rule that reads it stays valid');
  assert.equal(v['--hub-out-kf'], 'none');
});

test('⭐ an EMPTY config still draws a whole section — never a blank one', () => {
  const vars = hubCanvasVars({});
  assert.equal(vars['--hub-focal'], '50% 50%', 'centre, which is what a photo wants');
  assert.equal(vars['--hub-zoom'], '1');
  assert.match(hubCanvasClass({}), /\bhub-arr-full\b/);
  for (const [k, v] of Object.entries(vars)) {
    assert.notEqual(v, 'undefined', `${k} must never render the word "undefined"`);
    assert.notEqual(v, '', `${k} must never render empty`);
  }
});

/* ══ NON-VACUITY ═══════════════════════════════════════════════════════ */

test('⭐ every preset is a DIFFERENT page, and every legal value is accepted', () => {
  // A sanitizer that returned {} for everything would pass most of the tests
  // above. This one fails unless the legal values actually survive.
  for (const a of HUB_ARRANGEMENTS) {
    assert.equal(sanitizeHubCanvas({ arrangement: a }).arrangement, a);
  }
  for (const s of HUB_STAGGER) assert.equal(sanitizeHubCanvas({ stagger: s }).stagger, s);
  for (const d of HUB_DURATION) assert.equal(sanitizeHubCanvas({ duration: d }).duration, d);
  const seen = new Set(HUB_MOTION_PRESETS.map((p) => JSON.stringify(HUB_PRESET_BODY[p])));
  assert.equal(seen.size, HUB_MOTION_PRESETS.length, 'four presets, four different bodies');
  assert.equal(HUB_PRESET_BODY.still.in, 'none', '"Still" is genuinely still');
  assert.equal(HUB_PRESET_BODY.still.during, 'still');
});

test('⭐ the parts arrive in turn, or all at once — and the class says which', () => {
  // Owner, 2026-09-23, asked for this directly: a section can arrive as one
  // slab, or its parts can arrive in turn.
  assert.match(hubCanvasClass({ preset: 'editorial' }), /\bhub-seq-parts\b/);
  assert.match(hubCanvasClass({ preset: 'calm' }), /\bhub-seq-whole\b/);
  // And a couple may override the preset either way.
  assert.match(hubCanvasClass({ preset: 'calm', sequence: 'one_after_another' }), /\bhub-seq-parts\b/);
  assert.match(hubCanvasClass({ preset: 'cinematic', sequence: 'together' }), /\bhub-seq-whole\b/);
  // The two classes are exclusive: both levels animating would multiply two
  // opacities and the section would arrive muddy.
  for (const p of HUB_MOTION_PRESETS) {
    const cls = hubCanvasClass({ preset: p });
    assert.equal(
      [/\bhub-seq-parts\b/, /\bhub-seq-whole\b/].filter((r) => r.test(cls)).length,
      1,
      `${p} must name exactly one level`,
    );
  }
});

test('⛔ a sequence this product did not write is dropped, and the preset stands', () => {
  assert.equal(sanitizeHubCanvas({ canvas: { sequence: 'staggered' } }).sequence, undefined);
  assert.equal(sanitizeHubCanvas({ canvas: { sequence: 1 } }).sequence, undefined);
  assert.equal(sanitizeHubCanvas({ canvas: { sequence: 'together' } }).sequence, 'together');
  assert.equal(resolveHubMotion({ preset: 'editorial' }).sequence, 'one_after_another');
});
