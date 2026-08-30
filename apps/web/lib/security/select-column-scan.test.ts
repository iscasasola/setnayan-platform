/**
 * PHANTOM-COLUMN GUARD — fails CI when a `.from('t').select('…')` names a
 * column no migration ever declared on `t`.
 *
 * THE BUG CLASS THIS ENDS
 * -----------------------
 * PostgREST fails the WHOLE query with `42703 undefined_column` when ANY named
 * column is unknown. supabase-js surfaces that as `{ data: null, error }`, and
 * a downstream `?? []` / `?? null` turns the failure into "no rows". The
 * feature then silently does nothing — in production, for months, with no
 * error, no red test and nothing in the type system to catch it. One bad column
 * also takes the whole ROW with it: a header selecting
 * `business_name, logo_url, city` loses the name and the logo too.
 *
 * A single sweep on 2026-07-26 found 26 such sites. Every one was real. Among
 * them: /studio/playlist redirected every visitor away because its events read
 * named `event_name`; the RA 10173 subject-access export told data subjects
 * they belonged to no events; the T-7-day vendor ghost-warning email had never
 * sent to anybody; a guest-merge safety check had never once executed.
 *
 * HOW THIS TEST IS SHAPED (house style: export-coverage-guardrail.test.ts)
 * -----------------------------------------------------------------------
 *  · A RATCHET, NOT A WALL. `KNOWN_PHANTOMS` pins what is not fixable today.
 *    T3 forbids it exceeding `KNOWN_PHANTOM_CEILING`; T4 forbids an entry
 *    lingering after the underlying cause is gone. The list may only shrink.
 *  · ANTI-VACUITY IS ENFORCED, NOT ASSUMED (T5–T8). A guard that quietly
 *    matches nothing is worse than no guard: it converts "unexamined" into
 *    "verified". This class survived precisely because everything downstream of
 *    it defaulted to empty. So the suite proves the schema parsed, proves the
 *    scanner found work to do, and proves — against fixtures, independent of
 *    repo state — that a phantom column IS detected and a real one is NOT.
 *
 * WHAT GREEN HERE DOES NOT MEAN
 * -----------------------------
 * See the HONEST LIMITS block in ./select-column-scan.ts. The load-bearing one:
 * this compares against the MIGRATIONS, and the migrations can themselves be
 * wrong about production. `CREATE TABLE IF NOT EXISTS` silently no-ops against
 * a pre-existing table of a different shape — the migration records as applied,
 * `db push` reports success, the column never lands. Two columns found in the
 * same sweep (`manpower_gigs.posted_by_user_id`,
 * `concierge_abuse_flags.admin_notes`) were declared in migrations and absent
 * from prod; this guard called both VALID while prod 42703'd on both. Closing
 * that needs a live-database diff, which does not exist yet.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readSchema } from './migration-schema';
import { stripComments } from '../strip-comments';
import {
  extractAllSelectConstants,
  extractConstantSelectSites,
  extractSelectConstants,
  extractSelectSites,
  findOmittedColumns,
  findPhantomColumns,
  isNearCopy,
  parseSelectList,
  resolveConstantSelectSites,
  scanAllSelectSites,
  scanForOmittedColumns,
  scanSelectSites,
  type PhantomColumn,
} from './select-column-scan';

/**
 * `table.column` entries the guard reports but that are NOT bugs — every one is
 * a blind spot in the migration parser, and every one was verified to EXIST in
 * the production database before being listed here.
 *
 * THIS LIST MAY ONLY SHRINK. To remove an entry, fix the parser gap (preferred)
 * or the query. To add one you must justify it here AND raise the ceiling in
 * the same commit, deliberately and visibly.
 */
const KNOWN_PHANTOMS: Record<string, string> = {
  // Both columns were created by `ALTER TABLE public.events RENAME COLUMN
  // editorial_tone TO story_tone` (and …_language), inside a DO block, in
  // 20260914000000_love_story_covert_renames.sql. readSchema() handles neither
  // RENAME COLUMN nor DO blocks, so it still believes the pre-rename names.
  // Confirmed present in prod 2026-07-26. Fixing this means teaching the shared
  // parser about RENAME — worth doing, but it changes what two OTHER guardrails
  // see, so it is not a drive-by.
  'events.story_tone': 'RENAME COLUMN inside a DO block — 20260914000000. Exists in prod.',
  'events.story_language': 'RENAME COLUMN inside a DO block — 20260914000000. Exists in prod.',
};

