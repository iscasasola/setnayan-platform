import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeReceptionDesign,
  sel,
  selAll,
  optionIds,
  isMultiAttribute,
  MAX_SELECTIONS_PER_ATTRIBUTE,
  DEFAULT_DESIGN,
  RECEPTION_PARTS,
  renderVenueSvg,
  buildPrompt,
  type PartId,
} from './reception-scene';
import { VENUE_SETTINGS, AMBIGUOUS_VENUE_SETTING } from './venue-settings';

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

// ── THE RECEPTION VENUE (owner 2026-09-03: "venue is 2. ceremony and
// reception"). buildPrompt referenced the venue ZERO times, so a garden wedding
// and a ballroom wedding produced a byte-identical brief and the couple paid
// for whichever room the model felt like. ───────────────────────────────────

test('buildPrompt names the reception venue the couple chose', () => {
  const prompt = buildPrompt({}, [], undefined, { setting: 'garden' });
  assert.match(
    prompt,
    /elegant Filipino wedding reception in an outdoor garden\./,
    'The brief does not name the garden, so a paid render can come back a ballroom.',
  );
});

test('buildPrompt distinguishes every reception venue from every other', () => {
  // Not "each one produces something" — each one must produce something
  // DIFFERENT. A phrase map that returned the same string twice would satisfy a
  // per-value match test while making two venues indistinguishable to the model.
  const prompts = VENUE_SETTINGS.filter((s) => s !== AMBIGUOUS_VENUE_SETTING).map((setting) =>
    buildPrompt({}, [], undefined, { setting }),
  );
  assert.equal(new Set(prompts).size, prompts.length, 'two reception venues brief identically');
});

test('buildPrompt will NOT assert a ballroom it cannot prove', () => {
  // `banquet_hall` is what both writers stamp when the couple never answered,
  // so reading it is not evidence. The brief falls back to the generic opening —
  // less specific, never wrong.
  const unproven = buildPrompt({}, [], undefined, { setting: AMBIGUOUS_VENUE_SETTING });
  assert.doesNotMatch(unproven, /hotel ballroom/);
  assert.match(unproven, /elegant Filipino wedding reception\. /);
  // With real evidence it says so.
  const proven = buildPrompt({}, [], undefined, {
    setting: AMBIGUOUS_VENUE_SETTING,
    chosen: true,
  });
  assert.match(proven, /elegant Filipino wedding reception in a hotel ballroom\./);
});

test('a ceremony-only venue is never briefed as a reception room', () => {
  // civil_registrar left the reception vocabulary on 2026-09-03. Even if a stale
  // row or caller hands it over, the brief must not depict a banquet inside a
  // registrar's office.
  const prompt = buildPrompt({}, [], undefined, { setting: 'civil_registrar', chosen: true });
  assert.doesNotMatch(prompt, /registrar/i);
  assert.match(prompt, /elegant Filipino wedding reception\. /);
});

test('omitting the venue reproduces the pre-2026-09-03 brief exactly', () => {
  // The additive guarantee: every existing call site keeps its output, so this
  // change cannot alter a render nobody asked it to alter.
  const design = { ceiling: { treatment: 'chandeliers' } };
  const palette = ['#C9A059'];
  assert.equal(buildPrompt(design, palette), buildPrompt(design, palette, undefined, undefined));
  assert.equal(
    buildPrompt(design, palette),
    buildPrompt(design, palette, undefined, { setting: null }),
  );
  assert.match(buildPrompt(design, palette), /^Photorealistic editorial photograph of an elegant Filipino wedding reception\. /);
});

// ── multi-select (owner 2026-09-03: "on reception design, needs to be able to
// pick multiple as well"). The widening rule is: a bare string keeps meaning
// exactly what it meant, so nothing stored had to move. ──────────────────────

test('a bare string still resolves through sel() AND selAll()', () => {
  const design = { ceiling: { treatment: 'fairy_lights' } };
  assert.equal(sel(design, 'ceiling', 'treatment'), 'fairy_lights');
  assert.deepEqual(selAll(design, 'ceiling', 'treatment'), ['fairy_lights']);
});

test('an array resolves: sel() gives the FIRST, selAll() gives all of them', () => {
  const design = { ceiling: { treatment: ['draped', 'fairy_lights'] } };
  assert.equal(sel(design, 'ceiling', 'treatment'), 'draped');
  assert.deepEqual(selAll(design, 'ceiling', 'treatment'), ['draped', 'fairy_lights']);
});

