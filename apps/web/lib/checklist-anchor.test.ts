/**
 * checklist-anchor.test.ts — ONE anchor, both checklist surfaces.
 *
 * THE DEFECT: the couple checklist is rendered on two screens a click apart,
 * and they dated the same event differently.
 *
 *   - `/dashboard/[eventId]/checklist` resolved the full ladder inline:
 *     locked `event_date` → earliest `date_candidates` → `date_window_start`,
 *     with weddings pinned to `event_date` alone.
 *   - the launcher's per-event card passed `e.event_date` straight into
 *     `dueDateForItem`, which returns null without a date — so every task
 *     counted as not-overdue.
 *
 * Reproduced in prod on event 9b41095a… ("Movie
 * Night", event_type `date`, event_date NULL, date_candidates ['2026-08-01']):
 * the page computed due dates for all four tasks, the card reported 0 overdue.
 * Under-reporting is the safe direction, which is exactly why it survived — but
 * two surfaces must not answer the same question differently.
 *
 * What this file pins:
 *   1. The ladder itself, including the wedding gate and NULL `event_type`.
 *   2. Weddings are untouched — the anchor IS `event_date`, always.
 *   3. Both CALL SITES actually call the helper. A test that only exercises
 *      `checklistAnchorDateFor` would stay green if a surface stopped calling
 *      it, which is precisely how the two drifted apart in the first place —
 *      so the call shape and the SELECT list are asserted from source.
 *   4. The anchor composes with PR #4017's runway rule: the runway is measured
 *      (creation → anchor), so the launcher's explicit `checklistRunwayFor` and
 *      the page's internal one must be fed the SAME anchor or the compression
 *      diverges too.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  checklistAnchorDateFor,
  checklistRunwayFor,
  dueDateForItem,
  groupChecklistByPhase,
  type ChecklistCategory,
  type ChecklistItemRow,
} from './checklist';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAUNCHER_PAGE = join(HERE, '../app/dashboard/(launcher)/page.tsx');
const CHECKLIST_PAGE = join(HERE, '../app/dashboard/[eventId]/checklist/page.tsx');
const EVENTS_LIB = join(HERE, './events.ts');

// ── 1 · The ladder ───────────────────────────────────────────────────────────

test('a locked event_date wins over every candidate', () => {
  assert.equal(
    checklistAnchorDateFor({
      event_type: 'date',
      event_date: '2026-09-09',
      date_candidates: ['2026-08-01', '2026-08-15'],
      date_window_start: '2026-07-01',
    }),
    '2026-09-09',
  );
});

test('no locked date → the EARLIEST candidate, regardless of stored order', () => {
  assert.equal(
    checklistAnchorDateFor({
      event_type: 'date',
      event_date: null,
      // Deliberately out of order: the column is an array, not a sorted set.
      date_candidates: ['2026-08-15', '2026-08-01', '2026-08-09'],
      date_window_start: '2026-07-01',
    }),
    '2026-08-01',
  );
});

test('no locked date and no candidates → the window start', () => {
  assert.equal(
    checklistAnchorDateFor({
      event_type: 'birthday',
      event_date: null,
      date_candidates: [],
      date_window_start: '2026-07-01',
    }),
    '2026-07-01',
  );
  // An all-empty candidate array must not shadow the window start.
  assert.equal(
    checklistAnchorDateFor({
      event_type: 'birthday',
      event_date: null,
      date_candidates: ['', ''],
      date_window_start: '2026-07-01',
    }),
    '2026-07-01',
  );
});

test('nothing set at all → null (no due dates, not a fabricated one)', () => {
  assert.equal(
    checklistAnchorDateFor({
      event_type: 'hangout',
      event_date: null,
      date_candidates: null,
      date_window_start: null,
    }),
    null,
  );
  // Absent keys behave like nulls — a caller that selected fewer columns must
  // degrade to "no anchor", never throw.
  assert.equal(checklistAnchorDateFor({}), null);
});

test('resolving the anchor does not mutate the caller row', () => {
  const candidates = ['2026-08-15', '2026-08-01'];
  const row = { event_type: 'date', event_date: null, date_candidates: candidates };
  assert.equal(checklistAnchorDateFor(row), '2026-08-01');
  // `.filter()` copies before `.sort()` — the row keeps its stored order, so a
  // later reader (the date picker) still sees what the DB returned.
  assert.deepEqual(candidates, ['2026-08-15', '2026-08-01']);
});

// ── 2 · Weddings are untouched ───────────────────────────────────────────────
// Weddings lock their date through the date-selection ceremony. Anchoring one
// on a mere candidate is a separate flagship decision nobody has made, and both
// surfaces already agreed on `event_date` alone — so this change must be a
// no-op for them, in every shape.

const WEDDING_TYPES = ['wedding', null] as const; // NULL event_type = legacy wedding

for (const t of WEDDING_TYPES) {
  const label = t ?? 'NULL event_type (legacy row)';

  test(`wedding — ${label}: candidates NEVER become the anchor`, () => {
    assert.equal(
      checklistAnchorDateFor({
        event_type: t,
        event_date: null,
        date_candidates: ['2026-08-01', '2027-02-14'],
        date_window_start: '2026-07-01',
      }),
      null,
      'an unlocked wedding must stay dateless — that is what the SetDateNudge is for',
    );
  });

  test(`wedding — ${label}: a locked date is passed through verbatim`, () => {
    assert.equal(
      checklistAnchorDateFor({
        event_type: t,
        event_date: '2027-02-14',
        date_candidates: ['2026-08-01'],
        date_window_start: '2026-07-01',
      }),
      '2027-02-14',
    );
  });

  test(`wedding — ${label}: the anchor IS event_date for every shape`, () => {
    // Byte-identical to the pre-change expression (`e.event_date`) across the
    // whole cross-product of candidate / window states.
    for (const eventDate of ['2027-02-14', null]) {
      for (const cands of [null, [], ['2026-08-01'], ['2026-08-15', '2026-08-01']]) {
        for (const win of ['2026-07-01', null]) {
          assert.equal(
            checklistAnchorDateFor({
              event_type: t,
              event_date: eventDate,
              date_candidates: cands,
              date_window_start: win,
            }),
            eventDate,
            `wedding anchor drifted for ${JSON.stringify({ eventDate, cands, win })}`,
          );
        }
      }
    }
  });
}

// ── 3 · The two call sites ───────────────────────────────────────────────────
// A behaviour test on the helper alone cannot see a surface that forgot to call
// it. These read the shipped sources.

test('the launcher card resolves the anchor through the shared helper', () => {
  const src = readFileSync(LAUNCHER_PAGE, 'utf8');
  assert.match(
    src,
    /checklistAnchorDateFor,?\n/,
    'launcher must import checklistAnchorDateFor from @/lib/checklist',
  );
  assert.match(
    src,
    /const anchorDate = checklistAnchorDateFor\(e\)/,
    'launcher must resolve the anchor from the whole event row',
  );
});

test('the launcher feeds the ANCHOR — not e.event_date — to the due-date math', () => {
  const src = readFileSync(LAUNCHER_PAGE, 'utf8');
  // The exact regression: `e.event_date` as the first argument silently yields
  // "0 overdue" for every non-wedding event whose date isn't locked yet.
  assert.doesNotMatch(
    src,
    /dueDateForItem\(\s*e\.event_date/,
    'dueDateForItem must be called with the resolved anchor',
  );
  assert.doesNotMatch(
    src,
    /checklistRunwayFor\([^)]*e\.event_date/,
    'checklistRunwayFor must measure the runway to the resolved anchor',
  );
  assert.match(src, /dueDateForItem\(anchorDate, i\.due_offset_days, runway\)/);
  assert.match(src, /checklistRunwayFor\(items, anchorDate, e\.created_at \?\? null\)/);
});

test('the checklist page resolves the anchor through the same helper', () => {
  const src = readFileSync(CHECKLIST_PAGE, 'utf8');
  assert.match(src, /checklistAnchorDateFor,?\n/, 'page must import the helper');
  assert.match(
    src,
    /const eventDate = checklistAnchorDateFor\(\{/,
    'page must resolve its anchor through the helper, not inline',
  );
  // The inline ladder is gone — if it comes back, the two can drift again.
  assert.doesNotMatch(
    src,
    /const isWeddingLike =/,
    'the wedding gate belongs to checklistAnchorDateFor now, not to the page',
  );
  // Multiline-tolerant since the call gained a sixth argument (the "has this
  // already happened" answer, 2026-08-23) and no longer fits one line. What
  // this pins is unchanged: the RESOLVED anchor is argument two.
  assert.match(
    src,
    /groupChecklistByPhase\(\s*rows,\s*eventDate,\s*now,\s*eventType,\s*eventCreatedAt,/,
    'the page must render from the resolved anchor',
  );
});

test('both call sites are handed the same four columns', () => {
  const pageSrc = readFileSync(CHECKLIST_PAGE, 'utf8');
  const eventsSrc = readFileSync(EVENTS_LIB, 'utf8');
  // The helper reads these; a surface that does not SELECT one silently
  // resolves a shorter ladder. `event_type` decides the wedding gate, so its
  // absence would anchor a WEDDING on a candidate — the one outcome this
  // change must never produce.
  for (const col of ['event_date', 'event_type', 'date_candidates', 'date_window_start']) {
    assert.ok(
      new RegExp(`\\b${col}\\b`).test(pageSrc.split('const rows =')[0]!),
      `checklist page must select ${col}`,
    );
    assert.ok(
      new RegExp(`\\b${col}\\b`).test(eventsSrc),
      `fetchUserEvents must select ${col} for the launcher card`,
    );
  }
  // Specifically inside fetchUserEvents' embedded `events:event_id (...)` list.
  const embedded = eventsSrc.split('events:event_id (')[1]!.split(')`')[0]!;
  for (const col of ['event_date', 'event_type', 'date_candidates', 'date_window_start', 'created_at']) {
    assert.ok(embedded.includes(col), `fetchUserEvents select must embed ${col}`);
  }
});

// ── 4 · The surfaces agree, and compose with #4017's runway ──────────────────

function rows(offsets: ReadonlyArray<number>): ChecklistItemRow[] {
  return offsets.map((o, i) => ({
    item_id: `i${i}`,
    public_id: `S89C-${i}`,
    event_id: 'evt',
    template_key: `k${i}`,
    title: `Task ${i}`,
    category: 'planning' as ChecklistCategory,
    due_offset_days: o,
    status: 'pending' as const,
    sort_order: (i + 1) * 10,
    completed_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
  }));
}

/** Every due date the PAGE renders, flattened out of its phase groups. */
function pageDueDates(
  items: ChecklistItemRow[],
  anchor: string | null,
  now: Date,
  eventType: string | null,
  createdAt: string | null,
): string[] {
  return groupChecklistByPhase(items, anchor, now, eventType, createdAt)
    .flatMap((g) => g.items)
    .map((v) => v.dueDate ?? 'none')
    .sort();
}