/**
 * Ceiling for `KNOWN_PHANTOMS`. Started at 2 on 2026-07-26 — down from the 22
 * this guard first reported, 20 of which were recovered by teaching
 * readSchema() to strip `--` comments before the ALTER pass (a prose semicolon
 * in a comment was truncating ALTER bodies before their first ADD COLUMN).
 * RAISING THIS NUMBER IS A DECISION, NOT A FIX.
 */
const KNOWN_PHANTOM_CEILING = 2;

/**
 * Relations `.from()` names that `readSchema()` cannot resolve — the guard's
 * structural BLIND SPOT, and now its own ratchet.
 *
 * `findPhantomColumns` does `if (!table) continue`: a site whose TABLE is
 * unknown is skipped entirely, so a query against a relation that exists
 * NOWHERE sails through the column guard untouched. That is not hypothetical —
 * `lib/setnayan-ai-snapshot.ts` read a bare `schedule_blocks` (the real relation
 * is `event_schedule_blocks`) and PostgREST answered 42P01 on every call. The
 * column guard shipped green over it, because it never looked.
 *
 * Skipping is nevertheless CORRECT for the entries below: `readSchema()` parses
 * `supabase/migrations` for `CREATE TABLE`, so it is blind to views and
 * materialized views by construction, and every one of these was verified
 * present in PRODUCTION on 2026-07-27 via `pg_class.relkind`. Allowlisting them
 * is what lets the guard flag the ONE relation that genuinely does not exist.
 *
 * THIS LIST MAY ONLY SHRINK. Adding an entry means either teaching the parser
 * about views, or admitting a real phantom table — say which, in the commit.
 */
const KNOWN_UNRESOLVED_TABLES: Record<string, string> = {
  bottleneck_signals_current: 'matview in prod; readSchema() parses CREATE TABLE only.',
  identity_clusters: 'matview in prod; readSchema() parses CREATE TABLE only.',
  vendor_fraud_scores: 'matview in prod; readSchema() parses CREATE TABLE only.',
  vendor_full_completed_events_stats: 'matview in prod; readSchema() parses CREATE TABLE only.',
  vendor_public_completed_events_stats: 'matview in prod; readSchema() parses CREATE TABLE only.',
  vendor_review_stats: 'matview in prod; readSchema() parses CREATE TABLE only.',
  vendor_trusted_review_stats: 'matview in prod; readSchema() parses CREATE TABLE only.',
  events_host: 'view in prod; readSchema() parses CREATE TABLE only.',
  vendor_market_stats: 'view in prod; readSchema() parses CREATE TABLE only.',
  reel_music_tracks:
    'ordinary TABLE in prod (relkind=r) that readSchema() does not pick up — a real ' +
    'parser gap, not a phantom. Worth closing; it is not a drive-by.',
  t: "not a query — the scanner reads the literal .from('t') in its own doc comment " +
    'at select-column-scan.ts:2. The extractor does not strip block comments.',
};

/**
 * Ceiling for `KNOWN_UNRESOLVED_TABLES`. Started at 11 on 2026-07-27, the full
 * set at the moment the blind spot was closed. RAISING IT IS A DECISION.
 */
const KNOWN_UNRESOLVED_CEILING = 11;

/** Relations named by a `.from()` that the migration schema cannot resolve. */
function unresolvedTables(): Map<string, string[]> {
  const schema = readSchema();
  const out = new Map<string, string[]>();
  for (const site of scanSelectSites()) {
    if (schema.get(site.table)) continue;
    const at = `${site.file}:${site.line}`;
    const prior = out.get(site.table);
    if (prior) prior.push(at);
    else out.set(site.table, [at]);
  }
  return out;
}

/** Minimum `.from().select()` pairs we must find, or the scanner is broken. */
const MIN_SELECT_SITES = 2000;
/** Minimum tables the migration parser must yield, or the schema is broken. */
const MIN_SCHEMA_TABLES = 300;

function describe(p: PhantomColumn): string {
  return `${p.file}:${p.line}  .from('${p.table}').select(… '${p.column}' …)`;
}

// ── T1 · the guard itself ────────────────────────────────────────────────────

