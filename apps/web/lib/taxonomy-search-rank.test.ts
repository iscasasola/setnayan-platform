/**
 * GUARD — the words a customer actually types must find the right shelf.
 *
 * This is the acceptance test for redesign Session 3 ("say the words people
 * actually type"). It runs against the REAL `TAXONOMY_MAP`, not a fixture, for
 * the same reason `no-service-lands-in-misc.db.test.ts` reads the live tree: a
 * hand-written list of expected services would drift exactly the way the thing
 * it guards drifts, and would go green while doing it.
 *
 * 🔑 THE REGRESSION THIS EXISTS FOR. Measured 2026-08-12, before the squashed
 * tier: the single word **"photobooth" returned ZERO results**. `photo_booth`
 * is stored as two words, so the startsWith, contains and snake tiers were all
 * blind to it — a customer typing it the way Filipinos write it got an empty
 * panel, with no error anywhere. An absence, not a failure. Same family as the
 * phantom column and the blocked iframe.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rankTaxonomyOptions, MIN_QUERY_LEN } from './taxonomy-search-rank';
import { TAXONOMY_MAP, WEDDING_FOLDER_SHORT_LABEL } from './taxonomy';

/**
 * Mirrors `taxonomyLabel` in app/(shell)/explore/page.tsx — the key→label derivation the
 * autocomplete list is actually built with. Kept in step by the folder
 * assertions below, which fail if a real service stops being reachable.
 */
const OVERRIDE: Record<string, string> = {
  pre_nup_photographer: 'Pre-Nup Photographer',
  pre_nup_shoot_locations: 'Pre-Nup Shoot Locations',
  setnayan_papic: 'Setnayan · Papic',
  setnayan_ai_edited_highlight: 'Setnayan · AI Highlight',
};
const labelFor = (key: string): string =>
  OVERRIDE[key] ??
  key
    .split('_')
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

type Opt = { key: string; label: string; folder: string };

