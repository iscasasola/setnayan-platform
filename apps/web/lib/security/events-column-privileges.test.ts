/**
 * Build-time guard for the events column-privilege migration
 * (supabase/migrations/20271005100000_events_column_update_privileges.sql).
 *
 * Reads the REAL migration text. The bottom half is a META-TEST suite: it feeds
 * deliberately-neutralized variants of that same text through the same auditor
 * and asserts each one FAILS. Without those, a green run here would prove only
 * that the auditor is silent — not that it can speak.
 *
 * The actual enforcement proof (a real Postgres, `SET ROLE authenticated`, a
 * real 42501) lives in tests/db/events-column-privileges.db.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  CRITICAL_LOCKED,
  HOST_EDITABLE_SAMPLE,
  LOCKED_COLUMNS,
  auditMigrationSql,
  extractAssertedLockedColumns,
  extractLockedColumns,
  stripSqlComments,
} from './events-column-privileges';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = join(
  HERE,
  '..',
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '20271005100000_events_column_update_privileges.sql',
);
const SQL = readFileSync(MIGRATION_PATH, 'utf8');

// ── The real migration must pass the full audit ─────────────────────────────

test('the migration passes the column-privilege audit', () => {
  const findings = auditMigrationSql(SQL);
  assert.deepEqual(
    findings,
    [],
    `column-privilege audit findings:\n${findings.map((f) => `  [${f.kind}] ${f.detail}`).join('\n')}`,
  );
});

test('every critical column is locked, named with its exploit', () => {
  const declared = extractLockedColumns(SQL);
  assert.ok(declared, 'migration declares no locked_columns array');
  for (const { column, exploit } of CRITICAL_LOCKED) {
    assert.ok(
      (declared as string[]).includes(column),
      `${column} was removed from the deny-set. Re-opened exploit: ${exploit}`,
    );
  }
});

test('the deny-set does not lock a column a host legitimately edits', () => {
  const declared = extractLockedColumns(SQL) as string[];
  for (const col of HOST_EDITABLE_SAMPLE) {
    assert.ok(
      !declared.includes(col),
      `${col} is written by a server action using the AUTHENTICATED client — locking it breaks that feature`,
    );
  }
});

test('the migration re-grants the host-editable sample in its post-condition', () => {
  // (b) of the migration's DO block. If a host-editable column is not asserted
  // there, a future edit could silently drop it from the allow-list.
  const clean = stripSqlComments(SQL);
  const idx = clean.indexOf('lost-host-write:');
  assert.notEqual(idx, -1, 'migration has no `lost-host-write:` post-condition loop');
  const head = clean.slice(0, idx);
  const open = head.lastIndexOf('ARRAY[');
  const asserted = [...clean.slice(open, idx).matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const col of HOST_EDITABLE_SAMPLE) {
    assert.ok(asserted.includes(col), `${col} is not asserted still-writable by the migration`);
  }
});

test('the TS deny-set and the migration deny-set are identical', () => {
  const declared = extractLockedColumns(SQL) as string[];
  assert.deepEqual(
    [...declared].sort(),
    [...LOCKED_COLUMNS].sort(),
    'LOCKED_COLUMNS drifted from the migration — update both together',
  );
});

test('the master_qr_token collision fix ships with the migration', () => {
  const clean = stripSqlComments(SQL);
  assert.match(
    clean,
    /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+events_master_qr_token_key/i,
    'master_qr_token is host-writable and has no UNIQUE index — a host can collide with another event and break its crew registration',
  );
});

// ── META-TESTS — prove the auditor actually fails on a broken migration ─────
//
// Each case neutralizes the real SQL the way a careless edit would, and asserts
// the auditor reports the specific finding. If the auditor were vacuous (e.g. a
// regex that never matches, or an extractor that returns []), these fail.

test('META: auditor rejects a migration with no table-level REVOKE', () => {
  // Only GRANTing columns while a table-level UPDATE grant survives enforces
  // NOTHING — Postgres cannot subtract a column from a table-level privilege.
  const broken = SQL.replace(
    /EXECUTE 'REVOKE UPDATE, INSERT ON public\.events FROM authenticated, anon';/,
    "-- neutralized",
  );
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const kinds = auditMigrationSql(broken).map((f) => f.kind);
  assert.ok(kinds.includes('missing-table-revoke'), `expected missing-table-revoke, got ${kinds.join(',')}`);
});

test('META: auditor rejects a migration that forgets INSERT', () => {
  const broken = SQL.replace(/GRANT INSERT \(%s\)/, 'GRANT SELECT (%s)');
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const kinds = auditMigrationSql(broken).map((f) => f.kind);
  assert.ok(kinds.includes('missing-column-grant-insert'), `expected missing-column-grant-insert, got ${kinds.join(',')}`);
});

test('META: auditor rejects removal of a locked column', () => {
  const broken = SQL.replace(/'kwento_free_grandfathered',/, '');
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const findings = auditMigrationSql(broken);
  assert.ok(
    findings.some((f) => f.kind === 'unlocked-column' && f.detail.includes('kwento_free_grandfathered')),
    `expected unlocked-column for kwento_free_grandfathered, got ${findings.map((f) => f.kind).join(',')}`,
  );
});

test('META: auditor rejects a COMMENTED-OUT locked column', () => {
  // The subtle one: a reviewer comments an entry out rather than deleting it.
  // stripSqlComments must make it invisible to the extractor.
  const broken = SQL.replace(/^(\s*)'is_sample',/m, "$1-- 'is_sample',");
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const findings = auditMigrationSql(broken);
  assert.ok(
    findings.some((f) => f.kind === 'unlocked-column' && f.detail.includes('is_sample')),
    `commented-out entry was still counted as locked; got ${findings.map((f) => f.kind).join(',')}`,
  );
});

test('META: auditor rejects revoking from service_role', () => {
  const broken = SQL.replace(
    /FROM authenticated, anon';/,
    "FROM authenticated, anon, service_role';",
  );
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const kinds = auditMigrationSql(broken).map((f) => f.kind);
  assert.ok(kinds.includes('revokes-privileged-role'), `expected revokes-privileged-role, got ${kinds.join(',')}`);
});

test('META: auditor rejects a hand-enumerated allow-list', () => {
  const broken = SQL.replace(/<> ALL \(locked_columns\)/, "<> ALL (ARRAY['nope'])");
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const kinds = auditMigrationSql(broken).map((f) => f.kind);
  assert.ok(kinds.includes('allowlist-not-computed'), `expected allowlist-not-computed, got ${kinds.join(',')}`);
});

test('META: auditor rejects a deny-set that outgrows its post-condition', () => {
  // Add a column to the ARRAY but not to the assert list — it would be locked
  // without anything verifying the lock took.
  const broken = SQL.replace(/'kwento_free_grandfathered',/, "'kwento_free_grandfathered',\n    'timezone',");
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const findings = auditMigrationSql(broken);
  assert.ok(
    findings.some((f) => f.kind === 'unasserted-column' && f.detail.includes('timezone')),
    `expected unasserted-column for timezone, got ${findings.map((f) => f.kind).join(',')}`,
  );
});

test('META: the extractors are not silently returning empty', () => {
  // Guards the whole suite: if extractLockedColumns ever returned [], every
  // "is X locked?" assertion above would still pass for the real file only
  // because auditMigrationSql compares against it. Pin real, non-trivial sizes.
  const declared = extractLockedColumns(SQL);
  const asserted = extractAssertedLockedColumns(SQL);
  assert.ok(declared && declared.length >= 40, `expected >=40 locked columns, got ${declared?.length}`);
  assert.ok(asserted && asserted.length >= 40, `expected >=40 asserted columns, got ${asserted?.length}`);
  assert.ok(declared?.includes('live_studio_roam_manifest'));
  assert.ok(asserted?.includes('live_studio_roam_manifest'));
});

// ── stripSqlComments — table-driven, over the cases a naive stripper breaks ─
//
// This function is shared: events-column-select-privileges.ts,
// events-private-details.ts and lib/ugat/both-ends.ts's `sqlWords()` (which
// decides whether a DB function or table "has a caller") all import it. Its
// original version only blanked `--` line comments; a name mentioned ONLY
// inside a `/* … */` block read as a real reference, which is exactly the
// shape of miss that lets an orphaned RPC hide (see both-ends.test.ts for the
// direct reproduction against `sqlWords`).

const STRIP_CASES: Array<{
  name: string;
  sql: string;
  mustContain?: string[];
  mustNotContain?: string[];
}> = [
  {
    name: 'a plain block comment is blanked',
    sql: "SELECT 1; /* mentions real_table and secret_fn() */ SELECT 2;",
    mustContain: ['SELECT 1', 'SELECT 2'],
    mustNotContain: ['secret_fn', 'real_table'],
  },
  {
    name: 'Postgres block comments NEST — depth, not the first */',
    // A naive `indexOf('*/')` from the first `/*` stops at the comment
    // closing the INNER `/* nested */`, leaving everything after it
    // (including zzz_outer_tail) looking like live code.
    sql:
      '/* opens mentioning zzz_inner_orphan /* nested */ still commented, ' +
      'mentioning zzz_outer_tail_orphan */ real_call_after_nesting();',
    mustContain: ['real_call_after_nesting'],
    mustNotContain: ['zzz_inner_orphan', 'zzz_outer_tail_orphan'],
  },
  {
    name: "a `*/` inside a single-quoted string does not end (or start) anything",
    sql: "SELECT 'closing */ token', real_after_string_orphan();",
    mustContain: ["'closing */ token'", 'real_after_string_orphan'],
  },
  {
    name: "the SQL '' escape does not desync string tracking (the real migration's own case)",
    // Mirrors supabase/migrations/20271005100000's own
    // `event''s master_qr_token` — a doubled quote inside a string.
    sql: "SELECT 'their own event''s -- not a real comment, still inside the string', real_call_after_escaped_quotes();",
    mustContain: ["event''s -- not a real comment", 'real_call_after_escaped_quotes'],
  },
  {
    name: 'a single-quoted string may hold a real embedded newline — tracking is not reset per line',
    sql: "SELECT 'line one\nline two -- looks like a comment but is still inside the string'; SELECT real_call_after_multiline_string();",
    mustContain: ['real_call_after_multiline_string'],
  },
  {
    name: '-- line comments are still blanked to the real newline',
    sql: '-- mentions dead_ref_orphan() in prose\nSELECT alive_after_line_comment();',
    mustContain: ['alive_after_line_comment'],
    mustNotContain: ['dead_ref_orphan'],
  },
  {
    name: 'a `--`-shaped glob inside a real line comment does not open a fake block comment',
    // This codebase's own migration headers write exactly this shape:
    // "-- apps/web/app/dashboard/[eventId]/date-selection/*". The naive
    // two-regex stripper (block comments first) treats that trailing `/*`
    // as an opener and eats everything up to the next real `*/`.
    sql:
      '-- see apps/web/lib/vendor-autoreply/* for the reader\n' +
      'SELECT real_call_after_glob_comment();\n' +
      '/* a real block comment mentioning zzz_should_vanish */\n' +
      'SELECT another_real_call();',
    mustContain: ['real_call_after_glob_comment', 'another_real_call'],
    mustNotContain: ['zzz_should_vanish'],
  },
  {
    name: 'a `--` line comment inside a block comment does nothing special',
    sql: '/* see -- this is still just comment text, not a real line comment */ real_call_after_dash_in_block();',
    mustContain: ['real_call_after_dash_in_block'],
  },
  {
    name: '$$ ... $$ dollar-quoted body: a block comment inside it is stripped',
    sql:
      "CREATE FUNCTION f() RETURNS void AS $$ /* mentions hidden_in_dollar_block_orphan */ " +
      "BEGIN PERFORM real_call_in_dollar_body(); END; $$ LANGUAGE plpgsql; " +
      'SELECT visible_after_dollar_fn();',
    mustContain: ['real_call_in_dollar_body', 'visible_after_dollar_fn'],
    mustNotContain: ['hidden_in_dollar_block_orphan'],
  },
  {
    name: "a `-- don't …` apostrophe inside a dollar body cannot desync the scan for the REST OF THE FILE",
    sql:
      "DO $$ BEGIN -- don't call orphan_in_dollar_comment() here, it's retired\n" +
      "PERFORM real_call_in_body(); END $$; " +
      'SELECT after_dollar_close_orphan_check();',
    mustContain: ['real_call_in_body', 'after_dollar_close_orphan_check'],
    mustNotContain: ['orphan_in_dollar_comment'],
  },
  {
    name: 'a custom $tag$ ... $tag$ body is recognised, not just $$',
    sql:
      'CREATE FUNCTION f() RETURNS void AS $fn$ /* mentions hidden_tagged_orphan */ ' +
      'BEGIN NULL; END; $fn$ LANGUAGE plpgsql; SELECT visible_after_tag_fn();',
    mustContain: ['visible_after_tag_fn'],
    mustNotContain: ['hidden_tagged_orphan'],
  },
  {
    name: 'a positional parameter ($1, $2) is never mistaken for a dollar-quote opener',
    sql:
      'CREATE FUNCTION f(a int) RETURNS int AS $$ SELECT $1 + 1 FROM calls_real_fn(); $$ LANGUAGE sql; ' +
      'SELECT after_positional_param_orphan_check();',
    mustContain: ['calls_real_fn', 'after_positional_param_orphan_check', '$1'],
  },
  {
    name: 'an unterminated block comment is NOT treated as a comment (safe direction: never eat real code)',
    sql: 'SELECT 1; /* never closes\nkeep_this_visible_orphan_check();',
    mustContain: ['keep_this_visible_orphan_check'],
  },
  {
    name: 'an unterminated dollar-quote is NOT treated as a string (safe direction)',
    sql: 'SELECT 1; $$ never closes keep_this_too_orphan_check();',
    mustContain: ['keep_this_too_orphan_check'],
  },
];

