/**
 * Unit suite for the Decisions & Progress journey-stage builder. Load-bearing
 * invariants: the current-stage resolution mirrors the Overview's
 * `currentStage` exactly, stage percentages stay clamped 0–100, and every
 * Done / Still-to-do item is derived from the typed input (never invented).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProgressStages,
  resolveCurrentStage,
  type ProgressStagesInput,
} from './progress-stages';

/** A blank, brand-new event — nothing decided yet. */
function emptyInput(overrides: Partial<ProgressStagesInput> = {}): ProgressStagesInput {
  return {
    eventType: null,
    ceremonyType: null,
    eventDate: null,
    datePrecision: 'year',
    daysOut: null,
    venueName: null,
    paletteFinalizedAt: null,
    budgetTargetCentavos: null,
    guestsTotal: 0,
    guestsAttending: 0,
    guestsResponded: 0,
    lockedVendorCount: 0,
    totalLockableCategories: 12,
    seatedGuests: 0,
    paperworkTotal: 0,
    paperworkReceived: 0,
    pendingPaymentCount: 0,
    activeServiceCount: 0,
    ...overrides,
  };
}

/** Find a stage by key, asserting it exists (noUncheckedIndexedAccess-safe). */
function stageOf(
  r: ReturnType<typeof buildProgressStages>,
  key: string,
) {
  const s = r.stages.find((st) => st.key === key);
  assert.ok(s, `missing stage ${key}`);
  return s;
}

test('current-stage resolution mirrors the Overview ladder', () => {
  assert.equal(resolveCurrentStage(null, 0), 'dreaming');
  assert.equal(resolveCurrentStage(-1, 100), 'after');
  assert.equal(resolveCurrentStage(0, 100), 'wedding');
  assert.equal(resolveCurrentStage(30, 0), 'finalizing');
  // Guests present wins over the 180-day booking window.
  assert.equal(resolveCurrentStage(150, 42), 'inviting');
  assert.equal(resolveCurrentStage(150, 0), 'booking');
  assert.equal(resolveCurrentStage(400, 0), 'dreaming');
});

test('empty event: dreaming keeps the endowed item + three foundations to do', () => {
  const r = buildProgressStages(emptyInput());
  assert.equal(r.currentKey, 'dreaming');
  const dreaming = stageOf(r, 'dreaming');
  assert.equal(dreaming.key, 'dreaming');
  // Endowed progress: the "set up" fact is done the moment the event exists.
  assert.equal(dreaming.done.length, 1);
  assert.equal(dreaming.pct, 25);
  assert.equal(dreaming.todo.length, 3);
  // Six stages, always, in canonical order.
  assert.deepEqual(
    r.stages.map((s) => s.key),
    ['dreaming', 'booking', 'inviting', 'finalizing', 'wedding', 'after'],
  );
});

test('endowed progress: a fresh event never renders an all-empty journey', () => {
  // Minimal creation-time facts only — no date, guests, vendors, or orders.
  const fresh = buildProgressStages(emptyInput({ eventType: 'wedding' }));
  const dreaming = stageOf(fresh, 'dreaming');
  assert.ok(dreaming.done.length >= 1 && dreaming.done.length <= 2);
  assert.ok(dreaming.pct > 0, `dreaming pct must be > 0, got ${dreaming.pct}`);
  assert.ok(dreaming.done.some((i) => i.label === 'Your wedding is set up'));

  // Ceremony recorded at onboarding → the second endowed item appears.
  const withCeremony = buildProgressStages(
    emptyInput({ eventType: 'wedding', ceremonyType: 'catholic' }),
  );
  const dreaming2 = stageOf(withCeremony, 'dreaming');
  assert.equal(dreaming2.done.length, 2);
  assert.ok(
    dreaming2.done.some((i) => i.label === 'Ceremony chosen' && i.detail === 'catholic'),
  );

  // The rest of the journey is intact and honest (no other stage endowed).
  assert.equal(stageOf(fresh, 'booking').done.length, 0);
  assert.equal(stageOf(fresh, 'inviting').done.length, 0);
  assert.equal(stageOf(fresh, 'finalizing').done.length, 0);
});