test('T1 · no .from().select() names a column the migrations never declared', () => {
  const schema = readSchema();
  /*
    \u26a0 `scanAllSelectSites`, NOT `scanSelectSites`. The latter returns ONLY
    literal `.select('…')` calls. Until 2026-08-30 this test used it, so
    `.select(SOME_COLUMNS)` produced no site and was never checked — the guard
    did not resolve the constant and pass, it stopped looking. 74 select sites
    in this repo were unchecked. See T19/T20, which exist to stop that
    returning.
  */
  const sites = scanAllSelectSites().sites;
  const unexpected = findPhantomColumns(sites, schema).filter(
    (p) => !(p.key in KNOWN_PHANTOMS),
  );

  assert.equal(
    unexpected.length,
    0,
    `${unexpected.length} select(s) name a column that does not exist on the table being queried.\n` +
      'PostgREST fails the WHOLE query with 42703, so `.data` is null and any `?? []` downstream\n' +
      'renders the failure as "no rows" — the feature silently does nothing in production.\n\n' +
      unexpected.map((p) => `  ${describe(p)}`).join('\n') +
      '\n\nFix by (in order of preference):\n' +
      '  1. use the correct column name (check supabase/migrations, or the live catalog);\n' +
      '  2. if the column is genuinely gone, delete the read and simplify honestly —\n' +
      '     do not leave a branch that can never be true pretending to work;\n' +
      '  3. if the column exists in prod and only this parser cannot see it, add a\n' +
      '     KNOWN_PHANTOMS entry AND raise KNOWN_PHANTOM_CEILING in the same commit.\n' +
      '     Verify against the real database first — do not assume.\n' +
      '  While you are there: a read error and an empty result must not look the same.\n' +
      '  Report the error (lib/supabase/error-detect.ts → logQueryError) and still degrade.',
  );
});

// ── T2–T4 · the ratchet ──────────────────────────────────────────────────────

test('T2 · every KNOWN_PHANTOMS entry carries a reason', () => {
  for (const [key, reason] of Object.entries(KNOWN_PHANTOMS)) {
    assert.ok(
      reason.trim().length >= 20,
      `KNOWN_PHANTOMS['${key}'] needs a real explanation, not a placeholder.`,
    );
    assert.match(
      key,
      /^[a-z0-9_]+\.[a-z0-9_]+$/,
      `KNOWN_PHANTOMS key '${key}' must be exactly table.column.`,
    );
  }
});

test('T3 · KNOWN_PHANTOMS may only shrink', () => {
  const n = Object.keys(KNOWN_PHANTOMS).length;
  assert.ok(
    n <= KNOWN_PHANTOM_CEILING,
    `KNOWN_PHANTOMS has ${n} entries, ceiling is ${KNOWN_PHANTOM_CEILING}. ` +
      'Fix the query or the parser. Raising the ceiling is a deliberate act — ' +
      'say why in the commit message.',
  );
});

test('T4 · no KNOWN_PHANTOMS entry has gone stale (the backlog must not rot)', () => {
  const reported = new Set(
    findPhantomColumns(scanSelectSites(), readSchema()).map((p) => p.key),
  );
  const stale = Object.keys(KNOWN_PHANTOMS).filter((k) => !reported.has(k));
  assert.deepEqual(
    stale,
    [],
    `These KNOWN_PHANTOMS entries are no longer reported — the query or the parser was fixed.\n` +
      `Delete them and LOWER KNOWN_PHANTOM_CEILING to ${
        Object.keys(KNOWN_PHANTOMS).length - stale.length
      }, so the number keeps meaning something:\n` +
      stale.map((s) => `  ${s}`).join('\n'),
  );
});

// ── T5–T8 · anti-vacuity ─────────────────────────────────────────────────────
//
// The failure mode being defended against: the scanner silently matches
// nothing (a regex drifts, a directory moves, the parser returns empty) and T1
// passes forever while guarding literally zero queries. That is how the bug
// class survived in the first place — everything downstream defaulted to empty.

test('T5 · the migration parser returned a non-empty schema', () => {
  const schema = readSchema();
  assert.ok(
    schema.size >= MIN_SCHEMA_TABLES,
    `readSchema() yielded ${schema.size} tables, expected >= ${MIN_SCHEMA_TABLES}. ` +
      'An empty or shrunken schema makes T1 vacuous: with no known tables, every ' +
      'column is accepted and the guard passes while guarding nothing.',
  );
  const events = schema.get('events');
  assert.ok(events && events.cols.has('event_id'), 'events.event_id must be visible.');
});

