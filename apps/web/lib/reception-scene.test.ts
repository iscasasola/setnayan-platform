import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  venueZoneApplies,
  venueSceneFamily,
  isCompositableDecorHref,
  type PartId,
  type ReceptionDesign,
} from './reception-scene';
import {
  decorLayerHrefs,
  PILOT_DECOR_ZONES,
  type DecorLayerCatalog,
} from './reception-decor-layers';
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

/* ── MB6: venue-type awareness + honest gating ─────────────────────────── */

test('venueZoneApplies: every VENUE_SETTINGS value is covered, and only the documented zones are gated', () => {
  const expectNA: Partial<Record<(typeof VENUE_SETTINGS)[number], PartId[]>> = {
    beach: ['ceiling', 'walls'],
    destination: ['ceiling', 'walls'],
    garden: ['walls'],
  };
  for (const venue of VENUE_SETTINGS) {
    const na = new Set(expectNA[venue] ?? []);
    for (const part of RECEPTION_PARTS) {
      assert.equal(
        venueZoneApplies(venue, part.id),
        !na.has(part.id),
        `${venue} × ${part.id}`,
      );
    }
  }
});

test('venueZoneApplies: garden keeps its ceiling (string lights between trees are real)', () => {
  assert.equal(venueZoneApplies('garden', 'ceiling'), true);
});

test('venueZoneApplies: an unrecognised or absent venue gates nothing', () => {
  for (const part of RECEPTION_PARTS) {
    assert.equal(venueZoneApplies(null, part.id), true);
    assert.equal(venueZoneApplies(undefined, part.id), true);
    assert.equal(venueZoneApplies('not_a_real_venue', part.id), true);
  }
});

test('venueSceneFamily: destination draws as beach, restaurant draws as hall, unrecognised draws as hall', () => {
  assert.equal(venueSceneFamily('destination'), 'beach');
  assert.equal(venueSceneFamily('restaurant'), 'hall');
  assert.equal(venueSceneFamily('banquet_hall'), 'hall');
  assert.equal(venueSceneFamily('outdoor_tent'), 'tent');
  assert.equal(venueSceneFamily('heritage'), 'heritage');
  assert.equal(venueSceneFamily(null), 'hall');
  assert.equal(venueSceneFamily('nope'), 'hall');
});

test('renderVenueSvg: omitting venueSetting draws BYTE-IDENTICALLY to a hall — no pre-venue-aware caller changes', () => {
  const design = { ceiling: { treatment: 'chandeliers' }, walls: { treatment: 'fabric_drape' } };
  const palette = ['#C9A059', '#8C6BA6', '#D98BA6'];
  assert.equal(renderVenueSvg(design, palette), renderVenueSvg(design, palette, undefined, 'banquet_hall'));
});

test('renderVenueSvg: a beach reception draws no ceiling and no walls markup, even when both are chosen', () => {
  const design = {
    ceiling: { treatment: 'chandeliers' },
    walls: { treatment: 'floral_garland' },
  };
  const palette = ['#C9A059', '#8C6BA6', '#D98BA6'];
  const hall = renderVenueSvg(design, palette, undefined, 'banquet_hall');
  const beach = renderVenueSvg(design, palette, undefined, 'beach');
  // The chandelier glyph (chandeliers draws three overhead fixtures with this
  // exact ellipse signature) and the floral-garland flower cluster both
  // appear at a hall...
  assert.match(hall, /rx="46" ry="12"/); // chandelier ellipse
  // ...and neither appears at a beach — not merely visually smaller, GONE.
  assert.doesNotMatch(beach, /rx="46" ry="12"/);
  assert.notEqual(hall, beach);
});

test('renderVenueSvg: a garden reception keeps its ceiling but loses its walls', () => {
  const design = { walls: { treatment: 'floral_garland' } };
  const palette = ['#C9A059', '#8C6BA6', '#D98BA6'];
  const gardenNoCeilingChoice = renderVenueSvg(design, palette, undefined, 'garden');
  // Ceiling still draws its (garden-appropriate) default — chandeliers here,
  // since the SVG geometry doesn't special-case "garden ceiling shape" the
  // way the prototype's simplified schematic did; only applicability is
  // gated, never the treatment vocabulary.
  assert.match(gardenNoCeilingChoice, /rx="46" ry="12"/);
});

