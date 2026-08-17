/**
 * Every switch in the SCHEMA must have something that can flip it.
 *
 * ── THE HOLE THIS CLOSES ────────────────────────────────────────────────────
 * `lib/gates-have-handles.test.ts` has asked the right question since it was
 * written — "does anything WRITE this column?" — of a list of FIVE columns
 * typed in by hand. A new switch was therefore covered only if whoever added it
 * remembered to register it with the guard, which is precisely the memory the
 * guard exists to replace.
 *
 * The record shows the memory does not hold. Instances 3, 4 and 5 were each
 * registered only AFTER shipping broken:
 *
 *   author_named_publicly       registered 2026-08-06, "after shipping it broken"
 *   is_founder                  registered 2026-08-09, shipped 2026-06-09 — three months
 *   live_photo_wall_visibility  registered 2026-08-12, shipped 2026-11-04 — nine months
 *
 * So this file derives the candidate set from the CATALOG instead: every
 * boolean or enum column carrying a DEFAULT — a value that can sit at rest and
 * silently mean "off". 265 of them today. Nothing has to be remembered.
 *
 * ── WHAT COUNTS AS A WRITER ─────────────────────────────────────────────────
 * Three paths, because this codebase writes columns in three genuinely
 * different places, and a detector blind to one of them reports working screens
 * as broken:
 *
 *   1. APPLICATION CODE — see lib/gate-writers.ts, which documents the four
 *      spellings that a naive `.update({ column: ... })` pattern missed.
 *   2. A DATABASE FUNCTION — every guest-side write goes through a SECURITY
 *      DEFINER function, since a guest has no auth.uid() and cannot write a row
 *      directly. Detected from pg_proc bodies in the replayed schema, so the
 *      hand-maintained `writtenViaRpcParam` mapping is no longer needed.
 *   3. THE BASELINE — a written reason, in the diff, where a reviewer sees it.
 *
 * ⚠ THIS TEST READS THE REPLAYED SCHEMA, NEVER PRODUCTION. The replay runs as
 * superuser and is more permissive than prod, which matters enormously for RLS
 * assertions and not at all here: column types, defaults and function bodies
 * are the same objects either way.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { loadSources, gateWritersOf, type Source } from '../../lib/gate-writers';

let replay: ReplayResult;
let db: PGlite;
let sources: Source[];

const WEB = path.join(__dirname, '..', '..');
const BASELINE = path.join(__dirname, 'gates-have-handles.baseline.txt');

/** `<table>.<column> | <reason>` — blank lines and `#` comments ignored. */
function readBaseline(): Map<string, string> {
  const out = new Map<string, string>();
  if (!fs.existsSync(BASELINE)) return out;
  for (const raw of fs.readFileSync(BASELINE, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [key, ...rest] = line.split('|');
    out.set((key ?? '').trim(), rest.join('|').trim());
  }
  return out;
}

type Candidate = { tbl: string; col: string };

/**
 * Boolean / enum columns carrying a DEFAULT: a value that can sit at rest and
 * silently mean "off". Columns with no default cannot be "stuck" — every insert
 * must state them.
 */
async function candidates(): Promise<Candidate[]> {
  const { rows } = await db.query<Candidate>(`
    SELECT c.relname AS tbl, a.attname AS col
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      JOIN pg_type t ON t.oid = a.atttypid
      JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE c.relkind IN ('r','p')
       AND a.attnum > 0 AND NOT a.attisdropped
       AND (format_type(a.atttypid, a.atttypmod) = 'boolean' OR t.typtype = 'e')
     ORDER BY 1, 2
  `);
  return rows;
}

/**
 * Columns written by a database function — the guest-side write path.
 *
 * Matched on an assignment (`col = ...`, as in an UPDATE ... SET or a PL/pgSQL
 * body) or on the column appearing inside an `INSERT INTO <that table>`. The
 * `^[^-]*` guard keeps a `--` comment line from being read as an assignment,
 * the same way lib/gate-writers.ts strips comments before looking: a guard in
 * this repo has been satisfied by prose about the column four separate times.
 */
async function writtenBySqlFunction(): Promise<Set<string>> {
  const { rows } = await db.query<{ k: string }>(`
    WITH cand AS (
      SELECT c.relname AS tbl, a.attname AS col
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        JOIN pg_type t ON t.oid = a.atttypid
        JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE c.relkind IN ('r','p') AND a.attnum > 0 AND NOT a.attisdropped
         AND (format_type(a.atttypid, a.atttypmod) = 'boolean' OR t.typtype = 'e')
    ), fn AS (
      SELECT p.prosrc FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    )
    SELECT DISTINCT cand.tbl || '.' || cand.col AS k
      FROM cand
     WHERE EXISTS (
       SELECT 1 FROM fn
        WHERE fn.prosrc ~ ('(?n)^[^-]*\\m' || cand.col || '\\M\\s*=[^=]')
           OR fn.prosrc ~* ('insert\\s+into\\s+(public\\.)?' || cand.tbl || '\\M[^;]*\\m' || cand.col || '\\M')
     )
  `);
  return new Set(rows.map((r) => r.k));
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  sources = loadSources(WEB);
});

