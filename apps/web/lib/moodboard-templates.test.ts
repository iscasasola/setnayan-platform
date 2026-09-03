/**
 * Theme TEMPLATE gallery — fill-empty-only semantics (Mood Board redesign
 * follow-up, 2026-09-03). The NON-NEGOTIABLE part: applying a template must
 * NEVER overwrite anything the couple already set — only fill what's
 * currently empty. These tests guard that invariant directly, without a
 * database, since mergeRolePalette/mergeReceptionDesign/mergeTheme are pure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeRolePalette,
  mergeReceptionDesign,
  mergeTheme,
  replaceRolePalette,
  replaceReceptionDesign,
  replaceTheme,
  emptyTemplateInspirationSlots,
  nextMoodboardStyleFamily,
  normalizeThemeTemplateQuery,
  summaryIsEmpty,
  MOODBOARD_MOOD_TAGS,
  MOODBOARD_STYLE_FAMILIES,
  THEME_TEMPLATE_MAX_LIMIT,
  THEME_TEMPLATE_MAX_OFFSET,
  THEME_TEMPLATE_PAGE_SIZE,
  type ApplyTemplateSummary,
} from './moodboard-templates';

// ── palette ──────────────────────────────────────────────────────────────

test('mergeRolePalette fills only unset keys, leaving saved colors untouched', () => {
  const current = { bride: ['#111111'] };
  const template = { bride: ['#FFFFFF'], groom: ['#000000'], reception: ['#AAAAAA'] };
  const { merged, filledKeys } = mergeRolePalette(current, template);
  assert.deepEqual(merged.bride, ['#111111'], "the couple's own bride color must survive");
  assert.deepEqual(merged.groom, ['#000000']);
  assert.deepEqual(merged.reception, ['#AAAAAA']);
  assert.deepEqual(filledKeys.sort(), ['groom', 'reception']);
});

test('mergeRolePalette is a no-op when every template key is already set', () => {
  const current = { bride: ['#111111'], groom: ['#222222'] };
  const template = { bride: ['#FFFFFF'], groom: ['#000000'] };
  const { merged, filledKeys } = mergeRolePalette(current, template);
  assert.deepEqual(merged, current);
  assert.deepEqual(filledKeys, []);
});

test('mergeRolePalette treats an empty saved array as unset', () => {
  const current = { bride: [] as string[] };
  const { merged, filledKeys } = mergeRolePalette(current, { bride: ['#FFFFFF'] });
  assert.deepEqual(merged.bride, ['#FFFFFF']);
  assert.deepEqual(filledKeys, ['bride']);
});

test('mergeRolePalette never touches room_dressing', () => {
  const current = { room_dressing: { linens: '#ABCDEF' } };
  const { merged, filledKeys } = mergeRolePalette(current, {
    // A template payload should never carry room_dressing, but even if one
    // did, it must not flow through this merge.
    room_dressing: { linens: '#000000' },
  } as never);
  assert.deepEqual(merged.room_dressing, { linens: '#ABCDEF' });
  assert.deepEqual(filledKeys, []);
});

// ── reception design ─────────────────────────────────────────────────────

test('mergeReceptionDesign fills only unset attributes within a part the couple partly set', () => {
  const current = { backdrop: { style: 'moon_gate' } };
  const template = { backdrop: { style: 'draped', florals: 'corner' } };
  const { merged, filledZones } = mergeReceptionDesign(current, template);
  assert.equal(merged.backdrop?.style, 'moon_gate', "the couple's own choice must survive");
  assert.equal(merged.backdrop?.florals, 'corner');
  assert.deepEqual(filledZones, ['backdrop.florals']);
});

test('mergeReceptionDesign fills a whole part the couple never touched', () => {
  const current = {};
  const template = { ceiling: { treatment: 'lanterns' } };
  const { merged, filledZones } = mergeReceptionDesign(current, template);
  assert.equal(merged.ceiling?.treatment, 'lanterns');
  assert.deepEqual(filledZones, ['ceiling.treatment']);
});

test('mergeReceptionDesign is a no-op once every zone is already set', () => {
  const current = { ceiling: { treatment: 'lanterns' } };
  const { merged, filledZones } = mergeReceptionDesign(current, { ceiling: { treatment: 'geometric' } });
  assert.equal(merged.ceiling?.treatment, 'lanterns');
  assert.deepEqual(filledZones, []);
});

// ── theme name / description ────────────────────────────────────────────

test('mergeTheme fills only the empty half of name/description', () => {
  const out = mergeTheme('My Own Theme', null, 'Template Name', 'Template description.');
  assert.equal(out.name, 'My Own Theme');
  assert.equal(out.description, 'Template description.');
  assert.equal(out.filledName, false);
  assert.equal(out.filledDescription, true);
});

test('mergeTheme treats an all-whitespace saved value as empty', () => {
  const out = mergeTheme('   ', '   ', 'Template Name', 'Template description.');
  assert.equal(out.name, 'Template Name');
  assert.equal(out.description, 'Template description.');
  assert.equal(out.filledName, true);
  assert.equal(out.filledDescription, true);
});

test('mergeTheme is a no-op when both are already set', () => {
  const out = mergeTheme('Mine', 'Mine too.', 'Template', 'Template desc.');
  assert.equal(out.name, 'Mine');
  assert.equal(out.description, 'Mine too.');
  assert.equal(out.filledName, false);
  assert.equal(out.filledDescription, false);
});

// ── inspiration slots ────────────────────────────────────────────────────

test('emptyTemplateInspirationSlots excludes slots the couple already occupied', () => {
  const occupied = new Set(['bride', 'overall']);
  const empty = emptyTemplateInspirationSlots(occupied);
  assert.ok(!empty.includes('bride'));
  assert.ok(empty.includes('groom'));
  assert.ok(empty.includes('entourage'));
});

// ── overall "nothing to fill" summary ────────────────────────────────────

test('summaryIsEmpty is true only when every fill list/flag is empty', () => {
  const nothing: ApplyTemplateSummary = {
    mode: 'fill_empty',
    filledPaletteRoles: [],
    filledReceptionZones: [],
    filledInspirationSlots: [],
    filledThemeName: false,
    filledThemeDescription: false,
  };
  assert.equal(summaryIsEmpty(nothing), true);
  assert.equal(summaryIsEmpty({ ...nothing, filledThemeName: true }), false);
  assert.equal(summaryIsEmpty({ ...nothing, filledPaletteRoles: ['bride'] }), false);
});

// ── replace_all mode (owner directive, 2026-09-03 follow-up) ─────────────

test('replaceRolePalette overwrites every template key regardless of current value', () => {
  const current = { bride: ['#111111'], groom: ['#222222'] };
  const template = { bride: ['#FFFFFF'], reception: ['#AAAAAA'] };
  const { merged, changedKeys } = replaceRolePalette(current, template);
  assert.deepEqual(merged.bride, ['#FFFFFF'], 'template value must WIN over the couple’s own');
  assert.deepEqual(merged.groom, ['#222222'], 'a key the template does not define is left alone');
  assert.deepEqual(merged.reception, ['#AAAAAA']);
  assert.deepEqual(changedKeys.sort(), ['bride', 'reception']);
});

test('replaceRolePalette never touches room_dressing or custom_roles', () => {
  const current = {
    room_dressing: { linens: '#ABCDEF' },
    custom_roles: [{ key: 'dog', label: 'Ring Bearer’s Dog', colors: ['#123456'] }],
  };
  const { merged, changedKeys } = replaceRolePalette(current, {
    room_dressing: { linens: '#000000' },
  } as never);
  assert.deepEqual(merged.room_dressing, { linens: '#ABCDEF' });
  assert.deepEqual(merged.custom_roles, current.custom_roles);
  assert.deepEqual(changedKeys, []);
});

test('replaceReceptionDesign overwrites every template zone, leaving zones the template is silent on untouched', () => {
  const current = { backdrop: { style: 'moon_gate' }, walls: { treatment: 'bare' } };
  const template = { backdrop: { style: 'draped', florals: 'corner' } };
  const { merged, changedZones } = replaceReceptionDesign(current, template);
  assert.equal(merged.backdrop?.style, 'draped', 'template value must WIN over the couple’s own');
  assert.equal(merged.backdrop?.florals, 'corner');
  assert.equal(merged.walls?.treatment, 'bare', 'a part the template never mentions is untouched');
  assert.deepEqual(changedZones.sort(), ['backdrop.florals', 'backdrop.style']);
});

test('replaceTheme always overwrites both name and description', () => {
  const out = replaceTheme('Template Name', 'Template description.');
  assert.equal(out.name, 'Template Name');
  assert.equal(out.description, 'Template description.');
});

// ── gallery fetch: whitelist + caps ──────────────────────────────────────
//
// This table is 2,600 rows. The action that reads it is the ONLY thing
// standing between a client-supplied string and a query, and between a
// client-supplied number and how many rows come back. Both are tested here.

test('normalizeThemeTemplateQuery accepts a real (family, mood) pair and defaults the page', () => {
  const q = normalizeThemeTemplateQuery({
    styleFamily: 'tropical heritage',
    moodTag: 'dark_moody',
  });
  assert.ok(q, 'a real pair must be accepted');
  assert.equal(q.styleFamily, 'tropical heritage');
  assert.equal(q.moodTag, 'dark_moody');
  assert.equal(q.limit, THEME_TEMPLATE_PAGE_SIZE);
  assert.equal(q.offset, 0);
});

test('normalizeThemeTemplateQuery accepts EVERY shipped taxonomy value', () => {
  for (const family of MOODBOARD_STYLE_FAMILIES) {
    for (const mood of MOODBOARD_MOOD_TAGS) {
      assert.ok(
        normalizeThemeTemplateQuery({ styleFamily: family, moodTag: mood }),
        `${family} × ${mood} must be accepted`,
      );
    }
  }
});

test('normalizeThemeTemplateQuery REJECTS a style family outside the vocabulary', () => {
  assert.equal(
    normalizeThemeTemplateQuery({ styleFamily: 'goth cathedral', moodTag: 'minimalist' }),
    null,
  );
  // Near-misses are the ones a whitelist has to catch: casing, whitespace, and
  // the SQL-ish payload that motivates a whitelist in the first place.
  assert.equal(
    normalizeThemeTemplateQuery({ styleFamily: 'Tropical Heritage', moodTag: 'minimalist' }),
    null,
    'the check is exact — a differently-cased near-match is not the value',
  );
  assert.equal(
    normalizeThemeTemplateQuery({ styleFamily: 'tropical heritage ', moodTag: 'minimalist' }),
    null,
  );
  assert.equal(
    normalizeThemeTemplateQuery({
      styleFamily: "tropical heritage' or '1'='1",
      moodTag: 'minimalist',
    }),
    null,
  );
});

test('normalizeThemeTemplateQuery REJECTS a mood tag outside the vocabulary', () => {
  assert.equal(
    normalizeThemeTemplateQuery({ styleFamily: 'modern minimalist', moodTag: 'spooky' }),
    null,
  );
  assert.equal(
    normalizeThemeTemplateQuery({ styleFamily: 'modern minimalist', moodTag: 'MINIMALIST' }),
    null,
  );
});

test('normalizeThemeTemplateQuery REJECTS a missing or non-string axis', () => {
  assert.equal(normalizeThemeTemplateQuery({ moodTag: 'minimalist' }), null);
  assert.equal(normalizeThemeTemplateQuery({ styleFamily: 'boho beach' }), null);
  assert.equal(normalizeThemeTemplateQuery({}), null);
  assert.equal(normalizeThemeTemplateQuery({ styleFamily: 7, moodTag: 'minimalist' }), null);
  assert.equal(
    normalizeThemeTemplateQuery({ styleFamily: 'boho beach', moodTag: { evil: true } }),
    null,
  );
});

test('normalizeThemeTemplateQuery CAPS limit — a client cannot ask for the table', () => {
  const huge = normalizeThemeTemplateQuery({
    styleFamily: 'boho beach',
    moodTag: 'minimalist',
    limit: 2600,
  });
  assert.ok(huge);
  assert.equal(huge.limit, THEME_TEMPLATE_MAX_LIMIT);
  assert.ok(THEME_TEMPLATE_MAX_LIMIT < 100, 'the cap must be a real ceiling, not decoration');

  for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, 'lots']) {
    const q = normalizeThemeTemplateQuery({
      styleFamily: 'boho beach',
      moodTag: 'minimalist',
      limit: bad,
    });
    assert.ok(q, `limit=${String(bad)} must clamp, not reject`);
    assert.ok(
      q.limit >= 1 && q.limit <= THEME_TEMPLATE_MAX_LIMIT,
      `limit=${String(bad)} clamped to ${q.limit}`,
    );
  }
});

test('normalizeThemeTemplateQuery clamps offset into range', () => {
  const past = normalizeThemeTemplateQuery({
    styleFamily: 'boho beach',
    moodTag: 'minimalist',
    offset: 9_999_999,
  });
  assert.ok(past);
  assert.equal(past.offset, THEME_TEMPLATE_MAX_OFFSET);

  const negative = normalizeThemeTemplateQuery({
    styleFamily: 'boho beach',
    moodTag: 'minimalist',
    offset: -12,
  });
  assert.ok(negative);
  assert.equal(negative.offset, 0);

  const fractional = normalizeThemeTemplateQuery({
    styleFamily: 'boho beach',
    moodTag: 'minimalist',
    offset: 6.9,
    limit: 6.9,
  });
  assert.ok(fractional);
  assert.equal(fractional.offset, 6, 'offsets are whole rows');
  assert.equal(fractional.limit, 6);
});

// ── style-family provenance ─────────────────────────────────────────────
//
// The decor-layer pilot resolves the flat SVG for a null style family, and
// nothing used to write one — so these two modes ARE the mechanism that makes
// the pilot reachable at all.

test('nextMoodboardStyleFamily · fill_empty writes only into a NULL', () => {
  assert.equal(
    nextMoodboardStyleFamily('fill_empty', null, 'tropical heritage'),
    'tropical heritage',
  );
  assert.equal(nextMoodboardStyleFamily('fill_empty', undefined, 'boho beach'), 'boho beach');
  assert.equal(
    nextMoodboardStyleFamily('fill_empty', '   ', 'boho beach'),
    'boho beach',
    'a blank string is not an established family',
  );
});

test('nextMoodboardStyleFamily · fill_empty leaves an established family alone', () => {
  assert.equal(
    nextMoodboardStyleFamily('fill_empty', 'moody garden', 'tropical heritage'),
    null,
    'null means "do not write" — the couple’s existing family must survive a fill',
  );
});

test('nextMoodboardStyleFamily · replace_all ALWAYS writes the template’s family', () => {
  assert.equal(
    nextMoodboardStyleFamily('replace_all', 'moody garden', 'industrial loft'),
    'industrial loft',
  );
  assert.equal(
    nextMoodboardStyleFamily('replace_all', null, 'industrial loft'),
    'industrial loft',
  );
});

test('nextMoodboardStyleFamily only ever returns a value the events CHECK accepts', () => {
  for (const family of MOODBOARD_STYLE_FAMILIES) {
    for (const mode of ['fill_empty', 'replace_all'] as const) {
      const out = nextMoodboardStyleFamily(mode, null, family);
      assert.ok(
        out !== null && (MOODBOARD_STYLE_FAMILIES as readonly string[]).includes(out),
        `${mode} → ${String(out)} must be in the shipped vocabulary`,
      );
    }
  }
});
