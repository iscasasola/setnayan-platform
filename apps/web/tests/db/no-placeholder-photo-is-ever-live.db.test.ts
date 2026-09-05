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

test('every live attire figure still carries a colour range, so the recolour has something to act on', async () => {
  // MB23 Part 1 turns attire recolour on by SELECTing these ranges. A figure
  // that is live with no range renders as an un-recolourable reference image —
  // which is the state the whole section was stuck in before MB23.
  const { rows } = await db.query<{ label: string; storage_path: string }>(
    `SELECT a.label, a.storage_path
       FROM public.moodboard_library_assets a
      WHERE a.asset_type = 'figure_attire'
        AND ${LIVE.replace(/\b(approved_at|retired_at)\b/g, 'a.$1')}
        AND NOT EXISTS (
          SELECT 1 FROM public.moodboard_asset_color_ranges c WHERE c.asset_id = a.asset_id
        )
      ORDER BY a.label`,
  );
  assert.deepEqual(
    rows,
    [],
    'A live attire figure has no tagged colour range, so its card cannot recolour:\n  ' +
      rows.map((r) => `${r.label} · ${r.storage_path}`).join('\n  ') +
      '\n\nTag it in the admin Color Range Manipulator, or seed a range alongside the asset.',
  );
});