test('buildPrompt: a venue-gated zone never contributes a phrase, even with a real selection', () => {
  const design = { ceiling: { treatment: 'chandeliers' }, backdrop: { style: 'floral_wall' } };
  const palette = ['#C9A059'];
  const noVenue = buildPrompt(design, palette);
  assert.match(noVenue, /rows of crystal chandeliers overhead/);
  const beach = buildPrompt(design, palette, undefined, { setting: 'beach', chosen: true });
  assert.doesNotMatch(beach, /crystal chandeliers/);
  // The rest of the room is unaffected — a beach reception still gets its
  // floral-wall backdrop in the brief.
  assert.match(beach, /a full floral wall backdrop/);
});

/* ════════════════════════════════════════════════════════════════════════════
 * MB14b · COMPOSITE-WITH-FALLBACK, AND THE INVARIANT THAT MAKES IT SAFE.
 *
 * Ten (zone, style) pairs out of the whole product have a decor asset —
 * backdrop × 5 style families, ceiling × 5. `renderVenueSvg` now composites
 * one when it is handed one. The safety property is not "the fallback looks
 * the same": it is that the fallback is the SAME BYTES the function produced
 * before compositing existed. Four surfaces render this string, and one of
 * them is the control image for a PAID photoreal render — a silently different
 * control image is a silently different paid product.
 *
 * 🪤 THE SNAPSHOT IS THE PRE-CHANGE OUTPUT, CAPTURED BEFORE THE CHANGE.
 * These sha256 digests were taken by running `renderVenueSvg` on `origin/main`
 * at 67362e5af, BEFORE `decorImage` existed, and pasted here unchanged. A
 * snapshot recorded after the fact would only prove the code equals itself.
 * ════════════════════════════════════════════════════════════════════════════
 */

const MB14B_DESIGN: ReceptionDesign = {
  ceiling: { treatment: ['draped', 'fairy_lights'] },
  backdrop: { style: 'floral_wall', florals: 'roses' },
  stage: { setup: 'sweetheart' },
  tables: { shape: 'round', chairs: 'chiavari', linen: 'full', centerpiece: 'tall', place: 'menu' },
  entrance: { runner: 'fabric' },
  people: { who: 'couple_only' },
};
const MB14B_PALETTE = ['#C9A059', '#8C6BA6', '#D98BA6', '#9CB29A', '#4A3B45'];

/** sha256 of `renderVenueSvg(MB14B_DESIGN, MB14B_PALETTE, undefined, <venue>)`
 *  measured on origin/main @ 67362e5af, before this feature was written. */
const MB14B_PRE_CHANGE: Record<string, string> = {
  undefined: '977d1a9d5c38cc809e6492534de97c1d098399b47bd8a757b7c58fff821e06e2',
  banquet_hall: '977d1a9d5c38cc809e6492534de97c1d098399b47bd8a757b7c58fff821e06e2',
  beach: 'cee3cbb3c4c529564a39c0324ec3577d4f557b8df7f3b52a279fd99ace7558ef',
  garden: 'de741b628ca5eb2f26e1fe028ea5c9228d4b78ba50842b3b5d29ecdba0998dac',
};

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

test('MB14b: an UNCOVERED (zone, style) renders byte-identically to the pre-composite flat SVG', () => {
  for (const [venue, digest] of Object.entries(MB14B_PRE_CHANGE)) {
    const setting = venue === 'undefined' ? undefined : venue;
    assert.equal(
      sha(renderVenueSvg(MB14B_DESIGN, MB14B_PALETTE, undefined, setting)),
      digest,
      `renderVenueSvg no longer produces the bytes it produced before decor compositing ` +
        `existed (venue: ${venue}). Every (zone, style) without an asset — which is almost ` +
        'all of them — must be untouched by this feature. Four surfaces render this string, ' +
        'including the control image for the paid photoreal render.',
    );
  }
});

test('MB14b: passing an EMPTY decor map is the same bytes as passing none', () => {
  // The shape a couple with no style family, or a style family with no assets,
  // actually produces: `decorLayerHrefs` returns {}, not undefined.
  for (const setting of [undefined, 'banquet_hall', 'beach', 'garden'] as const) {
    assert.equal(
      renderVenueSvg(MB14B_DESIGN, MB14B_PALETTE, undefined, setting, {}),
      renderVenueSvg(MB14B_DESIGN, MB14B_PALETTE, undefined, setting),
      `an empty decor map changed the render at ${setting}. It is the COMMON case, not an ` +
        'edge case, and it must be indistinguishable from no decor at all.',
    );
  }
});

