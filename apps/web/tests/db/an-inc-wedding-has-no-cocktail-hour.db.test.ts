/**
 * AN INC WEDDING'S SEEDED SCHEDULE HAS NO COCKTAIL HOUR (P6a, 2026-10-01).
 *
 * Audit 2026-09-30 §3 footnote 20: `buildScheduleSeed` (lib/schedule.ts) knew
 * every rite's ceremony parts and INC's dance-free reception — and had no
 * caller. An empty wedding schedule filled from `SCHEDULE_TEMPLATES` instead,
 * the same for every faith, so an Iglesia ni Cristo couple (and a Muslim, LDS
 * or SDA couple) was handed "Cocktail hour" and "Dancing & open floor".
 *
 * This replays the real schema and WRITES what `loadScheduleTemplate` writes —
 * every template the menu offers that wedding (`templatesForEventType` with its
 * two rite columns), the ceremony's own day through the seed's two passes —
 * then reads the rows back. A Catholic wedding is the control: its day still
 * has the cocktail hour, so the test cannot pass by deleting the block for all.
 *
 * Sabotage (2026-10-01): emptying `DANCE_FREE_RITES` turns every dance-free
 * row red; dropping the secondary column from `riteIsDanceFree` turns the
 * mixed-with-INC row red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { buildScheduleSeed, type SeedCeremonyType } from '../../lib/schedule';
import {
  buildTemplateInsertRows,
  FAITH_TEMPLATE_ID,
  templatesForEventType,
} from '../../lib/schedule-templates';

let replay: ReplayResult;

before(async () => {
  replay = await createReplayedDb();
  await replay.db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(replay.db, null);
});

after(async () => {
  await replay?.db?.close?.();
});

type Rites = { ceremony_type: string; secondary_ceremony_type: string | null };

/** Every row each offered template would write for this wedding, as stored. */
async function seededDays(rites: Rites): Promise<Array<{ template: string; labels: string[]; types: string[] }>> {
  const db = replay.db;
  const out: Array<{ template: string; labels: string[]; types: string[] }> = [];
  for (const template of templatesForEventType('wedding', rites)) {
    const eventId = (
      await db.query<{ event_id: string }>(
        // A Muslim (or cultural) rite requires its sub-type (events_sub_type_required_when_muslim_or_cultural).
        `INSERT INTO public.events (display_name, event_type, ceremony_type, secondary_ceremony_type, ceremony_sub_type, venue_setting)
         VALUES ($1,'wedding',$2,$3,$4,'banquet_hall') RETURNING event_id`,
        [
          `${rites.ceremony_type}/${rites.secondary_ceremony_type ?? '-'}/${template.id}`,
          rites.ceremony_type,
          rites.secondary_ceremony_type,
          rites.ceremony_type === 'muslim' ? 'nikah' : null,
        ],
      )
    ).rows[0]!.event_id;

    if (template.id === FAITH_TEMPLATE_ID) {
      // The same two passes `loadScheduleTemplate` runs.
      const seed = buildScheduleSeed(rites.ceremony_type as SeedCeremonyType, '2026-12-12', rites);
      const ids: Record<string, string> = {};
      for (const { key, ...b } of seed.topLevel) {
        ids[key] = (
          await db.query<{ block_id: string }>(
            `INSERT INTO public.event_schedule_blocks (event_id, label, block_type, start_at, end_at, sort_order, is_public)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING block_id`,
            [eventId, b.label, b.block_type, b.start_at, b.end_at, b.sort_order, b.is_public],
          )
        ).rows[0]!.block_id;
      }
      for (const { parent_key, ...c } of seed.buildChildren({ ceremony: ids.ceremony ?? '', reception: ids.reception ?? '' })) {
        if (!ids[parent_key]) continue;
        await db.query(
          `INSERT INTO public.event_schedule_blocks (event_id, parent_block_id, label, block_type, start_at, end_at, sort_order, is_public)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [eventId, ids[parent_key], c.label, c.block_type, c.start_at, c.end_at, c.sort_order, c.is_public],
        );
      }
    } else {
      for (const r of buildTemplateInsertRows(template, '2026-12-12')) {
        await db.query(
          `INSERT INTO public.event_schedule_blocks (event_id, label, block_type, start_at, end_at, sort_order, is_public)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [eventId, r.label, r.block_type, r.start_at, r.end_at, r.sort_order, r.is_public],
        );
      }
    }

    const rows = (
      await db.query<{ label: string; block_type: string }>(
        `SELECT label, block_type::text AS block_type FROM public.event_schedule_blocks WHERE event_id = $1`,
        [eventId],
      )
    ).rows;
    out.push({ template: template.id, labels: rows.map((r) => r.label), types: rows.map((r) => r.block_type) });
  }
  return out;
}

const PARTY = /cocktail|dancing|dance|after party|open floor/i;

for (const rites of [
  { ceremony_type: 'inc', secondary_ceremony_type: null },
  { ceremony_type: 'muslim', secondary_ceremony_type: null },
  { ceremony_type: 'lds', secondary_ceremony_type: null },
  { ceremony_type: 'sda', secondary_ceremony_type: null },
  // A mixed wedding keeps BOTH rites — an INC side makes the day dance-free.
  { ceremony_type: 'mixed', secondary_ceremony_type: 'inc' },
] satisfies Rites[]) {
  test(`a ${rites.ceremony_type}${rites.secondary_ceremony_type ? `+${rites.secondary_ceremony_type}` : ''} wedding's seeded schedule has no cocktail hour, dancing or money dance`, async () => {
    const days = await seededDays(rites);
    assert.ok(days.some((d) => d.template === FAITH_TEMPLATE_ID), 'the ceremony’s own day is not offered');
    for (const d of days) {
      assert.ok(d.labels.length > 0, `${d.template} wrote nothing`);
      const party = d.labels.filter((l) => PARTY.test(l));
      assert.deepEqual(party, [], `${d.template} still seeds: ${party.join(', ')}`);
      assert.ok(!d.types.some((t) => ['cocktails', 'dancing', 'after_party'].includes(t)), `${d.template}: ${d.types.join(',')}`);
    }
  });
}

test('the control: a Catholic wedding’s day still has its cocktail hour and its dances', async () => {
  const days = await seededDays({ ceremony_type: 'catholic', secondary_ceremony_type: null });
  const faith = days.find((d) => d.template === FAITH_TEMPLATE_ID)!;
  assert.ok(faith.labels.includes('Cocktail Hour'));
  assert.ok(faith.labels.includes('Money dance'));
  assert.ok(days.find((d) => d.template === 'wedding_classic_full_day')!.labels.includes('Cocktail hour'));
});
