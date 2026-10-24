/**
 * tests/db/no-gallery-word-in-stored-copy.db.test.ts — the copy the database
 * holds says no "gallery", and the migration that removed it changed WORDS only.
 *
 * Owner, 2026-10-23: an event's photos are "Memories", a supplier's own photos
 * are "Portfolio", the Mood Board library is "Inspiration" — no "gallery"
 * anywhere a person reads it. The app's strings are held by
 * lib/no-gallery-word.test.ts; this holds the stored copy. Migration
 * `20271286099999`.
 *
 * Method (the live-watch-rename-is-names-only shape): replay every migration
 * EXCEPT this one, snapshot the four tables, apply its own file, snapshot again.
 *   1. every row is still there, under the same key, with every non-copy
 *      column byte-identical (and the attribute KEYS of each service schema
 *      unchanged — only a label moved);
 *   2. no copy column says "gallery" — theme names + descriptions, retail
 *      titles + descriptions, service-schema field labels, privacy notes;
 *   3. the theme rename did something here, and reads "an" before "Atelier";
 *   4. a second application changes nothing (idempotent).
 *
 * SABOTAGE (run 2026-10-23): turning the theme UPDATE into `SET name = name`
 * turns test 2 red, naming each "… Gallery Vow" row by its template_id.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, MIGRATIONS_DIR, versionOf, type ReplayResult } from './replay-migrations';

const MIGRATION = '20271286099999_no_gallery_word_in_stored_copy.sql';
const WORD = /\bgaller(y|ies)\b/i;

/** Each table: its key column and the columns the migration may touch. */
const TABLES = [
  { table: 'moodboard_theme_templates', key: 'template_id', copy: ['name', 'description'] },
  { table: 'platform_retail_catalog_v2', key: 'service_code', copy: ['title', 'description'] },
  { table: 'canonical_service_schemas', key: 'canonical_service', copy: ['category_specific_attributes'] },
  { table: 'data_privacy_controls', key: 'control_key', copy: ['note'] },
] as const;
/** Set by the migration (or the table's own trigger) on any UPDATE. */
const TOUCHED_BY_UPDATE = new Set(['updated_at']);

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

/** What a person reads from a column: the string itself, or a schema's field labels. */
function readable(col: string, v: unknown): string[] {
  if (col !== 'category_specific_attributes') return typeof v === 'string' ? [v] : [];
  const attrs = (v ?? {}) as Record<string, { label?: unknown }>;
  return Object.values(attrs).flatMap((a) => (typeof a?.label === 'string' ? [a.label] : []));
}

before(async () => {
  const all = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  assert.ok(all.includes(MIGRATION), `${MIGRATION} is missing — the migration moved or was renumbered`);
  const only = new Set(all.filter((f) => f !== MIGRATION).map(versionOf));
  replay = await createReplayedDb({ only });
  db = replay.db;
  beforeSnap = await snapshot();
  await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION), 'utf8'));
  afterSnap = await snapshot();
});

after(async () => {
  await replay?.db.close();
});

test('1 · every row keeps its key and every non-copy column; schema attribute keys are unchanged', () => {
  for (const t of TABLES) {
    const b = beforeSnap.get(t.table)!;
    const a = afterSnap.get(t.table)!;
    assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort(), `${t.table}: rows came or went`);
    const copy = new Set<string>(t.copy);
    for (const [k, rowBefore] of b) {
      const rowAfter = a.get(k)!;
      for (const col of Object.keys(rowBefore)) {
        if (copy.has(col) || TOUCHED_BY_UPDATE.has(col)) continue;
        assert.deepEqual(rowAfter[col], rowBefore[col], `${t.table}.${col} changed for ${k}`);
      }
    }
  }
  for (const [k, rowBefore] of beforeSnap.get('canonical_service_schemas')!) {
    const keysBefore = Object.keys((rowBefore.category_specific_attributes ?? {}) as object).sort();
    const rowAfter = afterSnap.get('canonical_service_schemas')!.get(k)!;
    const keysAfter = Object.keys((rowAfter.category_specific_attributes ?? {}) as object).sort();
    assert.deepEqual(keysAfter, keysBefore, `canonical_service_schemas attribute keys changed for ${k}`);
  }
});

test('2 · no stored copy a person reads says "gallery"', () => {
  const hits: string[] = [];
  for (const t of TABLES) {
    for (const [k, row] of afterSnap.get(t.table)!) {
      for (const col of t.copy) {
        for (const text of readable(col, row[col])) {
          if (WORD.test(text)) hits.push(`${t.table}.${col} · ${k}: ${text.slice(0, 110)}`);
        }
      }
    }
  }
  assert.deepEqual(hits, [], 'Owner 2026-10-23: no "gallery" where a person reads it:\n' + hits.join('\n'));
});

test('3 · the theme names moved to "Atelier Vow" here — and "Once Upon an", not "a"', () => {
  const names = (s: Snapshot) => [...s.get('moodboard_theme_templates')!.values()].map((r) => String(r.name));
  const before = names(beforeSnap).filter((n) => n.endsWith(' Gallery Vow'));
  assert.ok(before.length > 0, 'no "Gallery Vow" theme in a fresh replay — the test would prove nothing');
  const after = names(afterSnap);
  assert.equal(after.filter((n) => n.endsWith(' Atelier Vow')).length, before.length);
  assert.ok(!after.some((n) => /(^|\s)[Aa] Atelier Vow$/.test(n)), 'an "a Atelier Vow" name was written');
});

test('4 · applying it again changes nothing', async () => {
  await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION), 'utf8'));
  const again = await snapshot();
  for (const t of TABLES) {
    for (const [k, row] of again.get(t.table)!) {
      const prev = afterSnap.get(t.table)!.get(k)!;
      for (const col of Object.keys(row)) {
        if (TOUCHED_BY_UPDATE.has(col)) continue;
        assert.deepEqual(row[col], prev[col], `${t.table}.${col} moved on a re-run for ${k}`);
      }
    }
  }
});
