/**
 * A HANDLE WITH NO GATE — the mirror of gates-have-handles.
 *
 * ── THE HOLE THIS CLOSES ────────────────────────────────────────────────────
 * `gates-have-handles.db.test.ts` asks, of every switch-shaped column in the
 * schema: "can anything TURN THIS ON?" That is the right question and it is
 * exactly half of the shape.
 *
 * The other half shipped live, and was found on 2026-08-17 BY ACCIDENT, while
 * chasing an unrelated question about retired features:
 *
 *   `users.planner_mode` is written by a real, rendered control — the profile
 *   page's Guided / DIY choice — with copy beside it promising "Guided shows the
 *   9-step checklist on your Overview tab. DIY hides it so you can plan on your
 *   own." That column has FIVE references in the entire repo and all five are
 *   that page and its own action. The event Overview renders its journey rail
 *   unconditionally and never reads it. **A couple who chooses DIY to hide the
 *   checklist still sees it, and Guided grants nothing.**
 *
 * 🔑 TO THE PERSON USING THE PRODUCT, BOTH SHAPES ARE ONE BUG: the setting does
 * nothing. A writer-less column cannot be switched on; a reader-less one
 * switches nothing on. The existing guard passed `planner_mode` correctly and
 * uselessly — the column IS written. Nobody had asked the other half.
 *
 * ── WHAT IT ASKS, AND WHY NOT "IS IT SELECTED SOMEWHERE" ────────────────────
 * `planner_mode` IS selected — by the very page that writes it, to render which
 * option is currently ticked. That read is real and says nothing about whether
 * the setting DOES anything. So the question is whether any file OUTSIDE the
 * writing surface names the column at all. A switch that genuinely works has a
 * consumer elsewhere: the couple's Papic card writes the photo-wall choice and
 * the GUEST surfaces read it; an admin writes the founder flag and the BENEFIT
 * logic reads it.
 *
 * The "elsewhere" test is deliberately GENEROUS — a mere mention outside the
 * writer's directory is enough — because a read is often a `.select()` in a
 * loader with the consumption three files away, and a detector demanding both in
 * one file would cry wolf constantly. See `lib/gate-writers.ts`.
 *
 * ── ⚠ A HIT IS A CANDIDATE, NOT A VERDICT ───────────────────────────────────
 * Read-only-by-its-own-surface is perfectly correct when the effect IS on that
 * surface. It is a defect only when the control PROMISES an effect somewhere
 * else, and that is a copy question no scanner can settle. So this guard does
 * not fail on the shape: it fails on an UNDECLARED instance of the shape, and
 * the baseline carries the judgement where a reviewer can disagree with it.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { loadSources, switchReadersOutsideWriter, type Source } from '../../lib/gate-writers';

let replay: ReplayResult;
let db: PGlite;
let sources: Source[];

const WEB = path.join(__dirname, '..', '..');
const BASELINE = path.join(__dirname, 'handles-have-gates.baseline.txt');

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

/** Same candidate set as gates-have-handles: boolean/enum carrying a DEFAULT. */
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
  // Anti-vacuity on both halves: an empty candidate set or an empty source list
  // would make every assertion below pass by inspecting nothing.
  const cands = await candidates();
  assert.ok(cands.length > 200, `only ${cands.length} switch-shaped columns found — query is wrong`);
  assert.ok(sources.length > 1000, `only ${sources.length} sources loaded from ${WEB} — walk is wrong`);
});

test('the known instance is still detected — this guard would have caught it', async () => {
  // The whole reason this file exists. If `planner_mode` ever stops being
  // flagged, either it was fixed (delete this test and its baseline line) or the
  // detector has gone blind — and those must not be confused.
  const { writers, readersElsewhere } = switchReadersOutsideWriter(sources, 'users', 'planner_mode');
  assert.ok(
    writers.length > 0,
    'users.planner_mode has no writer — that is the OTHER guard\'s finding, and it means this ' +
      'test can no longer demonstrate the mirror shape.',
  );
  assert.deepEqual(
    readersElsewhere,
    [],
    'users.planner_mode is now read outside the profile surface that writes it. If the Guided / ' +
      'DIY control was WIRED UP, that is the fix landing — remove its baseline line and this ' +
      'test. If it was not, the detector has gone blind.',
  );
});

test('no switch is written by a control and read only by that control, without a written reason', async () => {
  const cands = await candidates();
  const baseline = readBaseline();

  const undeclared: string[] = [];
  for (const { tbl, col } of cands) {
    const key = `${tbl}.${col}`;
    const { writers, readersElsewhere } = switchReadersOutsideWriter(sources, tbl, col);
    // No writer at all is the OTHER guard's business, not this one.
    if (writers.length === 0) continue;
    if (readersElsewhere.length > 0) continue;
    if (!baseline.has(key)) undeclared.push(`${key}  (written by ${writers.join(', ')})`);
  }

  assert.deepEqual(
    undeclared,
    [],
    'These switches are written by real code and read by NOTHING outside the surface that writes ' +
      'them:\n  ' +
      undeclared.join('\n  ') +
      '\n\nThat is not automatically wrong — a switch whose effect is on its own surface is ' +
      'correct. It IS wrong when the copy beside the control promises an effect somewhere else, ' +
      'which is how `users.planner_mode` shipped: the profile page promises the Overview tab will ' +
      'change and the Overview never reads the value.\n\nSo answer the one question a scanner ' +
      'cannot: DOES THE TEXT NEXT TO THIS CONTROL PROMISE SOMETHING IT DOES NOT DO? Then either ' +
      'wire it up, fix the copy, or add a line to tests/db/handles-have-gates.baseline.txt saying ' +
      'why its effect is genuinely local.',
  );
});

test('the baseline does not keep lines for switches that are now read elsewhere', async () => {
  // The other direction. Once a switch acquires a real consumer, its excuse must
  // go, or the file grows into a list nobody reads and the next real finding
  // hides among the stale entries.
  const cands = await candidates();
  const live = new Map(cands.map((c) => [`${c.tbl}.${c.col}`, c]));
  const baseline = readBaseline();

  const stale: string[] = [];
  for (const key of baseline.keys()) {
    const cand = live.get(key);
    if (!cand) {
      stale.push(`${key} (no longer a switch-shaped column)`);
      continue;
    }
    const { writers, readersElsewhere } = switchReadersOutsideWriter(sources, cand.tbl, cand.col);
    if (writers.length === 0) {
      stale.push(`${key} (has no writer now — it belongs to gates-have-handles, not here)`);
    } else if (readersElsewhere.length > 0) {
      stale.push(`${key} (is read elsewhere now: ${readersElsewhere.slice(0, 2).join(', ')})`);
    }
  }

  assert.deepEqual(stale, [], 'These baseline lines are no longer true and should be deleted:\n  ' + stale.join('\n  '));
});