/** Every due date the LAUNCHER computes for its overdue count. */
function cardDueDates(
  items: ChecklistItemRow[],
  anchor: string | null,
  createdAt: string | null,
): string[] {
  const runway = checklistRunwayFor(items, anchor, createdAt);
  return items.map((i) => dueDateForItem(anchor, i.due_offset_days, runway) ?? 'none').sort();
}

test('candidates-but-no-locked-date: page and card resolve the SAME anchor', () => {
  const event = {
    event_type: 'date',
    event_date: null,
    date_candidates: ['2026-08-15', '2026-08-01'],
    date_window_start: '2026-07-01',
  };
  // Both surfaces now derive the anchor from the same row through the same
  // helper — there is one value, so there is nothing left to disagree about.
  const anchor = checklistAnchorDateFor(event);
  assert.equal(anchor, '2026-08-01');

  const items = rows([30, 14, 7, 1]);
  const createdAt = '2026-06-01T00:00:00.000Z'; // long runway ⇒ no compression
  const now = new Date(2026, 6, 20);

  assert.deepEqual(
    cardDueDates(items, anchor, createdAt),
    pageDueDates(items, anchor, now, 'date', createdAt),
  );
  // And the anchor is load-bearing: on the old `event_date`-only reading the
  // card had no dates at all, which is the bug.
  assert.deepEqual(cardDueDates(items, event.event_date, createdAt), [
    'none',
    'none',
    'none',
    'none',
  ]);
});