test('all foundations set: dreaming hits 100%', () => {
  const r = buildProgressStages(
    emptyInput({
      eventDate: '2026-12-12',
      datePrecision: 'day',
      daysOut: 156,
      budgetTargetCentavos: 85_000_000,
      paletteFinalizedAt: '2026-05-01T00:00:00Z',
    }),
  );
  const dreaming = stageOf(r, 'dreaming');
  assert.equal(dreaming.pct, 100);
  assert.equal(dreaming.todo.length, 0);
  // 3 foundations + the endowed "set up" item.
  assert.equal(dreaming.done.length, 4);
});

test('month-precision date counts as narrowed, not chosen', () => {
  const r = buildProgressStages(
    emptyInput({ eventDate: '2026-12-01', datePrecision: 'month' }),
  );
  const dreaming = stageOf(r, 'dreaming');
  assert.ok(dreaming.todo.some((i) => i.label === 'Lock your exact date'));
  assert.ok(!dreaming.done.some((i) => i.label === 'Wedding date chosen'));
});

test('booking pct = locked ÷ lockable, with the open-count todo line', () => {
  const r = buildProgressStages(
    emptyInput({ lockedVendorCount: 6, totalLockableCategories: 12, venueName: 'Alta Veranda' }),
  );
  const booking = stageOf(r, 'booking');
  assert.equal(booking.pct, 50);
  assert.ok(booking.done.some((i) => i.detail === '6 of 12'));
  assert.ok(booking.todo.some((i) => i.label.includes('remaining 6')));
});

test('booking pct clamps when locked exceeds lockable', () => {
  const r = buildProgressStages(
    emptyInput({ lockedVendorCount: 15, totalLockableCategories: 12 }),
  );
  assert.equal(stageOf(r, 'booking').pct, 100);
  // No negative "remaining" line.
  assert.ok(!stageOf(r, 'booking').todo.some((i) => i.label.startsWith('Book your remaining')));
});

test('inviting blends list-built (50%) with response rate', () => {
  const none = buildProgressStages(emptyInput({ guestsTotal: 100 }));
  assert.equal(stageOf(none, 'inviting').pct, 50);
  const half = buildProgressStages(
    emptyInput({ guestsTotal: 100, guestsResponded: 50, guestsAttending: 40 }),
  );
  assert.equal(stageOf(half, 'inviting').pct, 75);
  assert.ok(stageOf(half, 'inviting').done.some((i) => i.detail === '50 of 100 answered'));
});

test('finalizing surfaces pending payments and paperwork counts', () => {
  const r = buildProgressStages(
    emptyInput({
      seatedGuests: 87,
      paperworkTotal: 4,
      paperworkReceived: 1,
      pendingPaymentCount: 2,
    }),
  );
  const finalizing = stageOf(r, 'finalizing');
  assert.ok(finalizing.done.some((i) => i.label === 'Seat plan started'));
  assert.ok(finalizing.todo.some((i) => i.detail === '1 of 4 received'));
  assert.ok(finalizing.todo.some((i) => i.label === 'Settle 2 pending payments'));
});

test('wedding day: pct flips to 100 on the day and after', () => {
  const before = buildProgressStages(
    emptyInput({ eventDate: '2026-12-12', datePrecision: 'day', daysOut: 10 }),
  );
  assert.equal(stageOf(before, 'wedding').pct, 0);
  assert.equal(before.currentKey, 'finalizing');

  const today = buildProgressStages(
    emptyInput({ eventDate: '2026-07-09', datePrecision: 'day', daysOut: 0 }),
  );
  assert.equal(stageOf(today, 'wedding').pct, 100);
  assert.equal(today.currentKey, 'wedding');

  const past = buildProgressStages(
    emptyInput({ eventDate: '2026-06-01', datePrecision: 'day', daysOut: -38 }),
  );
  assert.equal(stageOf(past, 'wedding').pct, 100);
  assert.equal(past.currentKey, 'after');
});

test('every stage pct stays within 0–100 and carries an aiNote', () => {
  const r = buildProgressStages(
    emptyInput({
      guestsTotal: 3,
      guestsResponded: 9, // pathological over-response
      lockedVendorCount: 99,
      totalLockableCategories: 0,
    }),
  );
  for (const s of r.stages) {
    assert.ok(s.pct >= 0 && s.pct <= 100, `${s.key} pct out of range: ${s.pct}`);
    assert.ok(typeof s.aiNote === 'string' && s.aiNote.length > 0);
  }
});
