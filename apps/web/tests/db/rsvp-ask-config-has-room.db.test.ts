/**
 * 📏 `events.rsvp_ask_config` HAS ROOM FOR ADDED LINES, ORDER AND GROUPS — measured against the replayed migrations
 * (migration 20271267092468; owner, asked "Shall I include that database change in the next batch?": "yes").
 *
 * The app refuses a save by its JSON bytes (`RSVP_CONFIG_ROOM`); the database refuses by `pg_column_size` of the
 * value AS STORED (`RSVP_CONFIG_CHECK`). The two count different things, and the stored form is the bigger one —
 * so neither number may be chosen by arithmetic on the other. This file MEASURES, in the real schema:
 *
 *   1. the worst config the app's own shape allows (built from the lib's own lists and caps —
 *      `rsvp-ask-config-worst.ts`) fits the app's room AND is taken by the real CHECK;
 *   2. the worst stored-to-JSON RATIO (a config that is all structure) stays at or under the ratio the app's room
 *      was set by — so any config the app lets through, the database lets through;
 *   3. the CHECK still refuses: a value over the limit, and a value that is not an object;
 *   4. 🩹 THE REASON FOR THE MIGRATION, AS A MEASUREMENT — on the numbers that were live until it (1,900 / 2,048):
 *      a config the app's old rule PASSED that the old CHECK REFUSED. It is taken now;
 *   5. 🪤 the trap that would have set the limit thirteen times too low: reading the stored column back gives the
 *      COMPRESSED size; a CHECK sees the value before it is compressed.
 *
 * SABOTAGE (run 2026-10-10 while writing this — each restored after):
 *   · the migration's 24576 → 16384: test 1 red (the worst case is refused by the CHECK);
 *   · `RSVP_CONFIG_ROOM` 19000 → 23000 in lib/rsvp-look.ts: tests 1 and 2 red (the room no longer stays under the check).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { RSVP_CONFIG_CHECK, RSVP_CONFIG_ROOM, RSVP_CONFIG_STORED_OVER, RSVP_CONFIG_STORED_RATIO, rsvpConfigBytes, rsvpConfigFits } from '@/lib/rsvp-look';
import { jsonBytes, worstRsvpAskConfig } from './rsvp-ask-config-worst';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let seq = 0;

/** Try to keep `config` on a fresh event, under the REAL constraint. True: taken. */
async function taken(config: unknown): Promise<boolean> {
  try {
    await db.query(
      `INSERT INTO public.events (display_name, event_type, event_date, slug, rsvp_ask_config)
       VALUES ('Room for lines', 'birthday', '2027-06-06', $1, $2::jsonb)`,
      [`rsvp-room-${seq++}`, JSON.stringify(config)],
    );
    return true;
  } catch (e) {
    const err = e as { code?: string; constraint?: string; message?: string };
    /* Only the constraint under test may be the refusal — anything else is a broken fixture, not an answer. */
    assert.equal(err.code, '23514', `the insert failed for another reason: ${err.message}`);
    assert.match(String(err.constraint ?? err.message), /events_rsvp_ask_config_shape/);
    return false;
  }
}

/** What a CHECK sees for this value: `pg_column_size` of the jsonb before it is stored (never compressed). */
async function storedBytes(config: unknown): Promise<number> {
  const { rows } = await db.query<{ n: number }>(`SELECT pg_column_size($1::jsonb)::int AS n`, [JSON.stringify(config)]);
  return rows[0]!.n;
}

