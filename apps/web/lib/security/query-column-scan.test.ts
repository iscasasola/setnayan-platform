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
  EVENTS_PUBLIC_KEY,
  extractFilterSites,
  extractSurrogateIdFilterSites,
  extractWriteSites,
  parseObjectKeys,
  scanFilterSites,
  scanSurrogateIdFilters,
  scanWriteSites,
  SURROGATE_ID_RELATIONS,
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

// ── T11–T13 · PART 3 · the events family may never be filtered on `id` ───────
//
// Parts 1 and 2 both ask "does this column exist?" — and `events.id` does. It
// is just the WRONG one: `id` is the hidden bigserial, `event_id` is the uuid
// every route param holds. Passing the uuid to the bigint column fails the
// whole statement with 22P02, and the caller's `?? null` renders that as an
// event with nothing filled in. See the PART 3 block in query-column-scan.ts.

test('T11 · no query filters the events family on its hidden surrogate `id`', () => {
  const sites = scanSurrogateIdFilters();
  const lines = sites.map((s) => `${s.file}:${s.line}  .from('${s.table}') … .eq('id', …)`);
  assert.deepEqual(
    lines,
    [],
    'These filter `id` (bigint, internal-join only) instead of ' +
      `\`${EVENTS_PUBLIC_KEY}\` (uuid, what the route param holds). PostgREST ` +
      'rejects the WHOLE statement with 22P02 "invalid input syntax for type ' +
      'bigint", so the read returns nothing and any `?? null` downstream ' +
      `renders it as an empty event:\n  ${lines.join('\n  ')}`,
  );
});

test('T12 · POSITIVE control — the historical bad filters ARE detected', () => {
  // Verbatim shape of the two live defects fixed on 2026-07-28. If this ever
  // stops flagging, T11 is passing vacuously.
  const vendorsPage = `
    supabase
      .from('events_host')
      .select('event_date, estimated_budget_centavos, setnayan_ai_active')
      .eq('id', eventId)
      .maybeSingle(),
  `;
  const findDatePage = `
    supabase
      .from('events')
      .select('event_date, event_date_precision')
      .eq('id', eventId)
      .maybeSingle(),
  `;
  assert.deepEqual(
    extractSurrogateIdFilterSites(vendorsPage, 'vendors/page.tsx').map((s) => s.table),
    ['events_host'],
    'the events_host instance must be caught',
  );
  assert.deepEqual(
    extractSurrogateIdFilterSites(findDatePage, 'find-date/page.tsx').map((s) => s.table),
    ['events'],
    'the events instance must be caught',
  );
  // `.in('id', …)` and `.order('id')` fail the same way — cover the family.
  assert.equal(
    extractSurrogateIdFilterSites("db.from('events').select('x').in('id', ids);", 'f.ts').length,
    1,
    '.in() on the surrogate is the same defect',
  );
});

test('T13 · NEGATIVE controls — the correct filter and other tables are NOT flagged', () => {
  assert.deepEqual(
    extractSurrogateIdFilterSites(
      `db.from('events_host').select('event_date').eq('${EVENTS_PUBLIC_KEY}', eventId);`,
      'f.ts',
    ),
    [],
    'the FIXED shape must pass — otherwise the guard is unsatisfiable',
  );
  assert.deepEqual(
    extractSurrogateIdFilterSites("db.from('platform_settings').select('*').eq('id', 1);", 'f.ts'),
    [],
    'settings singletons legitimately key off an integer id',
  );
  assert.deepEqual(
    extractSurrogateIdFilterSites("db.from('guests').select('x').eq('id', rowId);", 'f.ts'),
    [],
    'only the events family is in scope — see the SCOPE note in the source',
  );
  // A neighbouring statement's filter must not be blamed on the events chain
  // (the chain walk owns this; pinned here because T11 asserts an EMPTY list
  // and a leak would make it fail on unrelated edits).
  assert.deepEqual(
    extractSurrogateIdFilterSites(
      `
      const a = await db.from('events').select('event_date').eq('event_id', id);
      const b = await db.from('vendor_coverages').select('x').eq('id', coverageId);
      `,
      'f.ts',
    ),
    [],
    "a later statement's .eq('id', …) is not the events chain's",
  );
  // PROSE IS NOT CODE. The PART 3 docblock in query-column-scan.ts quotes the
  // exact forbidden chain, and the guard reported its own docstring until the
  // extractor stripped comments first. Same class as T10's LEAK 3.
  assert.deepEqual(
    extractSurrogateIdFilterSites(
      `
      // Never write .from('events_host').select('x').eq('id', eventId) — see below.
      /* .from('events').select('x').eq('id', eventId) is the same defect. */
      const ok = await db.from('events').select('x').eq('event_id', eventId);
      `,
      'f.ts',
    ),
    [],
    'a forbidden chain quoted in a comment must not be reported as code',
  );
});

test('T14 · the guarded relation set is the events family, and both are real', () => {
  // Anti-drift: the set is small on purpose (see SCOPE). `events` must be a
  // table the migrations actually declare, and it must carry BOTH columns —
  // that dual key is the entire premise of this guard.
  assert.deepEqual([...SURROGATE_ID_RELATIONS].sort(), ['events', 'events_host']);
  const events = readSchema().get('events');
  assert.ok(events, 'no CREATE TABLE for public.events found in supabase/migrations');
  assert.ok(events!.cols.has('id'), 'events.id (the surrogate) must exist for the trap to exist');
  assert.ok(
    events!.cols.has(EVENTS_PUBLIC_KEY),
    `events.${EVENTS_PUBLIC_KEY} (the uuid) must exist for the fix to be valid`,
  );
});