test('a compressed runway composes: same anchor ⇒ same compression on both', () => {
  // The runway is measured (creation → ANCHOR). Feeding one surface the
  // candidate and the other `event_date` would move the runway too, so the two
  // would disagree about the COMPRESSION as well as the dates.
  const event = {
    event_type: 'date',
    event_date: null,
    date_candidates: ['2026-08-01'],
    date_window_start: null,
  };
  const anchor = checklistAnchorDateFor(event);
  const items = rows([7, 5, 3, 1]);
  const createdAt = '2026-08-01T09:16:22.501940+00:00'; // created FOR today
  const now = new Date(2026, 7, 1, 17, 40, 0);

  assert.deepEqual(checklistRunwayFor(items, anchor, createdAt), {
    runwayDays: 0,
    templateSpanDays: 7,
  });
  assert.deepEqual(
    cardDueDates(items, anchor, createdAt),
    pageDueDates(items, anchor, now, 'date', createdAt),
  );
  // Movie Night, end to end: the card now HAS dates, and #4017's compression
  // pulls every one of them onto the event day, so nothing reads overdue.
  const todayISO = '2026-08-01';
  const overdue = cardDueDates(items, anchor, createdAt).filter(
    (d) => d !== 'none' && d < todayISO,
  );
  assert.deepEqual(overdue, [], 'a plan twenty minutes old must not open red');
});