for (const c of STRIP_CASES) {
  test(`stripSqlComments: ${c.name}`, () => {
    const clean = stripSqlComments(c.sql);
    for (const s of c.mustContain ?? []) {
      assert.ok(clean.includes(s), `expected cleaned text to still contain ${JSON.stringify(s)}, got:\n${clean}`);
    }
    for (const s of c.mustNotContain ?? []) {
      assert.ok(!clean.includes(s), `expected cleaned text to NOT contain ${JSON.stringify(s)}, got:\n${clean}`);
    }
  });
}

test('stripSqlComments: length and newline count are preserved (byte offsets stay true)', () => {
  const sql = "SELECT 1; /* a\nmulti-line\ncomment */ SELECT 2; -- trailing\n";
  const clean = stripSqlComments(sql);
  assert.equal(clean.length, sql.length, 'comment characters must be replaced with spaces, never deleted');
  assert.equal(clean.split('\n').length, sql.split('\n').length, 'newline count must be unchanged');
});

test('stripSqlComments: the CLOSING dollar-quote tag is written back, not dropped', () => {
  // Regression for a real bug caught before this shipped: the closing tag's
  // characters were never written into the output buffer, so they silently
  // became '' (not even a space) on join — deleting "$$" wholesale and
  // shifting every later `indexOf('$$', …)` in every OTHER consumer (e.g.
  // h6-mirrors-the-booking-path.test.ts, which finds a function's body by
  // re-searching the CLEANED text for its own closing tag) onto the wrong
  // text, or finding nothing at all.
  const sql = 'CREATE FUNCTION f() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql; SELECT real_call_after();';
  const clean = stripSqlComments(sql);
  assert.equal(clean.length, sql.length, 'the closing tag must not shrink the output');
  const opens = [...clean.matchAll(/\$\$/g)].length;
  assert.equal(opens, 2, `expected both the opening and closing "$$" to survive, got ${opens} occurrence(s) in:\n${clean}`);
  assert.ok(clean.includes('real_call_after'), 'code after the closing tag must still be found');
});

