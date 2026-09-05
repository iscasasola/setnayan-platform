/**
 * MB23 · NO BRING-UP PLACEHOLDER MAY BE LIVE TO A COUPLE.
 *
 * Owner's bug report, 2026-09-05 (verbatim): "we do not have a design yet for
 * the palette and there are already samples on in your colors." One of the cards
 * they saw was labelled "Ceremony" and its asset was
 * `https://picsum.photos/seed/setnayan-church-1/1200/800` — a random stock
 * photograph, seeded during bring-up on 2026-05-31 and approved on 2026-05-22.
 *
 * Migration `20271205919528` retires it and its reception twin. This test is
 * what stops them, or a new one, coming back: it replays every migration in
 * order and asserts that after the last one, NO row is simultaneously approved,
 * un-retired, and a placeholder.
 *
 * It is a real guard, not a tautology — the replayed database genuinely contains
 * the 2026-05-31 seed's INSERTs, so removing the retirement UPDATE from the
 * migration turns this red. Verified by sabotage before this landed.
 *
 * The complementary write-side guard is `lib/moodboard-library-placeholder.ts`,
 * imported by `approveAsset`, which refuses to publish such a row in the first
 * place. Both halves are needed: this one is about rows that already exist, that
 * one is about the next click.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  if (!db) return;
  await db.close?.();
});

const LIVE = 'approved_at IS NOT NULL AND retired_at IS NULL';

type Row = { asset_type: string; label: string; storage_path: string; source: string | null };

test('no live moodboard_library_assets row is an internet_placeholder or a picsum photo', async () => {
  const { rows } = await db.query<Row>(
    `SELECT asset_type, label, storage_path, source
       FROM public.moodboard_library_assets
      WHERE ${LIVE}
        AND (source = 'internet_placeholder' OR storage_path ILIKE '%picsum.photos%')
      ORDER BY asset_type, label`,
  );
  assert.deepEqual(
    rows,
    [],
    'A bring-up placeholder is live and a couple can see it:\n  ' +
      rows.map((r) => `${r.asset_type} · ${r.label} · ${r.source} · ${r.storage_path}`).join('\n  ') +
      '\n\nThese are stock photographs, not our artwork, and the owner ruling of ' +
      '2026-09-05 is that "In your colors" shows RECOLOURED DRAWINGS ONLY. Retire the ' +
      'row (set retired_at) in a migration — never DELETE it; a seeded photo is never ' +
      'deleted (owner decisions, 2026-09-04). If a new seed introduced it, the seed is ' +
      'the bug.',
  );
});

test('the retirement HID the placeholders rather than deleting them', async () => {
  // The other direction. Making the assertion above pass with a DELETE would be
  // a silent breach of the never-delete-a-seeded-photo rule, and would take the
  // history of what we once shipped with it.
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM public.moodboard_library_assets
      WHERE source = 'internet_placeholder' OR storage_path ILIKE '%picsum.photos%'`,
  );
  assert.ok(
    (rows[0]?.n ?? 0) > 0,
    'Every placeholder row has vanished from moodboard_library_assets. They are ' +
      'supposed to be RETIRED (retired_at set), not deleted — the row is the record ' +
      'that we once shipped a stock photograph here.',
  );
});

test('retiring the placeholders did not retire anything else', async () => {
  // A `SET retired_at = NOW()` with a wrong or missing WHERE would pass both
  // assertions above while emptying the library. The florals are the one card
  // type in "In your colors" that recoloured honestly before MB23 touched
  // anything; the attire figures are the eight cards MB23 makes recolourable.
  const { rows } = await db.query<{ asset_type: string; n: number }>(
    `SELECT asset_type, count(*)::int AS n
       FROM public.moodboard_library_assets
      WHERE ${LIVE}
      GROUP BY asset_type
      ORDER BY asset_type`,
  );
  const byType = Object.fromEntries(rows.map((r) => [r.asset_type, r.n]));
  assert.ok(
    (byType.figure_attire ?? 0) > 0,
    `the attire figures must stay live — "In your colors" is 8 attire cards. Saw: ${JSON.stringify(byType)}`,
  );
  assert.ok(
    (byType.florals ?? 0) > 0,
    `the florals must stay live — the Bouquet card is one of them. Saw: ${JSON.stringify(byType)}`,
  );
});

/**
 * Assets we have DELIBERATELY refused to tag, with the measurement that justifies it.
 *
 * ⚠ THIS LIST IS NOT A MUTE BUTTON. Adding a row here is a claim that the asset
 * CANNOT be tagged, not that tagging it is inconvenient — and the second test
 * below fails if the claim stops being true, so a stale entry is as loud as a
 * missing one.
 */