/** The limit the live constraint carries, read from the catalogue — never from the migration's text. */
async function liveLimit(): Promise<number> {
  const { rows } = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
      WHERE c.conrelid = 'public.events'::regclass AND c.conname = 'events_rsvp_ask_config_shape'`,
  );
  const m = /pg_column_size\(rsvp_ask_config\) <= (\d+)/.exec(rows[0]?.def ?? '');
  assert.ok(m, `the constraint is not the size check: ${rows[0]?.def}`);
  return Number(m[1]);
}

test('0 · the replayed constraint carries the number the app believes', async () => {
  assert.equal(await liveLimit(), RSVP_CONFIG_CHECK);
});

test('1 · the worst config the app’s own shape allows fits the app’s room and is taken by the database', async () => {
  const table: Record<string, { json: number; stored: number }> = {};
  for (const [name, opts] of Object.entries({
    'every text at its cap, 3 bytes a character': { ch: '漢' },
    'every text at its cap, 2 bytes a character': { ch: 'ñ' },
    'every text at its cap, plain letters': { ch: 'a' },
    'added pictures instead of messages': { ch: '漢', kind: 'p' },
  } as const)) {
    const config = worstRsvpAskConfig(opts);
    const json = jsonBytes(config);
    const stored = await storedBytes(config);
    table[name] = { json, stored };
    assert.equal(json, rsvpConfigBytes(config), 'the fixture and the app count JSON differently');
    assert.ok(json <= RSVP_CONFIG_ROOM, `${name}: ${json} JSON bytes is over the app’s room (${RSVP_CONFIG_ROOM}) — a couple would be refused for using every control`);
    assert.equal(rsvpConfigFits(config), true);
    assert.ok(stored <= RSVP_CONFIG_CHECK, `${name}: ${stored} stored bytes is over the database’s limit (${RSVP_CONFIG_CHECK})`);
    /* For the app's own shape the stored form outweighs its JSON by a BOUNDED amount (its structure) — the bound the
       app's room is held to: room + bound stays under the check. */
    assert.ok(stored - json <= RSVP_CONFIG_STORED_OVER, `${name}: stored is ${stored - json} bytes over its JSON — more than the ${RSVP_CONFIG_STORED_OVER} the room allows for`);
    assert.equal(await taken(config), true, `${name}: the app would save it and the database refused it`);
  }
  assert.ok(RSVP_CONFIG_ROOM + RSVP_CONFIG_STORED_OVER <= RSVP_CONFIG_CHECK, 'the app’s room plus what storing adds is over the database’s limit');
  console.log('# measured (JSON bytes → stored bytes):', JSON.stringify(table));
});

test('2 · whatever the app lets through, the database lets through — the worst stored-to-JSON ratio is under the one the room was set by', async () => {
  /* A config that is ALL structure: jsonb spends four bytes on every key and value, so this is where the stored form
     outgrows the JSON the most. */
  const config = worstRsvpAskConfig({ text: false });
  const json = jsonBytes(config);
  const stored = await storedBytes(config);
  const ratio = stored / json;
  console.log(`# worst ratio: ${json} JSON bytes → ${stored} stored (×${ratio.toFixed(3)})`);
  assert.ok(ratio <= RSVP_CONFIG_STORED_RATIO, `the stored form is ×${ratio.toFixed(3)} its JSON — over the ×${RSVP_CONFIG_STORED_RATIO} the app’s room was set by`);
  assert.ok(RSVP_CONFIG_ROOM * RSVP_CONFIG_STORED_RATIO < RSVP_CONFIG_CHECK, 'the app’s room, at the worst ratio, is over the database’s limit');
  /* …and at the very edge of the room: the structure-heaviest config padded (with more structure, under a key the
     app carries but does not read) to the last bytes the app would still save. */
  const edge = { ...config, look: { ...(config.look as Record<string, unknown>) } as Record<string, unknown> };
  for (let k = 0; ; k++) {
    const next = { ...edge.look, [`x${k}`]: (config.look as { lines: unknown }).lines };
    if (jsonBytes({ ...edge, look: next }) > RSVP_CONFIG_ROOM) break;
    edge.look = next;
  }
  assert.ok(jsonBytes(edge) <= RSVP_CONFIG_ROOM && jsonBytes(edge) > RSVP_CONFIG_ROOM - 4000, 'the edge fixture is not at the edge');
  assert.equal(rsvpConfigFits(edge), true);
  console.log(`# at the room’s edge: ${jsonBytes(edge)} JSON bytes → ${await storedBytes(edge)} stored`);
  assert.equal(await taken(edge), true, 'a config the app saves is refused by the database');
});