test('T6 · the scanner found a non-trivial number of .from().select() pairs', () => {
  const sites = scanSelectSites();
  assert.ok(
    sites.length >= MIN_SELECT_SITES,
    `Found ${sites.length} .from().select() pairs, expected >= ${MIN_SELECT_SITES}. ` +
      'A collapsed count means the walk or the regex broke — T1 is then vacuous.',
  );
  // …and they must overwhelmingly resolve to tables the schema knows, or T1's
  // "unknown table ⇒ skip" escape hatch is swallowing everything.
  const schema = readSchema();
  const known = sites.filter((s) => schema.has(s.table)).length;
  assert.ok(
    known / sites.length > 0.9,
    `Only ${known}/${sites.length} sites hit a table the schema knows. Below 90% the ` +
      'skip-unknown-tables rule is doing the guarding, which is to say nothing is.',
  );
});

test('T7 · positive control — a phantom column IS detected (fixture, not repo state)', () => {
  const schema = readSchema();
  const src = `
    const { data } = await supabase
      .from('events')
      .select('event_id, display_name, totally_not_a_real_column')
      .eq('event_id', id);
  `;
  const sites = extractSelectSites(src, 'fixture.ts');
  assert.equal(sites.length, 1, 'the fixture must yield exactly one select site');
  assert.deepEqual(sites[0]?.columns, [
    'event_id',
    'display_name',
    'totally_not_a_real_column',
  ]);

  const found = findPhantomColumns(sites, schema);
  assert.deepEqual(
    found.map((p) => p.key),
    ['events.totally_not_a_real_column'],
    'the detector must flag the phantom and ONLY the phantom — if this fails, T1 ' +
      'is not proving anything about the repo either.',
  );
});

test('T8 · negative control — real columns and PostgREST syntax are NOT flagged', () => {
  const schema = readSchema();
  const src = `
    await supabase.from('event_vendors').select(
      'event_id, marketplace_vendor_id, status, event:events!inner(event_id, event_date)',
    );
    await supabase.from('events').select('*');
    await supabase.from('vendor_profiles').select('vendor_profile_id, services');
  `;
  const found = findPhantomColumns(extractSelectSites(src, 'fixture.ts'), schema);
  assert.deepEqual(
    found.map((p) => p.key),
    [],
    'embedded resources, aliases and * must not be mistaken for columns of the outer table.',
  );
});

// ── T9 · the select-list parser, directly ────────────────────────────────────

test('T9 · parseSelectList handles the PostgREST syntax this repo actually uses', () => {
  assert.deepEqual(parseSelectList('a, b,c'), ['a', 'b', 'c']);
  assert.deepEqual(parseSelectList('*'), []);
  assert.deepEqual(parseSelectList('alias:real_col'), ['real_col']);
  assert.deepEqual(parseSelectList('col::text'), ['col']);
  assert.deepEqual(parseSelectList('payload->>name'), ['payload']);
  // Embedded resources belong to another table — drop the body AND the
  // relationship name that introduces it.
  assert.deepEqual(parseSelectList('id, ev:events!inner(a, b), tail'), ['id', 'tail']);
  assert.deepEqual(parseSelectList('user:users!orders_user_id_fkey(email)'), []);
  // Multi-line select lists are the norm in this repo.
  assert.deepEqual(parseSelectList('\n  first,\n  second\n'), ['first', 'second']);
});

test('T10 · attribution guards — ambiguous or unknowable selects are DROPPED, not guessed', () => {
  // An interpolated select cannot be judged statically; it must be skipped
  // rather than half-parsed.
  const interpolated = 'supabase.from("events").select(`event_id, ${extra}`)';
  assert.deepEqual(extractSelectSites(interpolated, 'f.ts'), []);

  // A `.select()` that belongs to a LATER `.from()` must not be attributed to
  // the earlier one — this is the heuristic's main misattribution risk.
  const chained = `
    const q = supabase.from('events');
    const r = supabase.from('guests').select('guest_id');
  `;
  const sites = extractSelectSites(chained, 'f.ts');
  assert.deepEqual(
    sites.map((s) => s.table),
    ['guests'],
    "the bare .from('events') must claim no select of its own",
  );
});

// ── T11–T12 · the unresolved-TABLE ratchet ───────────────────────────────────
//
// Closes the blind spot described on KNOWN_UNRESOLVED_TABLES: the column guard
// skips any site whose table it cannot resolve, so a `.from()` naming a relation
// that exists nowhere was invisible to it. T1 asks "is every column real?"; this
// asks the question underneath it — "is the TABLE real?"

