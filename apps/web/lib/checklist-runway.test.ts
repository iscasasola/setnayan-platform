/**
 * checklist-runway.test.ts — a task may never be due before the plan existed.
 *
 * THE DEFECT, found by the owner on his own screen after CI, ~6000 unit tests
 * and ~700 db tests all passed on the broken behaviour:
 *
 *   He created a real `date` event, "Movie Night", whose only date candidate was
 *   THAT SAME DAY. The checklist opened with 0 of 4 done and all four already
 *   red — "Due Jul 25", "Due Jul 27", "Due Jul 29", "Due Jul 31" — on a plan
 *   twenty minutes old. The arithmetic was right (DATE_TEMPLATE runs 7/5/3/1
 *   days BEFORE the event, and the event was today); the experience was wrong.
 *
 * It is the COMMON case for these types, not an edge case: `date` and `hangout`
 * are exactly what people plan tonight for tonight. A brand-new checklist that
 * opens 100 % overdue is worse than no checklist — it teaches the user that red
 * means nothing.
 *
 * PR #3957 hit the same class of bug (a 90-day template on a same-week event)
 * and fixed it by SHRINKING the template. The rule underneath was untouched, so
 * the defect survived at a smaller scale. This file pins the RULE:
 *
 *   1. Never due before creation  — the invariant, asserted directly.
 *   2. Compress, don't back-date   — a short runway rescales the ladder.
 *   3. Same-day is legitimate      — no divide-by-zero, no empty list.
 *   4. Weddings are untouched      — proven by byte-identical output.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHECKLIST_TEMPLATE,
  buildChecklistSeed,
  checklistRunwayFor,
  dueDateForItem,
  effectiveOffsetDays,
  groupChecklistByPhase,
  toChecklistView,
  type ChecklistCategory,
  type ChecklistItemRow,
  type ChecklistTemplateItem,
} from './checklist';
import { EVENT_TYPE_CHECKLIST_DEFS } from './checklist-event-type-defs';

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO yyyy-mm-dd `n` days before `iso` (local-midnight arithmetic). */
function isoDaysBefore(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(y!, m! - 1, d!, 0, 0, 0, 0).getTime() - n * DAY_MS;
  const dt = new Date(t);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}

/** A persisted row built from a template item, as the seeder would write it. */
function rowsFromTemplate(
  template: ReadonlyArray<ChecklistTemplateItem>,
): ChecklistItemRow[] {
  return template.map((t, i) => ({
    item_id: `i${i}`,
    public_id: `S89C-${i}`,
    event_id: 'evt',
    template_key: t.key,
    title: t.title,
    category: t.category as ChecklistCategory,
    due_offset_days: t.dueOffsetDays,
    status: 'pending' as const,
    sort_order: (i + 1) * 10,
    completed_at: null,
    created_at: '2026-08-01T09:16:22.501940+00:00',
  }));
}

// ── 1 · Movie Night, exactly as the owner created it ─────────────────────────
// Real prod row 9b41095a…: event_type `date`,
// event_date NULL, date_candidates ['2026-08-01'] (which is what the checklist
// page anchors on for non-wedding types), created_at 2026-08-01T09:16:22Z,
// 4 seeded items at offsets 7/5/3/1.

const MOVIE_NIGHT_DATE = '2026-08-01';
const MOVIE_NIGHT_CREATED = '2026-08-01T09:16:22.501940+00:00';
const MOVIE_NIGHT_ROWS = rowsFromTemplate(EVENT_TYPE_CHECKLIST_DEFS.date!.template);