const UNTAGGABLE: ReadonlyArray<{ pathSuffix: string; because: string }> = [
  {
    pathSuffix: 'figure_attire/modern-minimalist/bride.svg',
    because:
      'The gown is filled with #ECEBE7 — byte-identical (ΔE 0.0) to the file\'s own background ' +
      'rect, across 76.6% of the figure column, measured 2026-09-05 on a 520px raster. To ' +
      '`recolorRGBA` the dress and the backdrop are ONE region: every (sampled_hex, tolerance) ' +
      'pair catches both or neither. Migration 20271205919528 deletes the range rather than ' +
      'leave a plausible-looking row claiming a region that cannot be isolated, and page.tsx ' +
      'prefers a bride variant that HAS one. Fix is to re-cut the artwork, not to re-tag it. ' +
      'Proof lives in _components/the-background-never-wears-the-palette.test.ts.',
  },
];

test('every live attire figure carries a colour range, except the ones we documented as untaggable', async () => {
  // 🪤 THIS ASSERTION WAS WRONG WHEN FIRST WRITTEN, AND CI CAUGHT IT.
  // It read "every live attire figure still carries a colour range" — full stop —
  // and it was written BEFORE the bride was measured. The same PR then deleted her
  // range on purpose. Two halves of one change asserting opposite things; it passed
  // locally only because it was never re-run after the migration changed.
  //
  // The lesson is not "loosen the guard". It is that the rule always had an
  // exception clause and nobody had needed it yet, so the honest shape is an
  // explicit, reasoned, SHRINKING list — never a softened predicate.
  const { rows } = await db.query<{ label: string; storage_path: string }>(
    `SELECT a.label, a.storage_path
       FROM public.moodboard_library_assets a
      WHERE a.asset_type = 'figure_attire'
        AND a.approved_at IS NOT NULL
        AND a.retired_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.moodboard_asset_color_ranges c WHERE c.asset_id = a.asset_id
        )
      ORDER BY a.storage_path`,
  );
  const unexplained = rows.filter(
    (r) => !UNTAGGABLE.some((u) => r.storage_path.endsWith(u.pathSuffix)),
  );
  assert.deepEqual(
    unexplained,
    [],
    'A live attire figure has no tagged colour range, so its card cannot recolour:\n  ' +
      unexplained.map((r) => `${r.label} · ${r.storage_path}`).join('\n  ') +
      '\n\nTag it in the admin Color Range Manipulator, or seed a range alongside the asset. ' +
      'If it genuinely cannot be tagged — measure first, the way the bride was — add it to ' +
      'UNTAGGABLE above WITH the measurement, and never without one.',
  );
});

test('each documented exception is still real — a re-tagged asset must leave the list', async () => {
  // The other direction, and the reason the list above cannot rot quietly. If
  // someone re-cuts the artwork and tags it, the exception becomes a lie that
  // would hide the NEXT untagged figure behind the same path.
  for (const u of UNTAGGABLE) {
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM public.moodboard_asset_color_ranges c
         JOIN public.moodboard_library_assets a USING (asset_id)
        WHERE a.storage_path LIKE '%' || $1`,
      [u.pathSuffix],
    );
    assert.equal(
      rows[0]?.n ?? 0,
      0,
      `${u.pathSuffix} now HAS a colour range, so it is no longer untaggable and its entry in ` +
        `UNTAGGABLE is stale — delete it.\n\nThe recorded reason was:\n  ${u.because}\n\n` +
        'If the range was added back without re-cutting the artwork, it is the range that is ' +
        'wrong, not this test: see _components/the-background-never-wears-the-palette.test.ts.',
    );
  }
});

test('the exception list has not grown', async () => {
  // An anchor on the COUNT, so widening the escape hatch is a deliberate,
  // reviewable edit rather than one more line nobody notices.
  assert.equal(
    UNTAGGABLE.length,
    1,
    'The untaggable-asset list changed size. Exactly one asset has ever earned a place on it ' +
      '(modern-minimalist/bride). Growing it means more of "In your colors" cannot show the ' +
      "couple their own colours — that is a product decision, not a test fixture.",
  );
});