test('T11 · no .from() names a relation the migrations never declared', () => {
  const offenders = [...unresolvedTables()].filter(
    ([table]) => !(table in KNOWN_UNRESOLVED_TABLES),
  );
  assert.deepEqual(
    offenders.map(([table]) => table),
    [],
    'These relations are named by a .from() but exist in no migration:\n' +
      offenders
        .map(([table, sites]) => `  ${table}\n${sites.map((s) => `      ${s}`).join('\n')}`)
        .join('\n') +
      '\n\n  PostgREST answers 42P01 and supabase-js resolves { data: null }, so any\n' +
      '  `?? []` downstream renders an empty result for a query that never ran.\n' +
      '  Fix the table name. If it is a view or matview that genuinely exists in\n' +
      '  prod, add it to KNOWN_UNRESOLVED_TABLES with proof and raise the ceiling.',
  );
});

test('T12 · no KNOWN_UNRESOLVED_TABLES entry has gone stale, and the list may only shrink', () => {
  const n = Object.keys(KNOWN_UNRESOLVED_TABLES).length;
  assert.ok(
    n <= KNOWN_UNRESOLVED_CEILING,
    `KNOWN_UNRESOLVED_TABLES has ${n} entries, ceiling is ${KNOWN_UNRESOLVED_CEILING}.`,
  );
  for (const [table, reason] of Object.entries(KNOWN_UNRESOLVED_TABLES)) {
    assert.ok(
      reason.length > 20,
      `KNOWN_UNRESOLVED_TABLES['${table}'] needs a real explanation, not a placeholder.`,
    );
  }
  const reported = unresolvedTables();
  const stale = Object.keys(KNOWN_UNRESOLVED_TABLES).filter((t) => !reported.has(t));
  assert.deepEqual(
    stale,
    [],
    'These entries are no longer reported — the query was fixed, or the parser learned\n' +
      `the relation. Delete them and LOWER KNOWN_UNRESOLVED_CEILING to ${
        Object.keys(KNOWN_UNRESOLVED_TABLES).length - stale.length
      }:\n` + stale.map((s) => `  ${s}`).join('\n'),
  );
});

// ── T13–T18 · the OMITTED-column half (PART 2 of the scanner) ────────────────
//
// T1 asks "does every column in this list exist?". These ask the question the
// other way round — "is this list the same list the rest of the app uses?".
//
// THE BUG. On 2026-07-27 the vendor workspace hand-typed
// 'service_description, is_default_included, parent_option_id, display_order'
// for `vendor_package_items` instead of using VENDOR_PACKAGE_ITEM_SELECT. Every
// name was real, so T1 saw nothing. What was MISSING was the problem: without
// `item_id` a removal filter compares against `undefined` and can never match,
// and without `is_required` an absent boolean reads as FALSE, so a line the
// vendor marked mandatory could vanish from a day-of view while still being
// delivered and charged for.
//
// The repo-wide ratchet is scripts/dup-rule.baseline.txt (a reviewable file,
// not a constant in here). What lives here is what must hold regardless of
// repo state.

test('T13 · positive control from HISTORY — the workspace list that shipped IS flagged', () => {
  // Verbatim shapes from apps/web/.../[vendorId]/workspace/page.tsx at
  // faf95f925^ and from lib/vendor-packages.ts.
  const owner = `
    export const VENDOR_PACKAGE_ITEM_SELECT =
      'item_id, package_id, canonical_service, service_description, is_default_included, is_required, replacement_value_centavos, display_order, created_at';
  `;
  const caller = `
    await supabase.from('vendor_package_items').select(VENDOR_PACKAGE_ITEM_SELECT);
    await supabase
      .from('vendor_package_items')
      .select('service_description, is_default_included, parent_option_id, display_order');
  `;
  const constants = extractSelectConstants(owner, 'lib/vendor-packages.ts');
  assert.equal(constants[0]?.columns.length, 9, 'the canonical list must parse to 9 columns');

  const bindings = extractConstantSelectSites(caller, 'workspace.tsx');
  assert.deepEqual(
    bindings.map((b) => `${b.constant}→${b.table}`),
    ['VENDOR_PACKAGE_ITEM_SELECT→vendor_package_items'],
    'the constant learns its table from a real .from().select(CONST) in the repo',
  );

  const omissions = findOmittedColumns(
    extractSelectSites(caller, 'workspace.tsx'),
    bindings,
    constants,
  );
  assert.deepEqual(
    [...new Set(omissions.map((o) => o.column))].sort(),
    [
      'canonical_service',
      'created_at',
      'is_required',
      'item_id',
      'package_id',
      'replacement_value_centavos',
    ],
    'item_id and is_required — the two that made the page wrong — must be among them',
  );
});