test('Movie Night: an event created FOR TODAY has nothing overdue', () => {
  const now = new Date(2026, 7, 1, 17, 40, 0); // 2026-08-01, local, minutes later
  const runway = checklistRunwayFor(MOVIE_NIGHT_ROWS, MOVIE_NIGHT_DATE, MOVIE_NIGHT_CREATED);

  assert.deepEqual(runway, { runwayDays: 0, templateSpanDays: 7 });

  const views = MOVIE_NIGHT_ROWS.map((r) =>
    toChecklistView(r, MOVIE_NIGHT_DATE, now, runway),
  );
  assert.equal(views.length, 4, 'all four tasks still render — this is not a filter');

  for (const v of views) {
    assert.equal(v.dueDate, MOVIE_NIGHT_DATE, `${v.template_key} should be due today`);
    assert.equal(v.daysUntilDue, 0, `${v.template_key} must not be overdue`);
    assert.ok(v.daysUntilDue! >= 0, `${v.template_key} is in the past — the defect`);
  }

  // The exact before/after the owner saw. BEFORE = no runway argument.
  const before = MOVIE_NIGHT_ROWS.map((r) => dueDateForItem(MOVIE_NIGHT_DATE, r.due_offset_days));
  assert.deepEqual(
    before,
    ['2026-07-25', '2026-07-27', '2026-07-29', '2026-07-31'],
    'the four back-dated due dates from the owner’s screenshot',
  );
  const after = MOVIE_NIGHT_ROWS.map((r) =>
    dueDateForItem(MOVIE_NIGHT_DATE, r.due_offset_days, runway),
  );
  assert.deepEqual(after, ['2026-08-01', '2026-08-01', '2026-08-01', '2026-08-01']);
});

test('Movie Night: the page groups it under the day itself, not "This week"', () => {
  const now = new Date(2026, 7, 1, 17, 40, 0);
  const groups = groupChecklistByPhase(
    MOVIE_NIGHT_ROWS,
    MOVIE_NIGHT_DATE,
    now,
    'date',
    MOVIE_NIGHT_CREATED,
  );

  // Not empty, and nothing lost — the failure mode PR #3957's own fix nearly shipped.
  assert.equal(groups.flatMap((g) => g.items).length, 4);
  assert.equal(groups.length, 1, 'one honest bucket, not four rows spread over stale headings');
  assert.equal(groups[0]!.phase!.label, 'The day itself');
  // The heading the owner actually saw is gone.
  assert.ok(
    !groups.some((g) => g.phase?.label === 'This week'),
    'an event happening today must not be captioned "This week"',
  );
});

// ── 2 · Compress, don't back-date ────────────────────────────────────────────