test('selAll()[0] === sel() for EVERY part+attribute — moving a call site can only add', () => {
  const designs: Array<Record<string, Record<string, string | string[]>>> = [
    {},
    { ceiling: { treatment: ['draped', 'fairy_lights', 'lanterns'] } },
    { backdrop: { style: ['greenery', 'floral_wall'], florals: ['corner', 'cascading'] } },
    { entrance: { runner: ['fabric', 'petals'] }, tunnel: { style: ['floral', 'fairy_light'] } },
  ];
  for (const raw of designs) {
    const design = sanitizeReceptionDesign(raw);
    for (const part of RECEPTION_PARTS) {
      for (const attr of part.attributes) {
        assert.equal(
          selAll(design, part.id, attr.id)[0],
          sel(design, part.id, attr.id),
          `${part.id}.${attr.id}`,
        );
      }
    }
  }
});

test('optionIds normalizes without inventing a default', () => {
  assert.deepEqual(optionIds('draped'), ['draped']);
  assert.deepEqual(optionIds(['draped', 'fairy_lights']), ['draped', 'fairy_lights']);
  assert.deepEqual(optionIds(undefined), []);
  assert.deepEqual(optionIds([]), []);
  assert.deepEqual(optionIds(''), []);
  // …while selAll DOES fall back, so a renderer always has something to draw.
  assert.deepEqual(selAll({}, 'ceiling', 'treatment'), [DEFAULT_DESIGN.ceiling.treatment]);
});

test('sanitize: an array on a MULTI attribute is kept', () => {
  const out = sanitizeReceptionDesign({ ceiling: { treatment: ['draped', 'fairy_lights'] } });
  assert.deepEqual(out.ceiling, { treatment: ['draped', 'fairy_lights'] });
});

test('sanitize: an array on a NON-multi attribute is collapsed to its first valid entry', () => {
  assert.equal(isMultiAttribute('tables', 'shape'), false);
  assert.equal(isMultiAttribute('people', 'who'), false);
  assert.equal(isMultiAttribute('stage', 'setup'), false);
  const out = sanitizeReceptionDesign({
    tables: { shape: ['square', 'round'] },
    people: { who: ['couple', 'everyone'] },
    stage: { setup: ['lounge', 'sweetheart'] },
  });
  // Collapsed to a bare STRING — not a one-element array.
  assert.deepEqual(out.tables, { shape: 'square' });
  assert.deepEqual(out.people, { who: 'couple' });
  assert.deepEqual(out.stage, { setup: 'lounge' });
});

test('sanitize: unknown option ids are dropped inside an array, exactly as outside one', () => {
  const out = sanitizeReceptionDesign({
    ceiling: { treatment: ['not_a_treatment', 'fairy_lights', 42, null, 'also_bogus'] },
    backdrop: { style: ['nope_1', 'nope_2'] }, // nothing valid left → attribute dropped
  });
  assert.deepEqual(out.ceiling, { treatment: 'fairy_lights' });
  assert.equal(out.backdrop, undefined);
});

test('sanitize: duplicates collapse, and a single surviving id stores as a bare string', () => {
  const out = sanitizeReceptionDesign({ ceiling: { treatment: ['draped', 'draped'] } });
  assert.deepEqual(out.ceiling, { treatment: 'draped' });
});

test('sanitize: the per-attribute cap is enforced', () => {
  const over = ['chandeliers', 'draped', 'fairy_lights', 'lanterns', 'geometric'];
  assert.ok(over.length > MAX_SELECTIONS_PER_ATTRIBUTE);
  const out = sanitizeReceptionDesign({ ceiling: { treatment: over } });
  const kept = out.ceiling!.treatment as string[];
  assert.equal(kept.length, MAX_SELECTIONS_PER_ATTRIBUTE);
  assert.deepEqual(kept, over.slice(0, MAX_SELECTIONS_PER_ATTRIBUTE));
});

test('sanitize: a "nothing here" option is dropped beside a real one, and kept alone', () => {
  // "no entrance tunnel" AND "a tunnel of floral arches" is a contradiction the
  // AI brief would repeat verbatim — so the real treatment wins.
  const mixed = sanitizeReceptionDesign({ tunnel: { style: ['none', 'floral'] } });
  assert.deepEqual(mixed.tunnel, { style: 'floral' });
  const alone = sanitizeReceptionDesign({ tunnel: { style: ['none'] } });
  assert.deepEqual(alone.tunnel, { style: 'none' });
  // Same rule on the walls zone, whose "Uplighting only" says, in words, that
  // there is no wall dressing.
  const walls = sanitizeReceptionDesign({
    walls: { treatment: ['uplighting_only', 'floral_garland'] },
  });
  assert.deepEqual(walls.walls, { treatment: 'floral_garland' });
});

