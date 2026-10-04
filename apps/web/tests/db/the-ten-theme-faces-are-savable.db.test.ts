/**
 * THE TEN THEME FACES ARE FACES A COUPLE CAN SAVE — proved against the full
 * replayed schema (owner 2026-10-04, "Yes to both"; migration 20271263752844).
 *
 * `events.site_font_key` is the Event Hub-wide typeface the Look › Font dropdown
 * writes. Its CHECK is the database's half of `lib/hub-fonts.ts` HUB_FONT_KEYS:
 * a key the dropdown offers but the CHECK refuses is a Font pick that silently
 * fails to save at Apply.
 *
 * Not vacuous: every key in the app's list is written and read back (so a CHECK
 * that dropped one, or a list that grew a key the CHECK lacks, fails here), and
 * an unknown key — plus a near-miss spelling of a new one — must still be
 * refused, so a CHECK that vanished would fail too.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { HUB_FONT_KEYS } from '../../lib/hub-fonts';

let replay: ReplayResult;
let db: PGlite;

const EVENT = '7e17e17e-7e17-47e1-87e1-7e17e17e17e1';
const TEN = ['lora', 'baskerville', 'crimson', 'josefin', 'kaushan', 'alexbrush', 'parisienne', 'cookie', 'delafield', 'monoton'] as const;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.query(
    `INSERT INTO events (event_id, slug, display_name, event_type)
     VALUES ($1, 'ten-theme-faces-fixture', 'Ten Theme Faces Fixture', 'birthday')
     ON CONFLICT DO NOTHING`,
    [EVENT],
  );
});
after(async () => {
  await db?.close();
});

async function save(key: string | null): Promise<string | null> {
  const r = await db.query<{ site_font_key: string | null }>(
    `UPDATE events SET site_font_key = $2 WHERE event_id = $1 RETURNING site_font_key`,
    [EVENT, key],
  );
  assert.equal(r.rows.length, 1, 'the fixture event was not updated, so the case proved nothing');
  return r.rows[0]!.site_font_key;
}

test('⭐ each of the ten theme faces is a valid site_font_key', async () => {
  for (const k of TEN) {
    assert.ok((HUB_FONT_KEYS as readonly string[]).includes(k), `${k} is offered by lib/hub-fonts.ts`);
    assert.equal(await save(k), k, `${k} saves and reads back`);
  }
});

test('⭐ every key the dropdown offers is one the database accepts — none left behind', async () => {
  assert.ok(HUB_FONT_KEYS.length >= 45, `precondition: the full list (${HUB_FONT_KEYS.length})`);
  for (const k of HUB_FONT_KEYS) assert.equal(await save(k), k, `${k} is refused by the CHECK`);
  // NULL is "the theme's own face" and must stay legal.
  assert.equal(await save(null), null);
});

test('⛔ an unknown key is still refused — including a near miss of a new one', async () => {
  for (const junk of ['comic-sans', 'Lora', 'lora ', 'librebaskerville', 'josefinsans', 'mrssaintdelafield']) {
    assert.ok(!(HUB_FONT_KEYS as readonly string[]).includes(junk), `precondition: ${junk} is not offered`);
    await assert.rejects(save(junk), /events_site_font_key_check|check constraint/i, `${junk} must be refused`);
  }
});
