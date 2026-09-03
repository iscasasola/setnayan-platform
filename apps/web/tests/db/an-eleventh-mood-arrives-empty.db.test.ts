/**
 * The eleventh mood — `festive_celebratory` — widens the taxonomy WITHOUT
 * touching a single seeded row, and both halves of that need proving.
 *
 * ── WHY A DB TEST AND NOT JUST THE UNIT TESTS ──────────────────────────────
 * `lib/theme-text-intent.test.ts` proves the app vocabulary carries the mood
 * and that the reader can emit it. It cannot prove the DATABASE will accept a
 * row carrying it — that lives in a CHECK constraint, and a CHECK that failed
 * to widen produces a green test suite and a 23514 the first time anybody
 * seeds a festive theme. The two halves are only useful together.
 *
 * ── THE OTHER HALF: IT ARRIVES EMPTY, ON PURPOSE ───────────────────────────
 * Regenerating the 2,500 rows in the committed seed migration (20271196372720)
 * to populate the new mood is a SEPARATE OWNER DECISION. So this test also
 * pins the fact that nothing was quietly regenerated: 2,600 rows, ten moods,
 * and zero rows on the eleventh. If a future change does populate it — which
 * is the healthy end state — this test says so out loud and asks to be
 * updated, rather than letting the seed drift silently under the taxonomy.
 *
 * ⚠ The empty mood is exactly why `ThemeTemplatePage.moodTotal` exists: the
 * gallery must say "we haven't designed any themes with that feeling yet"
 * rather than drawing an empty grid ten times, once per style family.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { MOODBOARD_MOOD_TAGS } from '../../lib/moodboard-templates';
import { ALL_MOOD_TAGS } from '../../lib/moodboard-theme-generator';

let db: PGlite;
let replay: ReplayResult;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
}, { timeout: 600_000 });

after(async () => {
  await db?.close();
});

test('the mood_tag CHECK is the _v3 one, and the older names are gone', async () => {
  const current = await db.query<{ def: string }>(
    `select pg_get_constraintdef(oid) as def
       from pg_constraint
      where conname = 'moodboard_theme_templates_mood_tag_check_v3'`,
  );
  assert.equal(current.rows.length, 1, 'the _v3 mood_tag CHECK did not apply');

  // Every mood the APP offers must be a value the TABLE accepts. Anything the
  // vocabulary carries and the constraint does not is a row that cannot be
  // written — the exact gap this test exists to close.
  for (const mood of MOODBOARD_MOOD_TAGS) {
    assert.ok(
      current.rows[0]!.def.includes(`'${mood}'`),
      `mood "${mood}" is in MOODBOARD_MOOD_TAGS but not in the CHECK constraint`,
    );
  }

  // A superseded CHECK left behind would keep rejecting the new value while
  // the _v3 one accepted it — two constraints, one column, and the stricter
  // wins silently.
  const superseded = await db.query<{ conname: string }>(
    `select conname from pg_constraint
      where conname in (
        'moodboard_theme_templates_mood_tag_check',
        'moodboard_theme_templates_mood_tag_check_v2'
      )`,
  );
  assert.deepEqual(superseded.rows, [], 'an older mood_tag CHECK survived the widening');
});

test('a festive_celebratory row is ACCEPTED; an invented mood is REJECTED', async () => {
  // The positive case alone would pass against a constraint that was dropped
  // and never re-added, so the negative case is the half that has teeth.
  await db.query(
    `insert into public.moodboard_theme_templates
       (style_family, mood_tag, name, description, role_palette, reception_design, sort_order)
     values ('modern minimalist', 'festive_celebratory', 'probe', 'probe',
             '{}'::jsonb, '{}'::jsonb, 1)`,
  );

  await assert.rejects(
    db.query(
      `insert into public.moodboard_theme_templates
         (style_family, mood_tag, name, description, role_palette, reception_design, sort_order)
       values ('modern minimalist', 'not_a_real_mood', 'probe2', 'probe2',
               '{}'::jsonb, '{}'::jsonb, 2)`,
    ),
    /violates check constraint/,
    'the CHECK is not actually constraining mood_tag',
  );

  // Leave the table as we found it — the counts below are the point.
  await db.query(`delete from public.moodboard_theme_templates where name = 'probe'`);
});

test('widening the taxonomy changed NO seeded row — the eleventh mood is empty', async () => {
  const total = await db.query<{ n: number }>(
    `select count(*)::int as n from public.moodboard_theme_templates`,
  );
  assert.equal(total.rows[0]!.n, 2600, 'the seed row count moved');

  const byMood = await db.query<{ mood_tag: string; n: number }>(
    `select mood_tag, count(*)::int as n
       from public.moodboard_theme_templates
      group by 1 order by 1`,
  );
  const present = byMood.rows.map((r) => r.mood_tag);

  // Exactly the moods the GENERATOR generated — no more, no fewer.
  assert.deepEqual(
    present.slice().sort(),
    [...ALL_MOOD_TAGS].sort(),
    'the moods in the seeded table no longer match the generator’s own list',
  );

  const festive = byMood.rows.find((r) => r.mood_tag === 'festive_celebratory');
  assert.equal(
    festive,
    undefined,
    `festive_celebratory now has ${festive?.n} seeded themes. If that is intended, this is the ` +
      `owner decision to regenerate the seed — update ALL_MOOD_TAGS in ` +
      `lib/moodboard-theme-generator.ts and this test together.`,
  );
});