test('T14 · negative control — a deliberately NARROW select is not accused', () => {
  // CASE 1 · a small read against a BIG canonical list. The real
  // VENDOR_PROFILE_EXPORT_SELECT names ~90 columns of vendor_profiles; a card
  // that wants three of them is correct, and the first version of this guard
  // accused it of omitting the other 87. The constant-side floor exists for
  // exactly this, and it is measured against a realistic list, not a toy one.
  const wide = Array.from({ length: 40 }, (_, i) => `col_${i}`);
  const owner = `
    export const VENDOR_PROFILE_EXPORT_SELECT =
      '${['business_name', 'logo_url', 'city', ...wide].join(', ')}';
  `;
  const caller = `
    await supabase.from('vendor_profiles').select(VENDOR_PROFILE_EXPORT_SELECT);
    await supabase.from('vendor_profiles').select('business_name, logo_url, city');
  `;
  assert.deepEqual(
    findOmittedColumns(
      extractSelectSites(caller, 'card.tsx'),
      extractConstantSelectSites(caller, 'card.tsx'),
      extractSelectConstants(owner, 'lib/x.ts'),
    ).map((o) => o.column),
    [],
    'a header that wants three columns of a forty-three-column export list is CORRECT, ' +
      'not a stale copy. Accusing it is how a guard gets switched off.',
  );

  // CASE 2 · a rich read that happens to share a few columns with a canonical
  // list about something else. `lib/event-preload.ts` reads a dozen `events`
  // columns and three of them also appear in SECTION_CONTENT_EVENT_COLUMNS.
  // It is not a copy of that list in either direction.
  const owner2 = `
    export const SECTION_CONTENT_EVENT_COLUMNS =
      'event_date, venue_name, venue_address, love_story, special_message, what_to_bring, our_photos';
  `;
  const caller2 = `
    await supabase.from('events').select(SECTION_CONTENT_EVENT_COLUMNS);
    await supabase.from('events').select(
      'event_id, display_name, event_date, venue_name, venue_address, slug, theme_key, status, owner_user_id, guest_count, created_at, updated_at',
    );
  `;
  assert.deepEqual(
    findOmittedColumns(
      extractSelectSites(caller2, 'preload.ts'),
      extractConstantSelectSites(caller2, 'preload.ts'),
      extractSelectConstants(owner2, 'lib/y.ts'),
    ).map((o) => o.column),
    [],
    'sharing three column names is not the same as being a copy — 43% of the constant and ' +
      '25% of the literal clears neither side of the near-copy test.',
  );
});

test('T15 · the near-copy rule is two-sided, and both sides are needed', () => {
  // The stale paste: reproduces most of the constant.
  assert.equal(isNearCopy(8, 10, 9), true);
  // The constant, trimmed: only 3 of 9 canonical columns, but 3 of the
  // literal's 4 — the historical workspace bug, which a one-sided rule misses.
  assert.equal(isNearCopy(3, 9, 4), true);
  // Genuinely narrow: three columns of a ninety-column export list. Without the
  // constant-side FLOOR this scored 100% "of literal" and reported 87 omissions.
  assert.equal(isNearCopy(3, 90, 3), false);
  // Coincidence: two shared names is `event_id, created_at`, which is on
  // almost every table.
  assert.equal(isNearCopy(2, 6, 2), false);
});

test('T16 · a constant is bound to the OUTER table only at the top level of a select', () => {
  // The constant lists columns of the table being queried — bind it.
  const topLevel = "supabase.from('vendor_package_items').select(`${ITEM_SELECT}, parent_option_id`)";
  assert.deepEqual(
    extractConstantSelectSites(topLevel, 'f.ts').map((b) => `${b.constant}→${b.table}`),
    ['ITEM_SELECT→vendor_package_items'],
  );
  // Inside an embedded resource it lists columns of ANOTHER table — binding it
  // to the outer one would be a lie, and would then accuse every honest select
  // on the outer table of omitting the inner table's columns.
  const embedded = "supabase.from('vendor_packages').select(`package_id, items:vendor_package_items(${ITEM_SELECT})`)";
  assert.deepEqual(extractConstantSelectSites(embedded, 'f.ts'), []);
  // A comment between `.select(` and the constant is a real shape in this repo
  // (vendors/packages/actions.ts) and must not hide the binding.
  const commented = `supabase.from('orders').select(
      // the canonical list, not a hand-typed copy
      ORDER_SELECT,
    )`;
  assert.deepEqual(
    extractConstantSelectSites(commented, 'f.ts').map((b) => b.constant),
    ['ORDER_SELECT'],
  );
  // Only *_SELECT / *_COLUMNS declare canonical intent — limit B.
  assert.deepEqual(extractConstantSelectSites("supabase.from('orders').select(COLS)", 'f.ts'), []);
});

