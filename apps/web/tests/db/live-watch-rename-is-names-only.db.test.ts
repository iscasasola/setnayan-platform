/**
 * tests/db/live-watch-rename-is-names-only.db.test.ts — the "Live Studio" →
 * "Live Watch" catalogue rename changes NAMES and nothing else.
 *
 * Owner, 2026-10-02 (tracker d2): rename it in the admin price list "through
 * the pipeline, prices untouched". Migration `20271260381748`.
 *
 * Method: replay every migration EXCEPT the rename, snapshot every row of the
 * three catalogues, apply the rename's own file, snapshot again. Then:
 *   1. every row is still there, under the same key, with every non-name
 *      column (price, SKU code, is_active, billing period, pax pricing…)
 *      byte-identical;
 *   2. no name or description in any of them says "Live Studio" any more;
 *   3. the LIVE_STUDIO rows read "Live Watch" (the SKU code itself unchanged);
 *   4. a second application changes nothing (idempotent).
 *
 * SABOTAGE (run 2026-10-02): adding `retail_price_php = retail_price_php + 1`
 * to the first UPDATE turns test 1 red ("platform_retail_catalog_v2.retail_price_php changed for LIVE_STUDIO_HOSTED_CHANNEL").
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, MIGRATIONS_DIR, versionOf, type ReplayResult } from './replay-migrations';

const RENAME = '20271260381748_live_watch_catalog_names.sql';

/** Each catalogue: its key column and the columns the rename may touch. */
const TABLES = [
  { table: 'platform_retail_catalog_v2', key: 'service_code', names: ['title', 'description'] },
  { table: 'platform_package_catalog', key: 'package_code', names: ['title', 'description'] },
  { table: 'service_catalog', key: 'sku_code', names: ['display_name', 'description'] },
] as const;
/** Bumped by the table's own trigger on any UPDATE — not a value anyone set. */
const TOUCHED_BY_TRIGGER = new Set(['updated_at']);

let replay: ReplayResult;
let db: PGlite;
type Snapshot = Map<string, Map<string, Record<string, unknown>>>;
let beforeSnap: Snapshot;
let afterSnap: Snapshot;

async function snapshot(): Promise<Snapshot> {
  const out: Snapshot = new Map();
  for (const t of TABLES) {
    const r = await db.query<Record<string, unknown>>(`SELECT * FROM public.${t.table}`);
    out.set(t.table, new Map(r.rows.map((row) => [String(row[t.key]), row])));
  }
  return out;
}

before(async () => {
  const all = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  assert.ok(all.includes(RENAME), `${RENAME} is missing — the rename moved or was renumbered`);
  const only = new Set(all.filter((f) => f !== RENAME).map(versionOf));
  replay = await createReplayedDb({ only });
  db = replay.db;
  beforeSnap = await snapshot();
  await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, RENAME), 'utf8'));
  afterSnap = await snapshot();
});

after(async () => {
  await replay?.db.close();
});

test('1 · every row keeps its key and every non-name column (prices, SKUs, switches)', () => {
  for (const t of TABLES) {
    const b = beforeSnap.get(t.table)!;
    const a = afterSnap.get(t.table)!;
    assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort(), `${t.table}: rows came or went`);
    const names = new Set<string>(t.names);
    for (const [k, rowBefore] of b) {
      const rowAfter = a.get(k)!;
      for (const col of Object.keys(rowBefore)) {
        if (names.has(col) || TOUCHED_BY_TRIGGER.has(col)) continue;
        assert.deepEqual(rowAfter[col], rowBefore[col], `${t.table}.${col} changed for ${k}`);
      }
    }
  }
});

test('2 · no catalogue name or description says "Live Studio" any more', () => {
  for (const t of TABLES) {
    for (const [k, row] of afterSnap.get(t.table)!) {
      for (const col of t.names) {
        const v = row[col];
        assert.ok(
          typeof v !== 'string' || !v.includes('Live Studio'),
          `${t.table}.${col} for ${k} still says Live Studio: ${String(v)}`,
        );
      }
    }
  }
});

test('3 · the LIVE_STUDIO rows read Live Watch; their SKU code is unchanged', () => {
  const v2 = afterSnap.get('platform_retail_catalog_v2')!;
  const live = [...v2.values()].filter((r) => String(r.service_code).startsWith('LIVE_STUDIO'));
  assert.ok(live.length > 0, 'no LIVE_STUDIO rows — the test would prove nothing');
  for (const r of live) {
    assert.match(String(r.title), /Live Watch/, `${String(r.service_code)} title: ${String(r.title)}`);
  }
  // And the rename did something in this replay (it is not vacuously green).
  const changed = [...beforeSnap.get('platform_retail_catalog_v2')!.entries()].filter(
    ([k, r]) => r.title !== v2.get(k)!.title || r.description !== v2.get(k)!.description,
  );
  assert.ok(changed.length > 0, 'the rename changed nothing in a fresh replay');
});

test('4 · applying it again changes nothing', async () => {
  await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, RENAME), 'utf8'));
  const again = await snapshot();
  for (const t of TABLES) {
    for (const [k, row] of again.get(t.table)!) {
      const prev = afterSnap.get(t.table)!.get(k)!;
      for (const col of Object.keys(row)) {
        if (TOUCHED_BY_TRIGGER.has(col)) continue;
        assert.deepEqual(row[col], prev[col], `${t.table}.${col} moved on a re-run for ${k}`);
      }
    }
  }
});