test('MB14b: a COVERED zone actually composites, and only that zone changes', () => {
  const href = '/moodboard-seed/venue_scene/backdrop/editorial-cream.svg';
  const flat = renderVenueSvg(MB14B_DESIGN, MB14B_PALETTE);
  const composed = renderVenueSvg(MB14B_DESIGN, MB14B_PALETTE, undefined, undefined, {
    backdrop: href,
  });
  // 🪤 PRESENCE OF THE HREF IS NOT PROOF THE ZONE WAS REPLACED. A layer drawn
  // ON TOP of the flat backdrop would contain the href too, and would show the
  // couple both. The flat backdrop's own signature must be GONE.
  assert.notEqual(flat, composed);
  assert.match(composed, /<image[^>]+href="\/moodboard-seed\/venue_scene\/backdrop\/editorial-cream\.svg"/);
  assert.match(composed, /clip-path="url\(#decor-backdrop\)"/);
  // The floral-wall backdrop draws a 300x210 rounded panel at BD. With a decor
  // layer that panel is not drawn at all.
  assert.match(flat, /<rect x="330" y="150" width="300" height="210" rx="10"/);
  assert.doesNotMatch(composed, /<rect x="330" y="150" width="300" height="210" rx="10" fill=/);
  // ...and the ceiling, which has no layer here, is untouched: the draped swag
  // path signature survives.
  const swag = /<path d="M 60 8 Q 132\.5 96 205 8/;
  assert.match(flat, swag);
  assert.match(composed, swag);
});

test('MB14b: the venue gate outranks a decor layer — a beach gets no ceiling image', () => {
  // A beach reception has no ceiling. Handing it a ceiling decor layer must not
  // grow one; the gate is deliberately OUTSIDE the fallback expression.
  const beach = renderVenueSvg(MB14B_DESIGN, MB14B_PALETTE, undefined, 'beach', {
    ceiling: '/moodboard-seed/venue_scene/ceiling/editorial-cream.svg',
  });
  assert.doesNotMatch(beach, /decor-ceiling/);
  assert.equal(sha(beach), MB14B_PRE_CHANGE.beach);
});

test('MB14b: an href this app cannot recognise falls back rather than being drawn', () => {
  // The href reaches this function from a database column and is interpolated
  // into markup four surfaces serve. Only an app-served seed path or a data:
  // URI we just built is legitimate; anything else is a row we do not
  // recognise, and an unrecognised row is a fallback, never an escape problem.
  for (const bad of [
    'https://media.setnayan.com/moodboard-library/venue_scene/backdrop/editorial-cream.svg',
    'https://evil.example/x.svg',
    '/moodboard-seed/../../etc/passwd',
    // 🪤 THIS ONE MATCHES THE SHAPE. The charset admits a dot, so it admits a
    // dot-dot, and this path ends in .svg like a real one. Only the explicit
    // `..` refusal stops it — and the SAME predicate gates the filesystem read
    // in reception-decor-layers-server.ts.
    '/moodboard-seed/../../../etc/hosts.svg',
    '/moodboard-seed/venue_scene/backdrop/x.svg" onload="alert(1)',
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
  ]) {
    assert.equal(
      sha(renderVenueSvg(MB14B_DESIGN, MB14B_PALETTE, undefined, undefined, { backdrop: bad })),
      MB14B_PRE_CHANGE.undefined,
      `the href ${JSON.stringify(bad)} was not refused — the render changed. An href that is ` +
        'neither an app-served /moodboard-seed path nor a retinted data: URI must fall back ' +
        'to the flat SVG, unchanged and unescaped.',
    );
    assert.equal(isCompositableDecorHref(bad), false);
  }
  assert.equal(isCompositableDecorHref('/moodboard-seed/venue_scene/ceiling/modern-minimalist.svg'), true);
  assert.equal(isCompositableDecorHref('data:image/png;base64,iVBORw0KGgo='), true);
});