const OPTIONS: Opt[] = Object.entries(TAXONOMY_MAP)
  .map(([key, meta]) => ({
    key,
    label: labelFor(key),
    folder: (meta as { folder: string }).folder,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

test('ANCHOR — the option list is real and non-trivial', () => {
  // Without this, every search assertion below could pass vacuously on [].
  assert.ok(
    OPTIONS.length > 100,
    `expected the real taxonomy (~276 services); got ${OPTIONS.length}. ` +
      `A shrunken list would make every assertion in this file meaningless.`,
  );
});

test('a query shorter than the minimum suggests nothing', () => {
  assert.deepEqual(rankTaxonomyOptions(OPTIONS, 'p'), []);
  assert.deepEqual(rankTaxonomyOptions(OPTIONS, ' '), []);
  assert.ok(MIN_QUERY_LEN === 2);
});

/**
 * The four terms named in the Session 3 done-criteria, plus videographer —
 * the second word buried inside `documentary` that sent nobody anywhere.
 */
const ACCEPTANCE: Array<{ typed: string; expectFolder: string }> = [
  { typed: 'photographer', expectFolder: 'documentary' },
  { typed: 'videographer', expectFolder: 'documentary' },
  { typed: 'caterer', expectFolder: 'feast' },
  { typed: 'emcee', expectFolder: 'program' },
  { typed: 'photobooth', expectFolder: 'booths' },
];

for (const { typed, expectFolder } of ACCEPTANCE) {
  test(`"${typed}" finds something, and it lives in ${expectFolder}`, () => {
    const rows = rankTaxonomyOptions(OPTIONS, typed);

    assert.ok(
      rows.length > 0,
      `typing "${typed}" returned NOTHING. A person searching a real word met ` +
        `an empty panel — the exact failure this session exists to remove.`,
    );

    const folders = rows.map((r) => r.folder);
    assert.ok(
      folders.includes(expectFolder),
      `"${typed}" surfaced ${JSON.stringify(
        rows.map((r) => `${r.label} (${r.folder})`),
      )} — none of them in "${expectFolder}" ` +
        `(${WEDDING_FOLDER_SHORT_LABEL[
          expectFolder as keyof typeof WEDDING_FOLDER_SHORT_LABEL
        ]}).`,
    );
  });
}

test('"photobooth" written as one word reaches Photo Booth itself', () => {
  // The precise regression. Not just "some booths result" — THE service.
  const rows = rankTaxonomyOptions(OPTIONS, 'photobooth');
  assert.ok(
    rows.some((r) => r.key === 'photo_booth'),
    `"photobooth" did not reach photo_booth. Got: ${JSON.stringify(
      rows.map((r) => r.key),
    )}`,
  );
});

test('spaced and squashed spellings both reach the same service', () => {
  const spaced = rankTaxonomyOptions(OPTIONS, 'photo booth');
  const squashed = rankTaxonomyOptions(OPTIONS, 'photobooth');
  assert.ok(spaced.some((r) => r.key === 'photo_booth'), '"photo booth" missed it');
  assert.ok(squashed.some((r) => r.key === 'photo_booth'), '"photobooth" missed it');
});

test('a real word match outranks a punctuation-blind one', () => {
  // "booth" is a genuine substring of the label (tier 3); the squashed tier (1)
  // must never jump above it, or the list stops reading in order of relevance.
  const rows = rankTaxonomyOptions(OPTIONS, 'booth');
  assert.ok(rows.length > 0, '"booth" returned nothing');
  assert.ok(
    rows[0]!.label.toLowerCase().includes('booth'),
    `top result for "booth" was "${rows[0]!.label}", which does not contain the word`,
  );
});

test('the suggestion list is capped', () => {
  const rows = rankTaxonomyOptions(OPTIONS, 'e', 8);
  assert.ok(rows.length <= 8);
  const many = rankTaxonomyOptions(OPTIONS, 'er', 8);
  assert.ok(many.length <= 8, `expected ≤8 suggestions, got ${many.length}`);
});

// ─────────────────────────────────────────────────────────────────────────
// ALIASES (C2, 2026-08-28) — "sorbetes", "sorbetero" and "ice cream cart"
// should all find a trade even when the word never appears in the label.
// ─────────────────────────────────────────────────────────────────────────

test('a word that appears in NO real option matches only through an alias', () => {
  // "sorbetero" is not a substring of any real taxonomy label — reproduces
  // the exact gap C2 exists to close, against the REAL 262-trade options.
  const withoutAlias = rankTaxonomyOptions(OPTIONS, 'sorbetero');
  assert.deepEqual(withoutAlias, [], 'fixture sanity: "sorbetero" already matched something by letters alone');

  const withAlias = OPTIONS.map((o) =>
    o.key === 'sorbetes_cart' ? { ...o, aliases: ['sorbetero'] } : o,
  );
  const rows = rankTaxonomyOptions(withAlias, 'sorbetero');
  assert.ok(
    rows.some((r) => r.key === 'sorbetes_cart'),
    `"sorbetero" with the alias attached still missed sorbetes_cart: ${JSON.stringify(rows)}`,
  );
});

test('an option with NO aliases field ranks byte-identically to before this field existed', () => {
  // Every option in OPTIONS has no `aliases` key at all — this is the
  // regression guard for the refactor from if/else-if to textTierScore+max.
  for (const q of ['photographer', 'photobooth', 'booth', 'caterer', 'zzz-nothing']) {
    const rows = rankTaxonomyOptions(OPTIONS, q);
    assert.deepEqual(
      rows.map((r) => r.key),
      rankTaxonomyOptions(OPTIONS.map((o) => ({ ...o, aliases: [] })), q).map((r) => r.key),
      `"${q}" ranked differently once every option carried an empty aliases array`,
    );
  }
});

test('an alias never resurrects a below-minimum-length query', () => {
  const withAlias = [{ key: 'sorbetes_cart', label: 'Sorbetes Cart', aliases: ['a'] }];
  assert.deepEqual(rankTaxonomyOptions(withAlias, 'a'), []);
});

test('a direct label match and an alias match on the SAME option do not double-count or crash', () => {
  const opt = [{ key: 'photo_booth', label: 'Photo Booth', aliases: ['pabati', 'photo booth'] }];
  const rows = rankTaxonomyOptions(opt, 'photo booth');
  assert.equal(rows.length, 1);
});

test('an alias match is still capped by `limit`, same as a label match', () => {
  const opts = Array.from({ length: 10 }, (_, i) => ({
    key: `k${i}`,
    label: `Unrelated ${i}`,
    aliases: ['sorbetero'],
  }));
  const rows = rankTaxonomyOptions(opts, 'sorbetero', 3);
  assert.equal(rows.length, 3);
});
