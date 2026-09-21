/**
 * ON THE DAY, THE INVITATION REARRANGES ITSELF — the guard for
 * `lib/day-of-lead.ts` and for the two slots it drives in site-body.tsx.
 *
 * Everything here EXECUTES the decision. The only file-reading tests are the
 * last block, and they exist because a pure module cannot prove that the page
 * actually asks it anything — a resolver can be perfect and unmounted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolveDayOfLead, type DayOfLeadInput } from './day-of-lead';
import { getDayOfPhase } from './day-of-mode';

const EVENT_DAY = '2026-12-18';

/** A sane identified guest on the day, for tests that vary one thing. */
const base: DayOfLeadInput = {
  eventDate: EVENT_DAY,
  today: EVENT_DAY,
  rsvpStatus: 'attending',
  hasPass: true,
  hasSchedule: true,
  hasCamera: true,
};

/**
 * The calendar day an INSTANT falls on, in a zone. This mirrors what
 * `manilaToday()` does to `Date.now()`, but for a stated instant — the test
 * needs to name the moment, and `manilaToday()` takes no argument.
 */
function dayInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(instant);
}

/* ─── 🕐 THE TIMEZONE TRAP, STATED AS AN INSTANT ──────────────────────────── */

test('00:30 in Manila on the wedding day IS the wedding day', () => {
  // 2026-12-18 00:30 +08:00. Half an hour into the day, guests asleep, the
  // page should already have rearranged itself.
  const instant = new Date('2026-12-17T16:30:00Z');

  assert.equal(dayInZone(instant, 'Asia/Manila'), '2026-12-18', 'precondition: Manila reads the 18th');
  assert.equal(dayInZone(instant, 'UTC'), '2026-12-17', 'precondition: UTC still reads the 17th');

  const manila = resolveDayOfLead({ ...base, today: dayInZone(instant, 'Asia/Manila') });
  assert.equal(manila.active, true, 'Manila decides the day, and in Manila it is the 18th');

  // THE SABOTAGE TARGET. Resolving the day in UTC — which is what
  // `new Date('2026-12-18')` and any bare Date arithmetic amount to here —
  // leaves the invitation in its planning order while the wedding is running.
  const utc = resolveDayOfLead({ ...base, today: dayInZone(instant, 'UTC') });
  assert.equal(utc.active, false, 'the UTC day is the 17th, which is NOT the wedding day');
});

test('23:30 in Manila on the eve is NOT the wedding day', () => {
  // The other edge, and the one a UTC reading gets wrong in the opposite
  // direction: 2026-12-17 23:30 +08:00 is 15:30Z on the 17th. Both agree here,
  // but half an hour later they diverge — pinned by the test above.
  const instant = new Date('2026-12-17T15:30:00Z');
  assert.equal(dayInZone(instant, 'Asia/Manila'), '2026-12-17');
  const lead = resolveDayOfLead({ ...base, today: dayInZone(instant, 'Asia/Manila') });
  assert.equal(lead.active, false, 'the night before is still the night before');
});

test('the lead day sits INSIDE the day-of live window, never outside it', () => {
  // The invariant from the module docblock: the invitation can never rearrange
  // itself on a page that is not already in its day-of state. Checked against
  // the SHIPPED window resolver rather than a re-derived one.
  for (const hhmm of ['00:30', '06:00', '12:00', '19:00', '23:30']) {
    const [h, m] = hhmm.split(':').map(Number);
    // Manila is UTC+8 with no DST, so the instant is the local time minus 8h.
    const instant = Date.UTC(2026, 11, 18, (h as number) - 8, m as number);
    const lead = resolveDayOfLead({ ...base, today: dayInZone(new Date(instant), 'Asia/Manila') });
    assert.equal(lead.active, true, `${hhmm} Manila is the wedding day`);
    assert.equal(
      getDayOfPhase(EVENT_DAY, 'Asia/Manila', instant),
      'live',
      `${hhmm} Manila must also be inside the live window`,
    );
  }
});

/* ─── 🚪 A GUEST WHO DECLINED IS NOT HANDED A DOOR PASS ───────────────────── */

test('a guest who declined gets no pass in the lead', () => {
  const declined = resolveDayOfLead({ ...base, rsvpStatus: 'declined' });
  assert.equal(declined.active, true, 'it is still the day for them');
  assert.equal(declined.passLeads, false, 'but the door pass does not lead');
  assert.ok(!declined.order.includes('pass'), 'and it is absent from the order');
  // Not a deletion: the rest of the day still reaches them.
  assert.deepEqual(declined.order, ['now', 'camera']);
});

test('every other reply keeps the pass', () => {
  for (const rsvp of ['attending', 'pending', 'maybe'] as const) {
    const lead = resolveDayOfLead({ ...base, rsvpStatus: rsvp });
    assert.equal(lead.passLeads, true, `${rsvp} keeps the pass`);
  }
});

test('no pass to show means no pass slot', () => {
  const lead = resolveDayOfLead({ ...base, hasPass: false });
  assert.equal(lead.passLeads, false);
  assert.deepEqual(lead.order, ['now', 'camera'], 'a guest is not sent to a pass that does not exist');
});