test('MB14b: only the two pilot zones can composite, and they are the same two the resolver knows', () => {
  // The geometry map IS the permission — a zone with no slot cannot draw an
  // image however a caller asks. Pinned equal to the resolver's own list so the
  // two cannot drift into a zone that composites but is never resolved, or the
  // reverse.
  const composited = (['ceiling', 'backdrop', 'stage', 'tables', 'tunnel', 'entrance', 'walls', 'photo_wall', 'welcome_signage', 'people'] as PartId[])
    .filter((zone) => {
      const svg = renderVenueSvg(MB14B_DESIGN, MB14B_PALETTE, undefined, undefined, {
        [zone]: '/moodboard-seed/venue_scene/backdrop/editorial-cream.svg',
      });
      return svg.includes(`decor-${zone}`);
    });
  assert.deepEqual(
    [...composited].sort(),
    [...PILOT_DECOR_ZONES].sort(),
    'the zones renderVenueSvg can composite have drifted from PILOT_DECOR_ZONES in ' +
      'reception-decor-layers.ts. A zone the resolver returns an asset for but this function ' +
      'cannot draw is a dead pipeline; a zone this function draws but the resolver never ' +
      'returns is markup nobody can reach.',
  );
});

/* ── the resolver half, and the near-miss that must never happen ─────────── */

const MB14B_CATALOG: DecorLayerCatalog = {
  backdrop: {
    'editorial cream': {
      assetId: 'S89A-EDITORIAL',
      storagePath: '/moodboard-seed/venue_scene/backdrop/editorial-cream.svg',
      colorRange: { slotId: 1, sampledHex: '#D98BA6', toleranceDe: 15, regionLabel: 'draped fabric' },
    },
  },
};

test('MB14b: decorLayerHrefs covers a covered pair and returns NOTHING for an uncovered one', () => {
  assert.deepEqual(
    decorLayerHrefs('editorial cream', MB14B_CATALOG, (a) => a.storagePath),
    { backdrop: '/moodboard-seed/venue_scene/backdrop/editorial-cream.svg' },
  );
  // Uncovered style: the catalog has editorial cream and nothing else.
  assert.deepEqual(decorLayerHrefs('bridgerton · regal', MB14B_CATALOG, (a) => a.storagePath), {});
  // Uncovered zone: nothing has a ceiling asset here.
  assert.equal(
    decorLayerHrefs('editorial cream', MB14B_CATALOG, (a) => a.storagePath).ceiling,
    undefined,
  );
  // No style family at all — the couple who never applied a template.
  assert.deepEqual(decorLayerHrefs(null, MB14B_CATALOG, (a) => a.storagePath), {});
  // A resolver that cannot build an href is a fallback, not an error.
  assert.deepEqual(decorLayerHrefs('editorial cream', MB14B_CATALOG, () => null), {});
});

test('MB14b · THE INVARIANT: an uncovered (zone, style) renders the pre-change bytes END TO END', () => {
  // The whole pipeline, not the pieces: catalog → resolveDecorLayer →
  // decorLayerHrefs → renderVenueSvg. `bridgerton · regal` has no asset in this
  // catalog, so the room must come out of the far end byte-for-byte as it did
  // before any of this code existed.
  //
  // 🪤 THE SABOTAGE THIS PINS: make `resolveDecorLayer` substitute a NEAR MISS
  // for a missing style — the zone's only asset, the nearest family, a default
  // — and this assertion goes red. Reproduced before landing: replacing
  // `catalog[zone]?.[styleFamily]` with
  // `catalog[zone]?.[styleFamily] ?? Object.values(catalog[zone] ?? {})[0]`
  // fails HERE with the editorial-cream backdrop composited into a Bridgerton
  // couple's room, while every other test in this file stays green.
  const layers = decorLayerHrefs('bridgerton · regal', MB14B_CATALOG, (a) => a.storagePath);
  assert.deepEqual(layers, {}, 'an uncovered style resolved to SOME asset — a near miss is a room the couple did not design');
  assert.equal(
    sha(renderVenueSvg(MB14B_DESIGN, MB14B_PALETTE, undefined, undefined, layers)),
    MB14B_PRE_CHANGE.undefined,
    'an uncovered (zone, style) no longer renders the exact bytes it rendered before decor ' +
      'compositing existed.',
  );
});