// ── SABOTAGE — prove the table above is not vacuous ─────────────────────────
//
// Each variant below reproduces one specific way an earlier or naive
// implementation gets this wrong. If any of these silently satisfied the same
// cases as the real `stripSqlComments`, the table above would not be proving
// anything. `lint-one-comment-stripper.mjs` already refuses one of these
// signatures (the two-regex version) anywhere else in the repo; these local
// copies exist ONLY to demonstrate the failure, matching the pattern this
// module's own META tests already use.

/** The ORIGINAL implementation this fix replaced: `--` only, no block comments. */
function sabotageLineCommentsOnly(sql: string): string {
  return sql
    .split('\n')
    .map((line) => {
      let inSingle = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === "'") inSingle = !inSingle;
        if (!inSingle && ch === '-' && line[i + 1] === '-') return line.slice(0, i);
      }
      return line;
    })
    .join('\n');
}

/** The well-documented wrong shape: two independent regex passes. */
function sabotageTwoRegexPasses(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
}

/** Block comments handled, but with NO depth tracking — stops at the first closer. */
function sabotageNoNesting(sql: string): string {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) break;
      i = end + 2;
      continue;
    }
    if (sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
      continue;
    }
    out += sql[i];
    i += 1;
  }
  return out;
}

/**
 * A "smarter" naive attempt: one continuous pass (so it does not have the
 * per-line-reset bug above), block + line comments, `''`-aware quote
 * toggling — but NO concept of a dollar-quoted body. Looks reasonable, and
 * is exactly the shape someone reaches for after fixing the per-line bug.
 */