test('T17 · constant VALUES parse from both the string and the array form', () => {
  const src = `
    export const A_SELECT =
      'item_id, package_id, ' +
      'is_required';
    export const B_COLUMNS = ['one', 'two', 'three'] as const;
    export const C_SELECT: string = 'alias:real_col, cast_col::text, embed:other(x, y)';
    // export const COMMENTED_SELECT = 'never, seen';
  `;
  const found = new Map(extractSelectConstants(src, 'f.ts').map((c) => [c.name, c.columns]));
  assert.deepEqual(found.get('A_SELECT'), ['item_id', 'package_id', 'is_required']);
  assert.deepEqual(found.get('B_COLUMNS'), ['one', 'two', 'three']);
  // Parsed by the SAME parseSelectList the literals use — one rule, one place.
  assert.deepEqual(found.get('C_SELECT'), ['real_col', 'cast_col']);
  assert.equal(found.has('COMMENTED_SELECT'), false, 'a commented-out constant is not a constant');
});

test('T18 · anti-vacuity — the omission scan really has something to compare', () => {
  const r = scanForOmittedColumns();
  assert.ok(
    r.literalSites.length >= MIN_SELECT_SITES,
    `${r.literalSites.length} literal select sites, expected >= ${MIN_SELECT_SITES}.`,
  );
  const bound = new Set(r.constantSites.map((s) => s.constant));
  assert.ok(
    bound.size >= 10,
    `only ${bound.size} canonical *_SELECT/*_COLUMNS constants resolved to a table — with ` +
      'nothing bound, the omission guard passes while comparing nothing.',
  );
  assert.ok(
    bound.has('VENDOR_PACKAGE_ITEM_SELECT'),
    'the constant at the centre of the original bug must still be bound to its table; if it ' +
      'is not, the guard has stopped watching the exact query that caused this.',
  );
  for (const o of r.omissions) {
    assert.match(o.key, /^[^\t]+\t[^\t]+\t[^\t]+\t[^\t]+$/, 'key is file⇥table⇥constant⇥column');
    assert.ok(o.line > 0);
  }
});

// ── T19–T20 · the guard on the guard ─────────────────────────────────────────

/**
 * \U0001f6a8 WHY THESE EXIST. On 2026-08-30 a session made a legitimate T1
 * failure disappear by rewriting `.select('points_cost')` as
 * `.select(SOME_CONSTANT)`. The runtime behaviour was byte-identical —
 * PostgREST still received the same name and still answered 42703 — but the
 * scanner matched only QUOTED select arguments, so the site vanished from its
 * view entirely and T1 went green. A proof tool that fails OPEN is worse than
 * none, because its green is read as evidence.
 *
 * T19 is the positive control: it fails if the phantom path ever stops
 * resolving constants. T20 is the ratchet on what resolution still cannot see.
 */
test('T19 · a phantom named through a CONSTANT is still reported', () => {
  const source = `
    const WIDGET_COLUMNS = 'widget_id, colour_that_does_not_exist';
    export async function read(db: any) {
      return db.from('widgets').select(WIDGET_COLUMNS);
    }
  `;
  const constants = extractAllSelectConstants(source, 'lib/widgets.ts');
  assert.equal(constants.length, 1, 'the file-local constant must be found (it has no `export`)');
  assert.deepEqual(constants[0]?.columns, ['widget_id', 'colour_that_does_not_exist']);
  assert.equal(constants[0]?.exported, false, 'and it must be tagged as file-local');

  const { resolved, unresolved } = resolveConstantSelectSites(
    extractConstantSelectSites(source, 'lib/widgets.ts'),
    constants,
  );
  assert.equal(unresolved.length, 0, 'a same-file constant must resolve');
  assert.deepEqual(resolved.map((r) => r.table), ['widgets']);

  const schema = new Map([['widgets', { cols: new Set(['widget_id']) } as never]]);
  const phantoms = findPhantomColumns(resolved, schema as never);
  assert.deepEqual(
    phantoms.map((p) => p.key),
    ['widgets.colour_that_does_not_exist'],
    'THE WHOLE POINT: a column hidden behind a constant must still be caught.\n' +
      'If this fails, the phantom path has stopped consuming resolved constants and\n' +
      '`.select(ANY_CONSTANT)` is once again invisible to T1.',
  );

  // A file-local constant must NOT resolve a site in a DIFFERENT file — that
  // binding does not exist at runtime either.
  const cross = resolveConstantSelectSites(
    [{ file: 'lib/other.ts', line: 1, table: 'widgets', constant: 'WIDGET_COLUMNS' }],
    constants,
  );
  assert.equal(cross.resolved.length, 0, 'a file-local constant is not visible elsewhere');
  assert.equal(cross.unresolved.length, 1, 'and it is surfaced as unresolved, not dropped');
});

