/**
 * event-dates.test.ts — ONE ladder, and the proof it changed nothing.
 *
 * `earliestKnownEventDate` was extracted from two independent copies that had
 * drifted apart in ADDRESS but not (yet) in behaviour:
 *
 *   - `resolveEarliestDate`      in lib/wedding-roadmap-signals.ts  (Studio)
 *   - `checklistAnchorDateFor`   in lib/checklist.ts, minus its wedding gate
 *
 * A de-duplication that quietly changes an edge case is the hardest kind of
 * change to review, so section 1 does not merely test the new helper — it pins
 * BOTH retired implementations verbatim and asserts all three agree across a
 * cross-product of the shapes the `events` row actually takes. If a future edit
 * to the shared ladder moves any of them, this file says so in the exact input
 * that moved.
 *
 * Section 2 covers the edge cases on their own terms. Section 3 is a source
 * contract: the shared helper must stay import-free (a value import from a
 * server module into a client-reachable file fails only at `next build`), and
 * both surfaces must keep CALLING it rather than re-inlining the ladder — which
 * is precisely how the #4020 defect was born.
 *
 * The wedding gate itself is NOT retested here; it belongs to the checklist and
 * is pinned by checklist-anchor.test.ts, which is untouched by this change.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { earliestKnownEventDate, type EventDateFields } from './event-dates';
import { checklistAnchorDateFor } from './checklist';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHARED = join(HERE, './event-dates.ts');
const CHECKLIST_LIB = join(HERE, './checklist.ts');
const ROADMAP_LIB = join(HERE, './wedding-roadmap-signals.ts');
const EVENT_BRIEF_LIB = join(HERE, './event-brief.ts');

// ── 1 · Equivalence with both retired copies ─────────────────────────────────

/** VERBATIM as it shipped in lib/wedding-roadmap-signals.ts @ b26652971. */
function retiredResolveEarliestDate(ev: EventDateFields): string | null {
  const candidates = ((ev.date_candidates ?? []) as string[])
    .filter(Boolean)
    .slice()
    .sort();
  return ev.event_date ?? candidates[0] ?? ev.date_window_start ?? null;
}

/**
 * VERBATIM as it shipped in lib/checklist.ts @ b26652971, with `event_type`
 * pinned to a non-wedding value so the gate is open and only the LADDER is
 * under comparison. (The gate's own behaviour is checklist-anchor.test.ts's.)
 */
function retiredChecklistLadder(event: EventDateFields): string | null {
  const lockedDate = event.event_date ?? null;
  const isWeddingLike = false;
  const earliestCandidate = (event.date_candidates ?? []).filter(Boolean).sort()[0] ?? null;
  return (
    lockedDate ??
    (isWeddingLike ? null : (earliestCandidate ?? event.date_window_start ?? null))
  );
}

/** Every shape the three date columns take in practice, plus the nasty ones. */
const EVENT_DATES: ReadonlyArray<string | null | undefined> = [
  '2027-02-14',
  null,
  undefined,
];
const CANDIDATE_SETS: ReadonlyArray<string[] | null | undefined> = [
  null,
  undefined,
  [],
  [''],
  ['', ''],
  ['2026-08-01'],
  ['2026-08-15', '2026-08-01'], // unsorted
  ['2026-08-15', '', '2026-08-01'], // unsorted WITH a hole
  ['not-a-date', '2026-08-01'], // malformed — sorts lexicographically, no validation
  ['2026-8-1', '2026-08-01'], // unpadded: sorts AFTER the padded form, by design
];
const WINDOW_STARTS: ReadonlyArray<string | null | undefined> = [
  '2026-07-01',
  null,
  undefined,
];

test('the shared ladder equals BOTH retired copies on every shape', () => {
  let checked = 0;
  for (const event_date of EVENT_DATES) {
    for (const date_candidates of CANDIDATE_SETS) {
      for (const date_window_start of WINDOW_STARTS) {
        // Fresh arrays per case — the old copies sort, and a shared literal
        // would let one case's mutation leak into the next.
        const shape = () => ({
          event_date,
          date_candidates: date_candidates ? [...date_candidates] : date_candidates,
          date_window_start,
        });
        const label = JSON.stringify({ event_date, date_candidates, date_window_start });
        const actual = earliestKnownEventDate(shape());
        assert.equal(actual, retiredResolveEarliestDate(shape()), `roadmap copy drifted: ${label}`);
        assert.equal(actual, retiredChecklistLadder(shape()), `checklist copy drifted: ${label}`);
        checked += 1;
      }
    }
  }
  // Guards the guard: a typo that empties a fixture list must not pass as 90
  // silent successes.
  assert.equal(checked, EVENT_DATES.length * CANDIDATE_SETS.length * WINDOW_STARTS.length);
  assert.equal(checked, 90);
});

