/**
 * tests/db/ugat-concept-coverage.db.test.ts — a new SUBSYSTEM cannot ship
 * invisible to the Ugat entity map.
 *
 * ── THE SIBLING CHECK, AND THE HOLE IT LEAVES ──────────────────────────────
 * `ugat-schema-claims.db.test.ts` proves the map never SAYS anything false.
 * This proves the map never MISSES anything real. They are the two halves:
 * one guards against lying, the other against falling behind.
 *
 * The concrete failure: `20270808218211_samahan_communities_foundation.sql`
 * created three tables and an events FK — a whole product concept — and the map
 * did not learn about it for three weeks. Nobody erred; there was no signal.
 *
 * ── WHY THIS RUNS HERE ─────────────────────────────────────────────────────
 * `test:db:ci` (a glob over `tests/db/*.db.test.ts`) runs inside the
 * "typecheck + lint" job, which is a REQUIRED status check on main. So this
 * file gates merges with no CI wiring to add and nothing to forget. A guard in
 * a non-required job can go red while the PR merges anyway — false coverage.
 *
 * ── SCOPE, DELIBERATELY NARROW ─────────────────────────────────────────────
 * The map is a CONCEPT abstraction: 10 nodes over ~380 tables / ~664 bonds,
 * under 2% coverage BY DESIGN. This does not ask for an ERD. It asks only
 * whether something SUBSYSTEM-SHAPED has appeared that nobody has either mapped
 * or written down a reason for skipping. Ordinary work — a column, an index, an
 * RLS policy, a lone leaf table — is structurally invisible to it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { createReplayedDb } from './replay-migrations';
import { UGAT_TYPES, UGAT_JOINTS } from '../../lib/ugat/graph';
import {
  verifyConceptCoverage,
  staleBaselineEntries,
  formatConceptFindings,
  type CoverageInput,
  type FkEdge,
} from '../../lib/ugat/concept-coverage';

const BASELINE_PATH = path.join(__dirname, 'ugat-concept.baseline.txt');

/** `<table> | <reason>` — blank lines and `#` comments ignored. */
function readBaseline(): Map<string, string> {
  const out = new Map<string, string>();
  if (!fs.existsSync(BASELINE_PATH)) return out;
  for (const raw of fs.readFileSync(BASELINE_PATH, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [table, ...rest] = line.split('|');
    out.set((table ?? '').trim(), rest.join('|').trim());
  }
  return out;
}

/**
 * Tables the map accounts for — derived from graph.ts, never hand-listed.
 *
 * That derivation is what makes the guard self-greening: properly mapping a
 * concept (adding its node/joint/claims) silences the finding with no baseline
 * edit. If this were a second hand-maintained list, the two would drift and we
 * would have rebuilt the problem.
 */
function mappedTables(): Set<string> {
  const mapped = new Set<string>();
  for (const t of UGAT_TYPES) if (t.table) mapped.add(t.table);
  for (const j of UGAT_JOINTS) {
    if (j.joint) mapped.add(j.joint);
    for (const c of j.claims) mapped.add(c.table);
  }
  return mapped;
}

/** The platform spine — the map's own node tables. */
function spineTables(): Set<string> {
  return new Set(UGAT_TYPES.map((t) => t.table).filter((t): t is string => Boolean(t)));
}

async function introspect(db: Awaited<ReturnType<typeof createReplayedDb>>['db']) {
  const tables = await db.query<{ t: string }>(
    `SELECT c.relname AS t
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`,
  );
  const edges = await db.query<{ f: string; t: string }>(
    `SELECT DISTINCT c.relname AS f, rf.relname AS t
       FROM pg_constraint con
       JOIN pg_class c      ON c.oid  = con.conrelid
       JOIN pg_class rf     ON rf.oid = con.confrelid
       JOIN pg_namespace n  ON n.oid  = c.relnamespace
      WHERE con.contype = 'f' AND n.nspname = 'public'`,
  );
  return {
    tables: tables.rows.map((r) => r.t),
    fkEdges: edges.rows.map((r): FkEdge => ({ from: r.f, to: r.t })),
  };
}

test('no unmapped subsystem has appeared without being mapped or declined', async (t) => {
  const { db, applied } = await createReplayedDb();
  t.after(() => db.close());

  const { tables, fkEdges } = await introspect(db);

  // ── ANTI-VACUITY ─────────────────────────────────────────────────────────
  // A half-dead replay would produce few tables and few edges, and then find
  // nothing — a silent pass that looks identical to a healthy one. Floors first.
  assert.ok(applied > 500, `expected a full replay, only ${applied} applied`);
  assert.ok(tables.length > 350, `only ${tables.length} tables — replay looks partial`);
  assert.ok(fkEdges.length > 400, `only ${fkEdges.length} FK edges — replay looks partial`);

  const mapped = mappedTables();
  assert.ok(mapped.size >= 12, `map should account for >=12 tables, got ${mapped.size}`);

  const input: CoverageInput = {
    tables,
    fkEdges,
    mapped,
    spine: spineTables(),
    baseline: readBaseline(),
  };

  // The escape hatch must not rot into fiction — the exact failure the health
  // findings had, where a written record outlived what it described.
  const stale = staleBaselineEntries(input);
  assert.deepEqual(
    stale,
    [],
    `Stale lines in tests/db/ugat-concept.baseline.txt — delete them:\n${stale.join('\n')}`,
  );

  const findings = verifyConceptCoverage(input);
  assert.equal(findings.length, 0, formatConceptFindings(findings));
});

test('the guard can go red — a synthetic subsystem is NOT silently accepted', async (t) => {
  // The most important assertion in the file. Everything above proves the guard
  // is green today; this proves green means something. A suite that cannot fail
  // is decoration.
  const { db } = await createReplayedDb();
  t.after(() => db.close());
  const { tables, fkEdges } = await introspect(db);

  const findings = verifyConceptCoverage({
    tables: [...tables, 'canary_hub', 'canary_left', 'canary_right'],
    fkEdges: [
      ...fkEdges,
      { from: 'canary_left', to: 'canary_hub' },
      { from: 'canary_right', to: 'canary_hub' },
    ],
    mapped: mappedTables(),
    spine: spineTables(),
    baseline: readBaseline(),
  });

  assert.ok(
    findings.some((f) => f.table === 'canary_hub'),
    'a 3-table cluster with a 2-referrer hub must be detected',
  );
  assert.match(formatConceptFindings(findings), /Do NOT delete or weaken this check/);
});

test('every baseline line carries a real written reason', () => {
  // An empty or placeholder reason turns the escape hatch into a mute button.
  for (const [table, reason] of readBaseline()) {
    assert.ok(table.length > 0, 'baseline has a line with no table name');
    assert.ok(
      reason.length >= 12 && !/^(todo|tbd|n\/a|\?+)$/i.test(reason),
      `baseline line "${table}" needs a real reason, got "${reason}"`,
    );
  }
});
