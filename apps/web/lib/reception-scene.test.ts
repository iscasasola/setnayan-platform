import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeReceptionDesign,
  sel,
  DEFAULT_DESIGN,
  RECEPTION_PARTS,
  renderVenueSvg,
  buildPrompt,
} from './reception-scene';

test('sanitizeReceptionDesign: keeps only known part → attr → valid option ids', () => {
  const out = sanitizeReceptionDesign({
    ceiling: { treatment: 'chandeliers', bogus: 'x' },
    tables: { centerpiece: 'candelabra' },
    backdrop: { style: 'not_a_real_style' }, // dropped (invalid option)
    nonsense_part: { foo: 'bar' }, // dropped (unknown part)
  });
  assert.deepEqual(out.ceiling, { treatment: 'chandeliers' });
  assert.deepEqual(out.tables, { centerpiece: 'candelabra' });
  assert.equal(out.backdrop, undefined);
  assert.equal((out as Record<string, unknown>).nonsense_part, undefined);
});

test('sanitizeReceptionDesign: total on malformed input (never throws)', () => {
  assert.deepEqual(sanitizeReceptionDesign(null), {});
  assert.deepEqual(sanitizeReceptionDesign(undefined), {});
  assert.deepEqual(sanitizeReceptionDesign('nope'), {});
  assert.deepEqual(sanitizeReceptionDesign(42), {});
  assert.deepEqual(sanitizeReceptionDesign([1, 2, 3]), {});
  assert.deepEqual(sanitizeReceptionDesign({ ceiling: 'wrongtype' }), {});
});

test('sanitizeReceptionDesign: empty result falls back to DEFAULT_DESIGN via sel()', () => {
  const clean = sanitizeReceptionDesign({});
  assert.equal(sel(clean, 'ceiling', 'treatment'), DEFAULT_DESIGN.ceiling.treatment);
  assert.equal(sel(clean, 'tables', 'centerpiece'), DEFAULT_DESIGN.tables.centerpiece);
});

// ── new Filipino-relevant decor zones (2026-09-03): walls/surroundings,
// photo wall, welcome & signage — additive, same vocabulary shape as the
// original 7 parts. ──────────────────────────────────────────────────────

test('new zones are registered in RECEPTION_PARTS with the standard shape', () => {
  for (const id of ['walls', 'photo_wall', 'welcome_signage'] as const) {
    const part = RECEPTION_PARTS.find((p) => p.id === id);
    assert.ok(part, `expected a RECEPTION_PARTS entry for ${id}`);
    assert.ok(part!.attributes.length > 0);
    for (const attr of part!.attributes) {
      assert.ok(attr.options.length > 0);
    }
  }
});

test('new zones have a DEFAULT_DESIGN entry usable via sel()', () => {
  const clean = sanitizeReceptionDesign({});
  assert.equal(sel(clean, 'walls', 'treatment'), DEFAULT_DESIGN.walls.treatment);
  assert.equal(sel(clean, 'photo_wall', 'style'), DEFAULT_DESIGN.photo_wall.style);
  assert.equal(sel(clean, 'welcome_signage', 'style'), DEFAULT_DESIGN.welcome_signage.style);
});

test('sanitizeReceptionDesign keeps valid new-zone choices and drops invalid ones', () => {
  const out = sanitizeReceptionDesign({
    walls: { treatment: 'floral_garland', bogus: 'x' },
    photo_wall: { style: 'not_a_real_style' },
    welcome_signage: { style: 'easel_sign' },
  });
  assert.deepEqual(out.walls, { treatment: 'floral_garland' });
  assert.equal(out.photo_wall, undefined);
  assert.deepEqual(out.welcome_signage, { style: 'easel_sign' });
});

test('renderVenueSvg includes every new zone option without throwing', () => {
  for (const id of ['walls', 'photo_wall', 'welcome_signage'] as const) {
    const part = RECEPTION_PARTS.find((p) => p.id === id)!;
    for (const attr of part.attributes) {
      for (const opt of attr.options) {
        const design = { [id]: { [attr.id]: opt.id } };
        const svg = renderVenueSvg(design, ['#C9A059', '#8C6BA6', '#D98BA6']);
        assert.match(svg, /^<svg/);
      }
    }
  }
});

test('buildPrompt folds in the new zones’ prompt phrases', () => {
  const prompt = buildPrompt(
    {
      walls: { treatment: 'floral_garland' },
      photo_wall: { style: 'step_repeat' },
      welcome_signage: { style: 'easel_sign' },
    },
    [],
  );
  assert.match(prompt, /floral garlands along the side walls/);
  assert.match(prompt, /step-and-repeat photo wall/);
  assert.match(prompt, /easel welcome sign/);
});