test('a non-wedding checklist anchor is exactly the shared ladder', () => {
  // The gate is open for every non-wedding type, so the anchor must be the
  // ladder verbatim — this is the seam the extraction cut along.
  for (const event_type of ['date', 'birthday', 'hangout', 'corporate']) {
    for (const date_candidates of CANDIDATE_SETS) {
      const row = {
        event_type,
        event_date: null,
        date_candidates: date_candidates ? [...date_candidates] : date_candidates,
        date_window_start: '2026-07-01',
      };
      assert.equal(
        checklistAnchorDateFor(row),
        earliestKnownEventDate(row),
        `anchor ≠ ladder for ${event_type} / ${JSON.stringify(date_candidates)}`,
      );
    }
  }
});

// ── 2 · The edge cases on their own terms ────────────────────────────────────

test('a locked event_date wins over candidates and window alike', () => {
  assert.equal(
    earliestKnownEventDate({
      event_date: '2027-02-14',
      date_candidates: ['2026-08-01'],
      date_window_start: '2026-07-01',
    }),
    '2027-02-14',
  );
});

test('no locked date → the EARLIEST candidate, regardless of stored order', () => {
  assert.equal(
    earliestKnownEventDate({ date_candidates: ['2026-08-15', '2026-08-01', '2026-08-09'] }),
    '2026-08-01',
  );
});

test('an EMPTY or all-falsy candidate array must not shadow the window start', () => {
  // The regression this guards: `candidates[0]` on `['']` is `''`, which is
  // falsy but NOT nullish — so a `??` chain would return the empty string and
  // the window start would never be reached. `.filter(Boolean)` is what stops
  // that, and it is easy to "simplify" away.
  assert.equal(earliestKnownEventDate({ date_candidates: [], date_window_start: '2026-07-01' }), '2026-07-01');
  assert.equal(earliestKnownEventDate({ date_candidates: [''], date_window_start: '2026-07-01' }), '2026-07-01');
  assert.equal(
    earliestKnownEventDate({ date_candidates: ['', ''], date_window_start: '2026-07-01' }),
    '2026-07-01',
  );
  // A hole among real values is dropped, not sorted to the front.
  assert.equal(earliestKnownEventDate({ date_candidates: ['2026-08-15', '', '2026-08-01'] }), '2026-08-01');
});

test('null, undefined and a missing property are all "we know nothing"', () => {
  assert.equal(earliestKnownEventDate({}), null);
  assert.equal(
    earliestKnownEventDate({ event_date: null, date_candidates: null, date_window_start: null }),
    null,
  );
  assert.equal(
    earliestKnownEventDate({
      event_date: undefined,
      date_candidates: undefined,
      date_window_start: undefined,
    }),
    null,
  );
  // A caller that SELECTed fewer columns degrades, never throws.
  assert.equal(earliestKnownEventDate({ date_window_start: '2026-07-01' }), '2026-07-01');
});

test('the window start is the LAST resort, never a competitor', () => {
  // Even a window start EARLIER than every candidate loses — the ladder is
  // ordered by confidence, not by chronology.
  assert.equal(
    earliestKnownEventDate({ date_candidates: ['2026-08-01'], date_window_start: '2026-01-01' }),
    '2026-08-01',
  );
});

test('resolving does not mutate the caller row', () => {
  // The sort is in-place; if it ever ran on the caller's array instead of the
  // copy `.filter()` returns, the date picker downstream would silently start
  // rendering a reordered shortlist.
  const candidates = ['2026-08-15', '2026-08-01'];
  const row = { date_candidates: candidates };
  assert.equal(earliestKnownEventDate(row), '2026-08-01');
  assert.deepEqual(candidates, ['2026-08-15', '2026-08-01']);
  assert.equal(row.date_candidates, candidates, 'the property must still be the same array');
});