/* ─── THE ORDER ITSELF ────────────────────────────────────────────────────── */

test('the room leads in order: now, pass, camera', () => {
  assert.deepEqual(resolveDayOfLead(base).order, ['now', 'pass', 'camera']);
});

test('only the slots with something to show appear', () => {
  assert.deepEqual(
    resolveDayOfLead({ ...base, hasSchedule: false, hasCamera: false }).order,
    ['pass'],
  );
  assert.deepEqual(resolveDayOfLead({ ...base, hasPass: false, hasCamera: false }).order, ['now']);
});

test('the salutation steps back on the day, for everyone', () => {
  assert.equal(resolveDayOfLead(base).greetingStepsBack, true);
  assert.equal(resolveDayOfLead({ ...base, rsvpStatus: 'declined' }).greetingStepsBack, true);
  // Even with nothing at all to lead with, the day is still the day.
  const bare = resolveDayOfLead({ ...base, hasPass: false, hasSchedule: false, hasCamera: false });
  assert.equal(bare.greetingStepsBack, true);
  assert.deepEqual(bare.order, []);
});

/* ─── OFF THE DAY, THE MODULE IS INERT ────────────────────────────────────── */

test('every other day renders exactly as today — all flags false', () => {
  for (const today of ['2026-12-17', '2026-12-19', '2027-01-01', '2020-01-01']) {
    const lead = resolveDayOfLead({ ...base, today });
    assert.deepEqual(
      lead,
      { active: false, passLeads: false, greetingStepsBack: false, order: [] },
      `${today} leaves the page alone`,
    );
  }
});

test('a missing or malformed date never rearranges anything', () => {
  for (const eventDate of [null, undefined, '', 'soon', '2026-13-99x', '18/12/2026']) {
    assert.equal(resolveDayOfLead({ ...base, eventDate }).active, false, `eventDate=${eventDate}`);
  }
  for (const today of ['', 'today', 'not-a-day']) {
    assert.equal(resolveDayOfLead({ ...base, today }).active, false, `today=${today}`);
  }
});

test('a full timestamp in event_date is read as its calendar day', () => {
  const lead = resolveDayOfLead({ ...base, eventDate: `${EVENT_DAY}T00:00:00+08:00` });
  assert.equal(lead.active, true, 'the legacy timestamp shape still resolves to the day');
});

/* ─── THE PAGE ACTUALLY ASKS ──────────────────────────────────────────────── */

const SITE_BODY = readFileSync(
  join(__dirname, '..', 'app', '[slug]', '_components', 'site-body.tsx'),
  'utf8',
);

test('the guest page resolves the lead from this module, with Manila deciding', () => {
  assert.ok(
    SITE_BODY.includes('resolveDayOfLead('),
    'site-body.tsx calls the resolver (a perfect module nothing mounts is not a feature)',
  );
  assert.ok(
    /resolveDayOfLead\(\{[\s\S]{0,400}?today:\s*manilaToday\(\)/.test(SITE_BODY),
    'the call site passes manilaToday() — a bare Date here is the eight-hour bug',
  );
});

test('the pass and the salutation each have BOTH slots wired', () => {
  // The reorder is a move: each block is written once and mounted in one of two
  // places. If a slot is dropped the block silently disappears on that branch —
  // the exact "renders as emptiness" failure this stream keeps shipping.
  for (const [what, lead, rest] of [
    ['pass', 'dayOfLead.passLeads ? passCard : null', 'dayOfLead.passLeads ? null : passCard'],
    [
      'greeting',
      'dayOfLead.greetingStepsBack ? greetingBlock : null',
      'dayOfLead.greetingStepsBack ? null : greetingBlock',
    ],
  ] as const) {
    assert.ok(SITE_BODY.includes(lead), `${what}: the day-of slot is mounted`);
    assert.ok(SITE_BODY.includes(rest), `${what}: the ordinary slot is mounted`);
  }
});

test('the day-of lead is not a second fixed bar, and not inside the reveal article', () => {
  // ⛔ GuestHubBar was retired for covering the menu whole (fixed bottom-0
  // z-40 over a z-30 menu). And `position: fixed` does not behave inside
  // <article data-pahina-chapters>: the §6 reveal puts a transform on every
  // direct child, which becomes the containing block. This slice adds neither —
  // it only moves blocks that already render in the flow.
  const src = readFileSync(join(__dirname, 'day-of-lead.ts'), 'utf8');
  assert.ok(!/fixed|bottom-0|z-4\d/.test(src), 'the decision module carries no positioning at all');
});

test('the guest lead never consults the supplier booking-fee gate', () => {
  // Guests are not gated. lib/event-access-stage.ts narrows a SUPPLIER's view.
  const src = readFileSync(join(__dirname, 'day-of-lead.ts'), 'utf8');
  assert.ok(
    !src.includes("from '@/lib/event-access-stage'"),
    'a guest at a door must never meet a paywall',
  );
});
