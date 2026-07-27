/**
 * PHANTOM-COLUMN GUARD, PART 2 — filters and write payloads.
 *
 * Part 1 (`select-column-scan.test.ts`) guards `.select('…')`. This guards the
 * other two places a column name is typed, which fail identically (42703 →
 * `{ data: null }` → a downstream `?? []` renders it as "no rows"):
 *
 *   FILTERS  .eq('col', v) · .in('col', […]) · .order('col') · .not('col', …)
 *   WRITES   .insert({ col: v }) · .update({ col: v }) · .upsert({ col: v })
 *
 * WHAT THE FIRST RUN FOUND (2026-07-27) — both real, both invisible to part 1:
 *   · `vendor_profiles.is_active` ×2 — `vendor_profiles` has no such column, so
 *     BOTH partnership pickers (admin and vendor-facing) returned zero rows.
 *     Nobody could add a partnership on either side.
 *   · `event_vendors.vendor_profile_id` ×2 in `lib/vendor-activity.ts` — the
 *     same phantom that killed `lib/ghosting.ts`, but named ONLY in a filter, so
 *     the select-list guard could not see it. Finalized-booking and
 *     vendor-cancellation counts were permanently 0 for every vendor, feeding
 *     `vendor_activity_stats` and the quality score that ranks the marketplace.
 *
 * HOW THIS TEST IS SHAPED (house style: select-column-scan.test.ts)
 *   · A RATCHET, NOT A WALL — `KNOWN_PHANTOMS` starts EMPTY with ceiling 0.
 *   · ANTI-VACUITY ENFORCED, NOT ASSUMED — a guard that quietly matches nothing
 *     converts "unexamined" into "verified". T4–T6 prove the scanners found real
 *     work, and T7–T9 prove detection against fixtures independent of repo state.
 *   · ATTRIBUTION IS PINNED (T10). The first implementation used part 1's
 *     character window and produced a 67% FALSE-POSITIVE rate — four of six
 *     reports were filters belonging to a different statement. Those three leaks
 *     are regression-tested here, because a guard that cries wolf gets its
 *     findings allow-listed, which is how a ratchet rots into a rubber stamp.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSchema } from './migration-schema';
import { findPhantomColumns, type PhantomColumn } from './select-column-scan';
import {
  extractFilterSites,
  extractWriteSites,
  parseObjectKeys,
  scanFilterSites,
  scanWriteSites,
} from './query-column-scan';

/**
 * `table.column` entries reported but NOT bugs. EMPTY, and it should stay that
 * way: unlike part 1 (whose two entries are migration-parser blind spots), this
 * scanner drops everything it cannot resolve with certainty, so a report here
 * is a real phantom until proven otherwise. Adding an entry requires raising
 * the ceiling in the same commit, deliberately and visibly.
 */
const KNOWN_PHANTOMS: Record<string, string> = {};
const KNOWN_PHANTOM_CEILING = 0;

/** Floors that make the anti-vacuity tests meaningful. */
const MIN_FILTER_SITES = 2500;
const MIN_WRITE_SITES = 700;

function describe(p: PhantomColumn): string {
  return `${p.file}:${p.line}  .from('${p.table}') … '${p.column}'`;
}

function report(kind: string, phantoms: PhantomColumn[]): string {
  return (
    `${phantoms.length} phantom ${kind} column reference(s):\n` +
    phantoms.map((p) => `  ${describe(p)}`).join('\n') +
    `\n\n  PostgREST fails the WHOLE statement with 42703 and supabase-js resolves\n` +
    `  { data: null }, so a downstream \`?? []\` renders a broken query as an\n` +
    `  empty result. Fix the column name — do not allow-list it.`
  );
}

// ── T1–T2 · the guard itself ─────────────────────────────────────────────────

test('T1 · no FILTER (.eq/.in/.order/…) names a column the migrations never declared', () => {
  const phantoms = findPhantomColumns(scanFilterSites(), readSchema()).filter(
    (p) => !(p.key in KNOWN_PHANTOMS),
  );
  assert.deepEqual(phantoms.map(describe), [], report('filter', phantoms));
});

test('T2 · no WRITE payload (.insert/.update/.upsert) names an undeclared column', () => {
  const phantoms = findPhantomColumns(scanWriteSites(), readSchema()).filter(
    (p) => !(p.key in KNOWN_PHANTOMS),
  );
  assert.deepEqual(phantoms.map(describe), [], report('write', phantoms));
});

test('T3 · KNOWN_PHANTOMS may only shrink', () => {
  const n = Object.keys(KNOWN_PHANTOMS).length;
  assert.ok(
    n <= KNOWN_PHANTOM_CEILING,
    `KNOWN_PHANTOMS has ${n} entries, ceiling is ${KNOWN_PHANTOM_CEILING}. ` +
      'This scanner drops everything ambiguous, so a report is a real bug.',
  );
});

// ── T4–T6 · anti-vacuity against repo state ──────────────────────────────────

test('T4 · the filter scanner found substantial work', () => {
  const sites = scanFilterSites();
  assert.ok(
    sites.length >= MIN_FILTER_SITES,
    `only ${sites.length} filter sites (expected >= ${MIN_FILTER_SITES}) — the ` +
      'scanner has probably stopped matching, making T1 vacuous.',
  );
});

test('T5 · the write scanner found substantial work', () => {
  const sites = scanWriteSites();
  assert.ok(
    sites.length >= MIN_WRITE_SITES,
    `only ${sites.length} write sites (expected >= ${MIN_WRITE_SITES}) — T2 would be vacuous.`,
  );
});