test('malformed values are NOT validated — the ladder sorts strings, as it always did', () => {
  // Pinned, not endorsed. Both retired copies behaved this way; a future
  // decision to validate is a product change, not a refactor, and this test is
  // where it announces itself.
  assert.equal(earliestKnownEventDate({ date_candidates: ['not-a-date', '2026-08-01'] }), '2026-08-01');
  assert.equal(earliestKnownEventDate({ date_candidates: ['not-a-date'] }), 'not-a-date');
  // Unpadded ISO sorts AFTER the padded form ('2026-0' < '2026-8'), so a
  // malformed sibling can lose to a well-formed one that is chronologically
  // later. Lexicographic ordering is only chronological for true yyyy-mm-dd.
  assert.equal(earliestKnownEventDate({ date_candidates: ['2026-8-1', '2026-12-01'] }), '2026-12-01');
  // An empty-string event_date is a value, not an absence — `??` passes it
  // through, exactly as both retired copies did.
  assert.equal(earliestKnownEventDate({ event_date: '', date_window_start: '2026-07-01' }), '');
});

test('a non-array date_candidates throws — the same blind spot both copies had', () => {
  // `date_candidates` is a Postgres `text[]`; nothing in the app can hand this
  // a string. Pinned so that if a reader ever does (a jsonb column, a hand-built
  // row), the failure is a known one rather than a surprise.
  assert.throws(() =>
    earliestKnownEventDate({ date_candidates: 'not-an-array' as unknown as string[] }),
  );
});

// ── 3 · Source contract: pure, and actually called ───────────────────────────

test('the shared module imports NOTHING', () => {
  // Purity is the reason this file can be imported from a client component.
  // A value import from a server module (`server-only`, Supabase, next/headers)
  // into a client-reachable file compiles fine locally and fails only at
  // `next build` — i.e. only in CI, after review.
  const src = readFileSync(SHARED, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /^\s*import\s/m, 'lib/event-dates.ts must stay dependency-free');
  assert.doesNotMatch(code, /require\(/, 'lib/event-dates.ts must stay dependency-free');
  assert.doesNotMatch(code, /'server-only'/, 'lib/event-dates.ts must never be server-gated');
});

test('every surface resolves the ladder THROUGH the shared helper', () => {
  // A behaviour test on the helper alone cannot see a surface that stopped
  // calling it — which is exactly how the two copies came to exist.
  //
  // lib/event-brief.ts joined this list as the THIRD caller: it carried a
  // fourth reading of these same three columns, and its copy was ordered
  // `candidates[0] ?? windowStart ?? eventDate` — committed date LAST, and
  // candidates unsorted. That fed a vendor-facing surface.
  for (const [label, path] of [
    ['lib/checklist.ts', CHECKLIST_LIB],
    ['lib/wedding-roadmap-signals.ts', ROADMAP_LIB],
    ['lib/event-brief.ts', EVENT_BRIEF_LIB],
  ] as const) {
    const src = readFileSync(path, 'utf8');
    assert.match(
      src,
      /import \{ earliestKnownEventDate.*\} from '@\/lib\/event-dates'/,
      `${label} must import the shared ladder`,
    );
    assert.match(
      src,
      /earliestKnownEventDate\(/,
      `${label} must call the shared ladder`,
    );
  }
});

test('neither surface re-inlines the ladder', () => {
  // The signature of a re-inlined copy: reading `date_window_start` in code
  // (not in prose) anywhere other than a type declaration.
  //
  // lib/event-brief.ts is deliberately NOT in this list, and the exclusion is
  // narrow rather than an exemption from the rule: the Brief EXPOSES
  // `constraints.date.windowStart` / `windowEnd` as fields of its read-model, so
  // it must read those columns for a purpose that is not the ladder. The
  // import+call guard above is what holds it to the shared ladder; this
  // heuristic would only produce a false positive.
  for (const [label, path] of [
    ['lib/checklist.ts', CHECKLIST_LIB],
    ['lib/wedding-roadmap-signals.ts', ROADMAP_LIB],
  ] as const) {
    const code = readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(
      code,
      /\.date_window_start/,
      `${label} reads date_window_start directly — the ladder has been re-inlined`,
    );
    assert.doesNotMatch(
      code,
      /\.date_candidates\s*\?\?/,
      `${label} re-derives the candidate list — the ladder has been re-inlined`,
    );
  }
});