test('every multi attribute has at least two combinable options (the flag means something)', () => {
  let multiCount = 0;
  for (const part of RECEPTION_PARTS) {
    for (const attr of part.attributes) {
      if (attr.multi !== true) continue;
      multiCount += 1;
      const combinable = attr.options.filter((o) => o.exclusive !== true);
      assert.ok(
        combinable.length >= 2,
        `${part.id}.${attr.id} is multi but has ${combinable.length} combinable option(s)`,
      );
    }
  }
  assert.ok(multiCount >= 9, `expected the 9 combinable attributes, saw ${multiCount}`);
});

test('renderVenueSvg produces valid SVG for BOTH shapes, on every multi attribute', () => {
  const palette = ['#C9A059', '#8C6BA6', '#D98BA6'];
  for (const part of RECEPTION_PARTS) {
    for (const attr of part.attributes) {
      if (attr.multi !== true) continue;
      const ids = attr.options.filter((o) => o.exclusive !== true).map((o) => o.id);
      for (const id of ids) {
        // the single/legacy shape
        const one = renderVenueSvg({ [part.id as PartId]: { [attr.id]: id } }, palette);
        assert.match(one, /^<svg/);
        assert.match(one, /<\/svg>$/);
      }
      // the multi shape, at the cap
      const many = sanitizeReceptionDesign({
        [part.id]: { [attr.id]: ids.slice(0, MAX_SELECTIONS_PER_ATTRIBUTE) },
      });
      const svg = renderVenueSvg(many, palette);
      assert.match(svg, /^<svg/);
      assert.match(svg, /<\/svg>$/);
    }
  }
});

test('renderVenueSvg DRAWS both selections, not just the primary', () => {
  const palette = ['#C9A059', '#8C6BA6', '#D98BA6'];
  const drapedOnly = renderVenueSvg({ ceiling: { treatment: 'draped' } }, palette);
  const bothCeilings = renderVenueSvg({ ceiling: { treatment: ['draped', 'chandeliers'] } }, palette);
  // The chandelier glyph adds markup the drape-only scene doesn't have, and the
  // combined scene is strictly longer than either half.
  assert.ok(bothCeilings.length > drapedOnly.length);
  const chandeliersOnly = renderVenueSvg({ ceiling: { treatment: 'chandeliers' } }, palette);
  assert.ok(bothCeilings.length > chandeliersOnly.length);
});

test('buildPrompt reads sensibly with multiple selections', () => {
  const prompt = buildPrompt(
    sanitizeReceptionDesign({
      ceiling: { treatment: ['draped', 'fairy_lights'] },
      welcome_signage: {
        style: ['easel_sign', 'framed_seating_chart', 'floral_guestbook'],
      },
      tunnel: { style: ['none', 'floral'] }, // the contradiction, pre-sanitizer
    }),
    ['#C9A059'],
  );
  assert.match(prompt, /a draped fabric canopy across the ceiling/);
  assert.match(prompt, /a warm canopy of fairy string lights/);
  assert.match(prompt, /an easel welcome sign at the entrance/);
  assert.match(prompt, /a framed seating chart display near the entrance/);
  assert.match(prompt, /a floral-framed guestbook table near the entrance/);
  // …and never both halves of a contradiction.
  assert.match(prompt, /a grand-entrance tunnel of floral arches/);
  assert.doesNotMatch(prompt, /no entrance tunnel/);
});

test('the legacy single-string shape renders BYTE-IDENTICALLY to before the widening', () => {
  // The whole safety argument for not migrating 2,600 seeded rows: a design
  // written entirely in bare strings must produce the same scene it always did.
  const palette = ['#C9A059', '#8C6BA6', '#D98BA6'];
  const legacy = {
    ceiling: { treatment: 'chandeliers' },
    backdrop: { style: 'draped', florals: 'corner' },
    stage: { setup: 'sweetheart', florals: 'arch' },
    tables: { shape: 'round', chairs: 'chiavari', linen: 'plain', centerpiece: 'tall', place: 'gold' },
    tunnel: { style: 'floral' },
    entrance: { runner: 'fabric' },
    walls: { treatment: 'bare' },
    photo_wall: { style: 'none' },
    welcome_signage: { style: 'minimal' },
    people: { who: 'couple' },
  };
  // Same design expressed with one-element arrays → identical output.
  const asArrays = Object.fromEntries(
    Object.entries(legacy).map(([partId, attrs]) => [
      partId,
      Object.fromEntries(Object.entries(attrs).map(([a, v]) => [a, [v]])),
    ]),
  );
  assert.equal(renderVenueSvg(legacy, palette), renderVenueSvg(asArrays, palette));
  assert.equal(buildPrompt(legacy, palette), buildPrompt(asArrays, palette));
  // And the sanitizer hands the array form back in the legacy string shape.
  assert.deepEqual(sanitizeReceptionDesign(asArrays), sanitizeReceptionDesign(legacy));
});