test('3 · the CHECK still refuses — a value over the limit, and a value that is not an object', async () => {
  const over = { look: { later: 'x'.repeat(RSVP_CONFIG_CHECK) } };
  assert.ok((await storedBytes(over)) > RSVP_CONFIG_CHECK);
  assert.equal(rsvpConfigFits(over), false, 'the app would save what the database refuses');
  assert.equal(await taken(over), false);
  assert.equal(await taken('not an object'), false);
  assert.equal(await taken([1, 2, 3]), false);
  /* …and NULL and {} — "nothing changed" — are still taken. */
  assert.equal(await taken({}), true);
  await db.query(`INSERT INTO public.events (display_name, event_type, event_date, slug) VALUES ('No config', 'birthday', '2027-06-06', $1)`, [`rsvp-room-${seq++}`]);
});

test('4 · 🩹 why the migration: on the numbers live until it (1,900 / 2,048), the app passed a config the database refused', async () => {
  const OLD_ROOM = 1900;
  const OLD_CHECK = 2048;
  /* Steps 1–4 as shipped: every line and card given a font, a colour, a size and a Build in — and no added line. */
  const styled = worstRsvpAskConfig({ text: false, added: 0, groups: 0 });
  /* A couple a little short of "everything": two lines left as the page's own. */
  const lines = { ...(styled.look as { lines: Record<string, unknown> }).lines };
  delete lines['nonote.heading'];
  delete lines['nonote.message'];
  const config = { ...styled, look: { ...(styled.look as Record<string, unknown>), lines } };
  const json = jsonBytes(config);
  const stored = await storedBytes(config);
  console.log(`# the live fault: ${json} JSON bytes (old app rule: ≤ ${OLD_ROOM} passes) → ${stored} stored (old CHECK: ≤ ${OLD_CHECK})`);
  assert.ok(json <= OLD_ROOM, `the fixture (${json}) would not have passed the app’s old rule`);
  assert.ok(stored > OLD_CHECK, `the fixture (${stored}) would not have been refused by the old CHECK`);
  /* The old constraint, verbatim (migration 20271247938209), on a table of its own: it REFUSES this value. */
  await db.exec(`
    CREATE TEMP TABLE old_rsvp_room (rsvp_ask_config JSONB,
      CONSTRAINT old_shape CHECK (
        rsvp_ask_config IS NULL
        OR (jsonb_typeof(rsvp_ask_config) = 'object' AND pg_column_size(rsvp_ask_config) <= 2048)
      ));
  `);
  await assert.rejects(
    () => db.query(`INSERT INTO old_rsvp_room VALUES ($1::jsonb)`, [JSON.stringify(config)]),
    (e: { code?: string }) => e.code === '23514',
    'the old CHECK took it — the fault this migration is for is not reproduced',
  );
  /* Today: the app passes it, and so does the database. */
  assert.equal(rsvpConfigFits(config), true);
  assert.equal(await taken(config), true);
});

test('5 · 🪤 the stored column reads back COMPRESSED — a limit set from it would be far too low', async () => {
  const config = worstRsvpAskConfig({ ch: '漢' });
  const seen = await storedBytes(config);
  const slug = `rsvp-room-${seq++}`;
  await db.query(
    `INSERT INTO public.events (display_name, event_type, event_date, slug, rsvp_ask_config) VALUES ('Read back', 'birthday', '2027-06-06', $1, $2::jsonb)`,
    [slug, JSON.stringify(config)],
  );
  const { rows } = await db.query<{ n: number }>(`SELECT pg_column_size(rsvp_ask_config)::int AS n FROM public.events WHERE slug = $1`, [slug]);
  console.log(`# the CHECK saw ${seen} bytes; the stored column reads back ${rows[0]!.n}`);
  assert.ok(rows[0]!.n < seen, 'the stored column is not smaller than what the CHECK saw — the trap this test names is gone');
  /* The CHECK counted the value before it was compressed: one byte over, built to compress just as well, is refused. */
  const over = { look: { later: '漢'.repeat(Math.ceil(RSVP_CONFIG_CHECK / 3)) } };
  assert.ok((await storedBytes(over)) > RSVP_CONFIG_CHECK);
  assert.equal(await taken(over), false, 'a value that only fits once compressed was taken');
});