after(async () => {
  if (!db) return;
  await db.close?.();
});

test('META · the enumeration and the source scan both found something', async () => {
  // Anti-vacuity, twice over. A guard that inspects nothing passes for the
  // wrong reason, and both halves of this one can silently become empty: the
  // catalog query if the replay fails, the source scan if the path is wrong.
  const cands = await candidates();
  assert.ok(
    cands.length > 200,
    `only ${cands.length} switch-shaped columns found — the catalog query is wrong, ` +
      'and an empty candidate set passes every assertion below.',
  );
  assert.ok(
    sources.length > 1000,
    `only ${sources.length} source files loaded from ${WEB} — the walk is wrong, so ` +
      'EVERY column would look unwritten and the baseline would swallow the lot.',
  );
});

test('the five switches that shipped broken still have writers', async () => {
  // Named individually rather than left to the enumeration, because each was a
  // real incident. A regression here is not "the surface grew" — it is one of
  // these specific controls being removed again.
  const known: Candidate[] = [
    { tbl: 'events', col: 'live_media_public' },
    { tbl: 'events', col: 'papic_face_mode' },
    { tbl: 'guest_columns', col: 'author_named_publicly' },
    { tbl: 'vendor_profiles', col: 'is_founder' },
    { tbl: 'events', col: 'live_photo_wall_visibility' },
  ];
  const sqlWritten = await writtenBySqlFunction();
  const lost = known.filter(
    ({ tbl, col }) =>
      gateWritersOf(sources, tbl, col).length === 0 && !sqlWritten.has(`${tbl}.${col}`),
  );
  assert.deepEqual(
    lost.map((c) => `${c.tbl}.${c.col}`),
    [],
    'a switch that was fixed has lost its control again',
  );
});

test('no switch column is unreachable without a written reason', async () => {
  const cands = await candidates();
  const sqlWritten = await writtenBySqlFunction();
  const baseline = readBaseline();

  const unreachable = cands
    .map(({ tbl, col }) => ({ key: `${tbl}.${col}`, tbl, col }))
    .filter(
      ({ key, tbl, col }) =>
        !sqlWritten.has(key) && gateWritersOf(sources, tbl, col).length === 0,
    )
    .map(({ key }) => key);

  const undeclared = unreachable.filter((k) => !baseline.has(k));

  assert.deepEqual(
    undeclared,
    [],
    'These columns are switch-shaped and NOTHING can flip them — not application ' +
      'code, not a database function:\n  ' +
      undeclared.join('\n  ') +
      '\n\nThis is the shape that shipped five times: it typechecks, it has RLS, its ' +
      'readers have tests, and the feature simply always takes the false branch. ' +
      'Nothing errors.\n\nShip the control that flips it — in the SAME change as the ' +
      'column — or add a line to tests/db/gates-have-handles.baseline.txt saying why ' +
      'it may ship with no handle. A baseline is a bill, not a decision: the line ' +
      'lands in the diff where a reviewer can disagree with it.',
  );
});

test('the baseline does not accumulate lines for columns that are now fine', async () => {
  // The other direction. Once a switch gets a control, its excuse must go —
  // otherwise the file grows into a list nobody reads and the next real finding
  // hides among the stale entries.
  const cands = await candidates();
  const sqlWritten = await writtenBySqlFunction();
  const live = new Set(cands.map(({ tbl, col }) => `${tbl}.${col}`));
  const baseline = readBaseline();

  const stale: string[] = [];
  for (const key of baseline.keys()) {
    if (!live.has(key)) {
      stale.push(`${key} (column no longer exists / no longer switch-shaped)`);
      continue;
    }
    const [tbl, col] = key.split('.');
    if (sqlWritten.has(key) || gateWritersOf(sources, tbl!, col!).length > 0) {
      stale.push(`${key} (it has a writer now)`);
    }
  }

  assert.deepEqual(
    stale,
    [],
    'These baseline lines are no longer true and should be deleted:\n  ' +
      stale.join('\n  '),
  );
});
