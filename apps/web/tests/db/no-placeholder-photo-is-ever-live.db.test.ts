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
 * MB25 · AND THE HONEST REPLACEMENT IS ACTUALLY THERE.
 *
 * 🪤 THE RULE IS "NO PLACEHOLDER IS LIVE", NOT "NO VENUE SCENE IS LIVE".
 * Between MB23 and MB25 those two were indistinguishable in the data: the only
 * `venue_scene` rows that had ever been live were the two picsum photographs,
 * so after MB23 retired them the live count was zero — and a guard written in
 * that window could easily have pinned the zero and called it the rule. It
 * would then have failed the moment we did the RIGHT thing. (Checked: the
 * assertions above pin placeholder-ness, never the count. Nothing needed
 * loosening for MB25; this test is the other direction.)
 *
 * Migration 20271206413595 seeds the real one — our own Recraft V4.1 vector,
 * app-served, two tagged regions. This asserts it arrives live and tagged,
 * because a migration that silently inserts nothing (a WHERE NOT EXISTS that
 * matches too eagerly, a rolled-back COMMIT) leaves every assertion above
 * green and the Ceremony card still absent.
 */
/**
 * MB26 · THE MEDIA.SETNAYAN.COM PILOT ROWS ARE RETIRED, NOT LIVE.
 *
 * The 2026-09-03 decor-layers pilot (migration 20271194970382) seeded ten
 * `venue_scene` rows pointing at `https://media.setnayan.com/...` — a host
 * that does not resolve, whose objects also 404 on the working `pub-…r2.dev`
 * host. Owner ruling 2026-09-05: "media.setnayan.com is not being set up
 * now." Migration 20271206504078 retires all ten. This is the OTHER half —
 * the guard that stops one coming back live, the same shape MB23's
 * placeholder assertion above takes for picsum/pexels.
 */
test('no LIVE moodboard_library_assets row is served from media.setnayan.com', async () => {
  const { rows } = await db.query<Row>(
    `SELECT asset_type, label, storage_path, source
       FROM public.moodboard_library_assets
      WHERE ${LIVE}
        AND storage_path ILIKE 'https://media.setnayan.com/%'
      ORDER BY asset_type, label`,
  );
  assert.deepEqual(
    rows,
    [],
    'A media.setnayan.com pilot row is live and a couple can see it:\n  ' +
      rows.map((r) => `${r.asset_type} · ${r.label} · ${r.source} · ${r.storage_path}`).join('\n  ') +
      '\n\nThat host does not resolve and its objects 404 on the working pub-…r2.dev host — ' +
      'the owner ruled 2026-09-05 the domain is not being set up. Retire the row (set ' +
      'retired_at) in a migration — never DELETE it.',
  );
});

/**
 * 🪤 THE ASSERTION ABOVE IS TRIVIALLY TRUE WITHOUT MIGRATION 20271206504078.
 * All ten pilot rows are `approved_at IS NULL` — never approved, so `LIVE`
 * (`approved_at IS NOT NULL AND retired_at IS NULL`) already excludes every
 * one of them regardless of `retired_at`. Deleting the migration's UPDATE
 * entirely leaves the test above green. This is the actual proof the
 * retirement ran: all ten still exist (never DELETEd) and now carry a
 * `retired_at`.
 */
test('MB26 · all ten media.setnayan.com pilot rows are RETIRED, not merely never-approved', async () => {
  const { rows } = await db.query<{ n: number; retired: number }>(
    `SELECT count(*)::int AS n, count(retired_at)::int AS retired
       FROM public.moodboard_library_assets
      WHERE asset_type = 'venue_scene'
        AND storage_path ILIKE 'https://media.setnayan.com/%'`,
  );
  assert.equal(rows[0]!.n, 10, `expected the ten pilot rows to still exist (retire, never delete), saw ${rows[0]!.n}`);
  assert.equal(
    rows[0]!.retired,
    10,
    `expected all ten media.setnayan.com pilot rows to carry retired_at, saw ${rows[0]!.retired} of ${rows[0]!.n}`,
  );
});

test('the Ceremony scene is live, app-served, and carries BOTH of its colour ranges', async () => {
  const { rows } = await db.query<{
    source: string | null;
    storage_path: string;
    slots: string;
  }>(
    `SELECT a.source, a.storage_path,
            (SELECT string_agg(c.slot_id || ':' || c.region_label || ':' || c.sampled_hex ||
                               ':' || c.tolerance_de, ' | ' ORDER BY c.slot_id)
               FROM public.moodboard_asset_color_ranges c
              WHERE c.asset_id = a.asset_id) AS slots
       FROM public.moodboard_library_assets a
      WHERE a.asset_type = 'venue_scene' AND ${LIVE}`,
  );
  assert.equal(
    rows.length,
    1,
    `expected exactly one live venue_scene (the MB25 Ceremony aisle), saw ${rows.length}. ` +
      'If it is 0, migration 20271206413595 did not insert — the Ceremony card is absent ' +
      'and the couple sees no ceremony space at all. If it is >1, a second scene was seeded ' +
      'and `findVenue` in page.tsx picks between them by row order.',
  );
  const row = rows[0]!;
  assert.ok(
    row.storage_path.startsWith('/moodboard-seed/'),
    `the Ceremony scene is served from ${row.storage_path}, not from our own app. It must be ` +
      'app-relative like the florals seed, so lib/moodboard-library-placeholder.ts reads no ' +
      'host on it and the MB23 write-side guard passes it.',
  );
  assert.equal(
    row.slots,
    '1:florals:#D98BA6:10 | 2:fabric:#E8D9B5:5',
    'the Ceremony scene\'s two colour ranges are not what migration 20271206413595 seeds. ' +
      'These values were MEASURED by pixel through the real `recolorRGBA` at the component\'s ' +
      'MAX_PREVIEW_PX — NOT converted from CIELAB ΔE, which disagrees sharply here (the floor ' +
      'is ΔE 14.4 from the fabric slot but only 5.1 in the engine\'s own metric, so a fabric ' +
      'tolerance of 6 already repaints the whole floor). Re-measure before changing one; the ' +
      'proof lives in _components/the-background-never-wears-the-palette.test.ts.',
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
  // ✅ EMPTIED BY MB24 — and emptied BY THIS GUARD, which is the point of it.
  //
  // The one entry this list ever held was `figure_attire/modern-minimalist/bride.svg`:
  // her gown was filled #ECEBE7, byte-identical (ΔE 0.0) to a full-canvas backdrop
  // path in the same file, so no (sampled_hex, tolerance) pair could select the
  // dress without the page behind it. MB23 deleted her range and recorded the
  // measurement here rather than shipping a row that claimed a region it could not
  // isolate.
  //
  // MB24 re-cut the artwork — the backdrop path removed, nothing else — moved the
  // row to `/moodboard-seed/figure_attire/modern-minimalist/bride.svg`, and gave
  // her `#ECEBE7 ± 16` in migration `20271206127987`. The test below then failed on
  // the stale entry and said, in as many words, to delete it. So it is deleted.
  //
  // The list is empty, not gone: every live attire figure now carries a range, and
  // the next asset that cannot be tagged has to earn its place here WITH a
  // measurement, exactly as the bride did.
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
    0,
    'The untaggable-asset list changed size. It is EMPTY as of MB24: exactly one asset ever ' +
      'earned a place on it (modern-minimalist/bride), and re-cutting her artwork retired the ' +
      'entry. Growing it means some of "In your colors" cannot show the couple their own ' +
      'colours — that is a product decision, not a test fixture, and it needs a measurement ' +
      'the way the bride had one.',
  );
});