function sabotageNoDollarQuotes(sql: string): string {
  let out = '';
  let inSingle = false;
  let i = 0;
  while (i < sql.length) {
    if (!inSingle && sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
      continue;
    }
    if (!inSingle && sql[i] === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) break;
      i = end + 2;
      continue;
    }
    if (sql[i] === "'") {
      if (inSingle && sql[i + 1] === "'") {
        out += "''";
        i += 2;
        continue;
      }
      inSingle = !inSingle;
    }
    out += sql[i];
    i += 1;
  }
  return out;
}

test('SABOTAGE: line-comments-only misses the block-comment case', () => {
  const sql = 'SELECT 1; /* mentions secret_fn() */ SELECT 2;';
  assert.ok(sabotageLineCommentsOnly(sql).includes('secret_fn'), 'sabotage should still leak the name');
  assert.ok(!stripSqlComments(sql).includes('secret_fn'), 'the real stripper must not');
});

test('SABOTAGE: two-regex-passes eats real code after a `--`-shaped glob comment', () => {
  const sql =
    '-- see apps/web/lib/vendor-autoreply/* for the reader\n' +
    'SELECT real_call_after_glob_comment();\n' +
    '/* a real block comment */\n' +
    'SELECT another_real_call();';
  assert.ok(
    !sabotageTwoRegexPasses(sql).includes('real_call_after_glob_comment'),
    'sabotage should eat the real call between the glob and the next real */',
  );
  assert.ok(
    stripSqlComments(sql).includes('real_call_after_glob_comment'),
    'the real stripper must keep it',
  );
});