test('an unlocked WEDDING still yields no due dates on either surface', () => {
  const event = {
    event_type: 'wedding',
    event_date: null,
    date_candidates: ['2027-02-14', '2027-02-21'],
    date_window_start: '2027-01-01',
  };
  const anchor = checklistAnchorDateFor(event);
  assert.equal(anchor, null);

  const items = rows([180, 90, 30, 7]);
  const createdAt = '2026-01-01T00:00:00.000Z';
  const now = new Date(2026, 7, 1);

  // Identical to the pre-change behaviour on BOTH surfaces: no anchor, no dates.
  assert.deepEqual(cardDueDates(items, anchor, createdAt), ['none', 'none', 'none', 'none']);
  assert.deepEqual(
    pageDueDates(items, anchor, now, 'wedding', createdAt),
    ['none', 'none', 'none', 'none'],
  );
  assert.deepEqual(
    cardDueDates(items, anchor, createdAt),
    cardDueDates(items, event.event_date, createdAt),
    'the wedding card must compute exactly what it computed before',
  );
});

test('a LOCKED wedding is byte-identical before and after the change', () => {
  const event = {
    event_type: 'wedding',
    event_date: '2027-02-14',
    date_candidates: ['2026-08-01'], // stale candidates from before the lock
    date_window_start: '2026-07-01',
  };
  const items = rows([180, 90, 30, 7]);
  const createdAt = '2026-01-01T00:00:00.000Z';

  // `checklistAnchorDateFor(event)` is the NEW reading; `event.event_date` is
  // the OLD one. Same value ⇒ same runway ⇒ same due dates.
  assert.equal(checklistAnchorDateFor(event), event.event_date);
  assert.deepEqual(
    cardDueDates(items, checklistAnchorDateFor(event), createdAt),
    cardDueDates(items, event.event_date, createdAt),
  );
});