/**
 * Constant select sites this scanner still cannot resolve. Each one is a select
 * T1 cannot check, so the number may only SHRINK.
 *
 * Measured 2026-08-30: 74 constant sites, 71 resolved, 3 unresolved.
 * RAISING THIS IS A DECISION, NOT A FIX.
 */
const UNRESOLVED_CONSTANT_CEILING = 3;

test('T20 · the unresolved-constant blind spot may only shrink', () => {
  const { constantSites, resolved, unresolved, literalSites, sites } = scanAllSelectSites();

  /*
    `sites` must BE the union. Without this, dropping `...resolved` from it
    restores the blind spot while `resolved.length > 0` below still passes —
    a mutation nothing else here would catch, since the repo currently hides
    zero phantoms behind constants.
  */
  assert.equal(
    sites.length,
    literalSites.length + resolved.length,
    'scanAllSelectSites().sites must be literal + resolved. If this fails, the ' +
      'resolved constant sites are being computed and then thrown away.',
  );

  assert.ok(
    constantSites.length > 50,
    `anti-vacuity: expected many .select(CONST) sites, saw ${constantSites.length}. ` +
      'If this collapsed to ~0 the resolution path has broken and T19 alone would not notice.',
  );
  assert.ok(resolved.length > 0, 'resolution must actually resolve something');

  assert.ok(
    unresolved.length <= UNRESOLVED_CONSTANT_CEILING,
    `${unresolved.length} constant-referenced select(s) cannot be resolved, over the ceiling of ` +
      `${UNRESOLVED_CONSTANT_CEILING}. Each is a select T1 CANNOT CHECK.\n` +
      unresolved.map((u) => `  ${u.file}:${u.line}  .from('${u.table}').select(${u.constant})`).join('\n') +
      '\n\nFix the resolver (preferred) or the call site. Do NOT raise the ceiling to go green.',
  );
});

/**
 * \U0001f6a8 THE MUTATION THAT NOTHING ELSE CATCHES. Today the repo has ZERO
 * phantoms hiding behind constants (74 sites, 71 resolved, 0 new findings), so
 * reverting T1 from `scanAllSelectSites()` to the literals-only
 * `scanSelectSites()` would change NO test result — it would silently restore
 * the exact blind spot this work closed, and every suite would stay green.
 *
 * Behaviour cannot catch that, so this reads the wiring itself. It is the same
 * reasoning as the repo's other source-level guards: when the defect is an
 * ABSENCE, assert the presence.
 *
 * Comments are stripped with the SHARED stripper — the one repaired in PR #5018
 * — because the docblock above names `scanSelectSites` while explaining why T1
 * must not use it. A raw match would find the disease and call it the cure.
 */
test('T21 · T1 is wired to the constant-aware scan, and cannot be quietly reverted', () => {
  const src = stripComments(readFileSync(new URL(import.meta.url), 'utf8'));
  const t1 = src.slice(src.indexOf("test('T1 ·"), src.indexOf("test('T2 ·"));
  assert.ok(t1.length > 200, 'anti-vacuity: T1 body must actually be located');

  assert.match(
    t1,
    /scanAllSelectSites\(\)/,
    'T1 must call scanAllSelectSites() — the constant-aware scan.\n' +
      'If this fails, someone reverted T1 to the literals-only path and every\n' +
      '.select(SOME_CONSTANT) in the app is invisible to the guard again.',
  );
  assert.doesNotMatch(
    t1,
    /[^l]scanSelectSites\(\)/,
    'T1 must NOT use the literals-only scanSelectSites() — that is the blind spot.',
  );
});