test('an event 3 days out spreads across the 3 days it has, instead of back-dating', () => {
  const eventDate = '2026-08-04';
  const created = '2026-08-01T09:00:00+00:00'; // 3 days of runway
  const runway = checklistRunwayFor(MOVIE_NIGHT_ROWS, eventDate, created);
  assert.deepEqual(runway, { runwayDays: 3, templateSpanDays: 7 });

  const due = MOVIE_NIGHT_ROWS.map((r) => dueDateForItem(eventDate, r.due_offset_days, runway));
  // 7/5/3/1 scaled into 3 days → 3/2/1/0.
  assert.deepEqual(due, ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04']);

  // The point of scaling rather than clipping: it is still a PLAN, not a pile.
  assert.equal(new Set(due).size, 4, 'four distinct days — not all stacked on one date');

  // Order is preserved: pick the place before you confirm the time.
  const sorted = [...due].sort();
  assert.deepEqual(due, sorted, 'compression must be monotonic in the authored offsets');

  // And nothing is born red.
  const now = new Date(2026, 7, 1, 9, 0, 0);
  for (const v of MOVIE_NIGHT_ROWS.map((r) => toChecklistView(r, eventDate, now, runway))) {
    assert.ok(v.daysUntilDue! >= 0, `${v.template_key} was born overdue`);
  }
});

test('THE INVARIANT: no task is ever due before the day the event was created', () => {
  // Swept across every runway from same-day to well past the template span, for
  // every short-runway template — the property, not a sampled example.
  for (const type of ['date', 'hangout'] as const) {
    const rows = rowsFromTemplate(EVENT_TYPE_CHECKLIST_DEFS[type]!.template);
    for (let runwayDays = 0; runwayDays <= 20; runwayDays += 1) {
      const eventDate = '2026-09-15';
      const createdDay = isoDaysBefore(eventDate, runwayDays);
      const runway = checklistRunwayFor(rows, eventDate, `${createdDay}T02:00:00+00:00`);
      for (const r of rows) {
        const due = dueDateForItem(eventDate, r.due_offset_days, runway)!;
        assert.ok(
          due >= createdDay,
          `${type}/${r.template_key}: due ${due} predates creation ${createdDay} (runway ${runwayDays}d)`,
        );
        assert.ok(due <= eventDate, `${type}/${r.template_key}: due ${due} is after the event`);
      }
    }
  }
});

test('post-event tasks stay anchored to the event, never rescaled into the runway', () => {
  // Wedding template offsets ≤ 0 are "the day itself" and after (claim the PSA
  // certificate, thank-you notes). Those are not planning lead time and must
  // survive compression untouched.
  const rows = rowsFromTemplate(CHECKLIST_TEMPLATE);
  const eventDate = '2026-09-15';
  const runway = checklistRunwayFor(rows, eventDate, '2026-08-01T00:00:00+00:00'); // 45d runway
  assert.ok(runway, 'a wedding 45 days out must compress');

  for (const r of rows) {
    if ((r.due_offset_days ?? 0) > 0) continue;
    assert.equal(
      effectiveOffsetDays(r.due_offset_days, runway),
      r.due_offset_days,
      `${r.template_key} is a day-of/after task and must not move`,
    );
    assert.equal(
      dueDateForItem(eventDate, r.due_offset_days, runway),
      dueDateForItem(eventDate, r.due_offset_days),
      `${r.template_key} due date must be identical with and without compression`,
    );
  }
});

// ── 3 · Same-day events are legitimate ───────────────────────────────────────

test('a same-day event does not divide by zero and does not render an empty list', () => {
  const eventDate = '2026-08-01';
  const runway = checklistRunwayFor(MOVIE_NIGHT_ROWS, eventDate, `${eventDate}T01:00:00+00:00`);
  assert.equal(runway!.runwayDays, 0);

  for (const r of MOVIE_NIGHT_ROWS) {
    const eff = effectiveOffsetDays(r.due_offset_days, runway);
    assert.ok(Number.isFinite(eff!), `${r.template_key} produced ${eff} — not a finite offset`);
    assert.equal(eff, 0);
    assert.match(dueDateForItem(eventDate, r.due_offset_days, runway)!, /^\d{4}-\d{2}-\d{2}$/);
  }

  const groups = groupChecklistByPhase(
    MOVIE_NIGHT_ROWS,
    eventDate,
    new Date(2026, 7, 1),
    'date',
    `${eventDate}T01:00:00+00:00`,
  );
  assert.ok(groups.length > 0, 'a same-day checklist must not render empty');
  assert.equal(groups.flatMap((g) => g.items).length, MOVIE_NIGHT_ROWS.length);
});

test('an event back-filled AFTER it happened floors at a same-day plan, not a negative scale', () => {
  const eventDate = '2026-07-01';
  const runway = checklistRunwayFor(MOVIE_NIGHT_ROWS, eventDate, '2026-08-01T09:00:00+00:00');
  assert.equal(runway!.runwayDays, 0, 'a negative runway must floor at zero');
  for (const r of MOVIE_NIGHT_ROWS) {
    // Never inverts the ladder, never runs past the event.
    assert.equal(dueDateForItem(eventDate, r.due_offset_days, runway), eventDate);
  }
});

// ── 4 · Weddings must not regress ────────────────────────────────────────────

test('a 540-day wedding is byte-identical — no compression engages at all', () => {
  const rows = rowsFromTemplate(CHECKLIST_TEMPLATE);
  const eventDate = '2028-01-23';
  const created = `${isoDaysBefore(eventDate, 540)}T04:30:00+00:00`;
  const now = new Date(2026, 7, 1);

  // The plan fits its runway ⇒ the rule declines to act.
  assert.equal(
    checklistRunwayFor(rows, eventDate, created),
    null,
    'a wedding with 540 days of runway must not be compressed',
  );

  // Due dates: identical, every row.
  for (const r of rows) {
    assert.equal(
      dueDateForItem(eventDate, r.due_offset_days, checklistRunwayFor(rows, eventDate, created)),
      dueDateForItem(eventDate, r.due_offset_days),
      `${r.template_key} due date drifted`,
    );
  }

  // Phases + grouping + ordering: byte-identical to calling it the old way.
  const withAnchor = groupChecklistByPhase(rows, eventDate, now, 'wedding', created);
  const legacy = groupChecklistByPhase(rows, eventDate, now, 'wedding');
  const shape = (gs: ReturnType<typeof groupChecklistByPhase>) =>
    JSON.stringify(
      gs.map((g) => [
        g.phase?.id ?? null,
        g.phase?.label ?? null,
        g.items.map((i) => [i.template_key, i.dueDate, i.daysUntilDue, i.effectiveOffsetDays]),
      ]),
    );
  assert.equal(shape(withAnchor), shape(legacy), 'wedding grouping changed');

  // …and the effective offset IS the authored offset, row for row.
  for (const g of withAnchor) {
    for (const i of g.items) {
      assert.equal(i.effectiveOffsetDays, i.due_offset_days, `${i.template_key} offset moved`);
    }
  }
});

test('the wedding seed still spans 540 days — the guard the 540-day proof rests on', () => {
  const span = Math.max(...buildChecklistSeed('evt').map((r) => r.due_offset_days ?? 0));
  assert.equal(span, 540, 'if the wedding template span changes, re-derive the regression proof');
});

// ── 5 · Degradation: no anchor, no date, no forward tasks ────────────────────

test('with no creation stamp the behaviour is exactly what shipped before', () => {
  const rows = rowsFromTemplate(CHECKLIST_TEMPLATE);
  const eventDate = '2026-08-15';
  for (const anchor of [null, undefined, '']) {
    assert.equal(checklistRunwayFor(rows, eventDate, anchor), null);
  }
  assert.equal(checklistRunwayFor(rows, null, '2026-08-01T00:00:00Z'), null);
});

test('an event with NO date at all still behaves as today — undated tasks group as they did', () => {
  const rows = rowsFromTemplate(EVENT_TYPE_CHECKLIST_DEFS.date!.template);
  const now = new Date(2026, 7, 1);
  const withAnchor = groupChecklistByPhase(rows, null, now, 'date', MOVIE_NIGHT_CREATED);
  const legacy = groupChecklistByPhase(rows, null, now, 'date');

  assert.equal(JSON.stringify(withAnchor), JSON.stringify(legacy));
  assert.equal(withAnchor.flatMap((g) => g.items).length, 4, 'no item may vanish');
  for (const g of withAnchor) {
    for (const i of g.items) {
      assert.equal(i.dueDate, null, 'no event date ⇒ no due date');
      assert.equal(i.daysUntilDue, null);
      assert.equal(i.effectiveOffsetDays, i.due_offset_days);
    }
  }
});

test('a list with no forward-looking tasks is not compressed (and never divides by zero)', () => {
  const rows: ChecklistItemRow[] = [
    { ...MOVIE_NIGHT_ROWS[0]!, due_offset_days: 0 },
    { ...MOVIE_NIGHT_ROWS[1]!, due_offset_days: -30 },
    { ...MOVIE_NIGHT_ROWS[2]!, due_offset_days: null },
  ];
  assert.equal(checklistRunwayFor(rows, '2026-08-01', MOVIE_NIGHT_CREATED), null);
});