test('SABOTAGE: no-nesting stops at the first `*/`, un-hiding the outer tail', () => {
  const sql =
    '/* opens mentioning zzz_inner_orphan /* nested */ still commented, ' +
    'mentioning zzz_outer_tail_orphan */ real_call_after_nesting();';
  assert.ok(
    sabotageNoNesting(sql).includes('zzz_outer_tail_orphan'),
    'sabotage should leave the outer tail looking like live code',
  );
  assert.ok(
    !stripSqlComments(sql).includes('zzz_outer_tail_orphan'),
    'the real stripper must still see it as commented',
  );
});

test('SABOTAGE: resetting quote-tracking per line loses code after a multi-line string', () => {
  const sql =
    "SELECT 'line one\nline two -- looks like a comment but is still inside the string'; " +
    'SELECT real_call_after_multiline_string();';
  assert.ok(
    !sabotageLineCommentsOnly(sql).includes('real_call_after_multiline_string'),
    'sabotage resets in-string tracking at the start of "line two" and wrongly treats the -- there as real, deleting the rest of the line',
  );
  assert.ok(
    stripSqlComments(sql).includes('real_call_after_multiline_string'),
    'the real stripper scans the whole text at once, so the string opened on line one is still open on line two',
  );
});

test('SABOTAGE: no-dollar-quote-awareness lets ONE stray quote inside a body desync the REST OF THE FILE', () => {
  // `it's_fine_actually` is not valid SQL (identifiers cannot hold an
  // apostrophe) — it stands in for whatever real-world case leaves a single
  // unmatched quote inside a dollar-quoted body. Without a dollar-quote
  // boundary that resyncs regardless of what happened inside, that ONE
  // stray `'` flips in-string tracking and it never flips back (there is no
  // later quote to close it), so EVERY comment for the rest of the file
  // stops being recognised as a comment — a name that should have been
  // stripped now reads as live code, which is the exact miss this file
  // exists to close.
  const sql =
    "DO $$ BEGIN PERFORM it's_fine_actually(); END $$; " +
    '-- mentions leaked_because_of_desync_orphan\n' +
    'SELECT after_dollar_close_orphan_check();';
  const sabotaged = sabotageNoDollarQuotes(sql);
  assert.ok(
    sabotaged.includes('leaked_because_of_desync_orphan'),
    'sabotage should leak the name out of a comment it can no longer recognise as one',
  );
  const clean = stripSqlComments(sql);
  assert.ok(
    !clean.includes('leaked_because_of_desync_orphan'),
    'the real stripper resyncs at the dollar-quote boundary, so the comment after it is still recognised',
  );
  assert.ok(
    clean.includes('after_dollar_close_orphan_check'),
    'and the real code after that comment is still there',
  );
});