test('T6 · scanned tables overwhelmingly resolve against the schema', () => {
  const schema = readSchema();
  const sites = [...scanFilterSites(), ...scanWriteSites()];
  const known = sites.filter((s) => schema.get(s.table)).length;
  assert.ok(
    known / sites.length > 0.9,
    `only ${known}/${sites.length} sites resolve to a known table — attribution is drifting.`,
  );
});

// ── T7–T9 · fixture controls, independent of repo state ──────────────────────

test('T7 · POSITIVE control — a phantom filter column IS detected', () => {
  const src = `await db.from('events').select('event_id').eq('nonexistent_col', 1);`;
  const sites = extractFilterSites(src, 'fixture.ts');
  assert.equal(sites.length, 1);
  assert.deepEqual(sites[0]!.columns, ['nonexistent_col']);
  assert.equal(sites[0]!.table, 'events');
});

test('T8 · POSITIVE control — write payload keys ARE detected', () => {
  const src = `await db.from('events').insert({ display_name: 'x', bogus_col: 2 });`;
  const sites = extractWriteSites(src, 'fixture.ts');
  assert.equal(sites.length, 1);
  assert.deepEqual(sites[0]!.columns, ['display_name', 'bogus_col']);
});

test('T9 · NEGATIVE controls — the unknowable is DROPPED, never guessed', () => {
  // Interpolation, embedded/joined references and JSON paths carry no reliable
  // claim about THIS table, so none of them may produce a column.
  assert.deepEqual(
    extractFilterSites("db.from('events').eq(`${col}`, 1);", 'f.ts'),
    [],
    'interpolated filter column',
  );
  assert.deepEqual(
    extractFilterSites("db.from('a').select('x').eq('other_table.col', 1);", 'f.ts'),
    [],
    'embedded/joined reference belongs to another table',
  );
  assert.deepEqual(
    extractFilterSites("db.from('a').select('x').eq('config->>key', 1);", 'f.ts'),
    [],
    'json path',
  );
  // A spread or a computed key makes the payload's real key set unknowable.
  assert.equal(parseObjectKeys('{ ...patch, id: 1 }'), null, 'spread');
  assert.equal(parseObjectKeys('{ [dynamic]: 1 }'), null, 'computed key');
  assert.deepEqual(
    extractWriteSites("db.from('events').insert({ ...patch, display_name: 'x' });", 'f.ts'),
    [],
    'a site with a spread must be dropped whole, not partially judged',
  );
});

// ── T10 · attribution regressions — the false positives that shaped this ─────

test('T10 · a filter belonging to a LATER statement is not blamed on this table', () => {
  // LEAK 1 — a DYNAMIC `.from(variable)`. The literal-only `.from()` regex does
  // not match it, so a character window never closed and the next statement's
  // filters were attributed to the previous literal table. Real case:
  // app/papic/me/[token]/photo/route.ts, where `.eq('moderation_state', …)` on
  // `.from(sourceTable)` was blamed on `photo_tags`.
  const dynamic = `
    const a = await db.from('photo_tags').select('source_id').eq('guest_id', g);
    const b = await db.from(sourceTable).select('x').eq('moderation_state', 'clean');
  `;
  const dynSites = extractFilterSites(dynamic, 'f.ts');
  assert.equal(dynSites.length, 1);
  assert.ok(
    !dynSites[0]!.columns.includes('moderation_state'),
    'a dynamic .from() starts a new statement — its filters are not photo_tags columns',
  );

  // LEAK 2 — a HELPER taking the table as a string argument. There is no
  // `.from()` at all, so a window would run straight through it. Real case:
  // lib/ugat/data.ts `headCount(admin, 'service_categories', q => q.eq('tier', 1))`
  // blamed on the preceding `.from('canonical_service_taxonomy')`.
  const helper = `
    const n = await db.from('canonical_service_taxonomy').select('tile_id');
    headCount(admin, 'service_categories', (q) => q.eq('tier', 1));
  `;
  const helperSites = extractFilterSites(helper, 'f.ts');
  assert.ok(
    !helperSites.some((s) => s.columns.includes('tier')),
    "a helper's callback filter belongs to the helper's table, not the previous .from()",
  );

  // LEAK 3 — a filter quoted inside a COMMENT while explaining the code below.
  // Real case: lib/erasure/purge.ts, whose comment cites
  // `.eq('subject_user_id', …)` above a DIFFERENT table's query.
  const commented = `
    const r = await db.from('events').select('event_id').eq('event_id', id);
    // ⚠ \`.eq('subject_user_id', targetUserId)\` is the whole point — see below.
  `;
  const commentSites = extractFilterSites(commented, 'f.ts');
  assert.ok(
    !commentSites.some((s) => s.columns.includes('subject_user_id')),
    'prose is not code',
  );
});

test('T10b · an apostrophe in a comment does not run the chain into the next statement', () => {
  // The write scanner's own false positive: a `//` comment containing an
  // apostrophe opened a string that never closed, so the paren matcher ran past
  // the statement and credited `.from('events')` with 16 columns belonging to
  // event_members / guests.
  const src = `
    await db.from('events').insert({
      // the couple's own row — apostrophe here used to break paren matching
      display_name: 'x',
    });
    await db.from('event_members').insert({ member_type: 'couple' });
  `;
  const sites = extractWriteSites(src, 'f.ts');
  const events = sites.find((s) => s.table === 'events');
  assert.ok(events, 'the events insert is still detected');
  assert.deepEqual(
    events!.columns,
    ['display_name'],
    'the chain must stop at the end of the events statement',
  );
});
