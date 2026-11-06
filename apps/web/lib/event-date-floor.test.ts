/**
 * 💍 NO EVENT BEFORE DECEMBER 19, 2026 — THE FOUNDERS' WEDDING IS THE FIRST.
 * (owner 2026-11-01, DECISION_LOG; `lib/event-date-floor.ts`)
 *
 * Two halves, both held here:
 *
 *  1. THE RULE — a normal account is refused 2026-12-18 and allowed 2026-12-19;
 *     an internal (founders') account is allowed any date; an existing event's
 *     date that is not being changed is never refused; the words are the
 *     owner's, verbatim.
 *
 *  2. EVERY DOOR ASKS IT — each server file that writes an event's date (or the
 *     candidate days / window it is created with) calls the rule, and a NEW file
 *     that writes one must either call it or be listed below with its reason.
 *     Every event-date picker a normal account sees starts at `eventDateMinFor`.
 *
 * Run from apps/web: `npx tsx --test lib/event-date-floor.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  EVENT_DATE_FLOOR_MESSAGE,
  FIRST_EVENT_DAY,
  candidatesOnOrAfterFirstEventDay,
  eventDateFloorRefusal,
  eventDateMinFor,
  eventDatesFloorRefusal,
  isBeforeFirstEventDay,
} from './event-date-floor';

const ROOT = path.resolve(__dirname, '..');

/* ── 1 · the rule ─────────────────────────────────────────────────────────── */

test('a normal account is refused December 18, 2026 — in the owner’s words', () => {
  assert.equal(eventDateFloorRefusal({ date: '2026-12-18', exempt: false }), EVENT_DATE_FLOOR_MESSAGE);
  assert.equal(eventDateFloorRefusal({ date: '2026-11-05', exempt: false }), EVENT_DATE_FLOOR_MESSAGE);
});

test('a normal account is allowed December 19, 2026 and later', () => {
  assert.equal(FIRST_EVENT_DAY, '2026-12-19');
  assert.equal(eventDateFloorRefusal({ date: '2026-12-19', exempt: false }), null);
  assert.equal(eventDateFloorRefusal({ date: '2027-06-12', exempt: false }), null);
});

test('an internal (founders’) account is allowed any date', () => {
  for (const d of ['2026-12-18', '2026-11-05', '2026-12-19', '2027-02-14']) {
    assert.equal(eventDateFloorRefusal({ date: d, exempt: true }), null, d);
  }
  assert.equal(eventDatesFloorRefusal(['2026-12-01', '2026-12-18'], true), null);
});

test('an existing event keeps its date until it is changed — then the rule applies', () => {
  const prior = { date: '2026-12-05', precision: 'day' };
  assert.equal(eventDateFloorRefusal({ date: '2026-12-05', precision: 'day', prior, exempt: false }), null, 'unchanged');
  assert.equal(eventDateFloorRefusal({ date: '2026-12-06', precision: 'day', prior, exempt: false }), EVENT_DATE_FLOOR_MESSAGE, 'moved');
  assert.equal(eventDateFloorRefusal({ date: '2026-12-20', precision: 'day', prior, exempt: false }), null, 'moved past it');
});

test('a month or year is read at its last day; clearing a date is always allowed', () => {
  assert.equal(eventDateFloorRefusal({ date: '2026-12-01', precision: 'month', exempt: false }), null, 'December 2026 reaches the 19th');
  assert.equal(eventDateFloorRefusal({ date: '2026-11-01', precision: 'month', exempt: false }), EVENT_DATE_FLOOR_MESSAGE);
  assert.equal(eventDateFloorRefusal({ date: '2026-01-01', precision: 'year', exempt: false }), null);
  assert.equal(isBeforeFirstEventDay('2026-11'), true, 'a bare month');
  assert.equal(eventDateFloorRefusal({ date: null, exempt: false }), null);
});

test('candidate days: one before the first day refuses the list; narrowing drops it', async () => {
  assert.equal(eventDatesFloorRefusal(['2027-01-09', '2026-12-18'], false), EVENT_DATE_FLOOR_MESSAGE);
  assert.equal(eventDatesFloorRefusal(['2026-12-19', null, '2027-01-09'], false), null);
  assert.deepEqual(await candidatesOnOrAfterFirstEventDay(['2026-12-12', '2026-12-26'], async () => false), ['2026-12-26']);
  assert.deepEqual(await candidatesOnOrAfterFirstEventDay(['2026-12-12', '2026-12-26'], async () => true), ['2026-12-12', '2026-12-26']);
});

test('a picker starts on the first day for a normal account, today for the founders', () => {
  assert.equal(eventDateMinFor('2026-11-01', false), '2026-12-19');
  assert.equal(eventDateMinFor('2026-11-01', true), '2026-11-01');
  assert.equal(eventDateMinFor('2027-03-01', false), '2027-03-01');
});

test('the refusal is the owner’s sentence, verbatim', () => {
  assert.equal(
    EVENT_DATE_FLOOR_MESSAGE,
    "Thank you for planning with Setnayan! Our very first event is our founders' wedding on December 18, 2026 — and we'd love for them to open the doors. Events start from December 19, 2026. Pick that day or later, and we can't wait to be part of yours.",
  );
});

/* ── 2 · every door asks it ───────────────────────────────────────────────── */

/** The rule's own names — a door "asks" when its source calls one. */
const ASKS = /\b(eventDateFloorRefusal|eventDatesFloorRefusal|candidatesOnOrAfterFirstEventDay)\(/;

/** Every server door that creates an event with a date or sets one. */
const DOORS = [
  'app/dashboard/[eventId]/actions.ts', // the date's ONE live door (updateEventDate): Settings, the Maker, Suppliers, Home
  'app/dashboard/(account)/create-event/actions.ts', // the create grid's candidate days / window
  'app/dashboard/[eventId]/date-selection/actions.ts', // Date Finder › Lock
  'lib/date-change.server.ts', // asking booked suppliers to move to a new date
  'app/onboarding/_shared/commit-event.ts', // every typed onboarding — "Worth planning" lands here
  'app/onboarding/wedding/actions.ts', // the wedding onboarding
  'app/onboarding/simple/actions.ts', // the Simple Event form
  'app/dashboard/[eventId]/studio/save-the-date/actions.ts', // the film date backfills an undated event
  'app/dashboard/[eventId]/vendors/actions.ts', // a supplier lock narrows to the one candidate left
  'lib/date-narrowing.server.ts', // …and the agreement-time narrowing
  'app/vendor-dashboard/invite/actions.ts', // a supplier's Locked QR carries the agreed date
  'app/dashboard/[eventId]/wizard-actions.ts', // the wizard's set-the-date card
];

/** Files that name a date column in a write but do not set an EVENT's date. */
const NOT_AN_EVENT_DATE_WRITE: Record<string, string> = {
  'app/admin/events/actions.ts': 'the audit snapshot of an event — a copy into admin_audit_log, not a date change',
  'lib/guest-reminder-emails.ts': "the reminder log's idempotency key (guest × milestone × date)",
  'lib/hub-draft.ts': 'the draft model: column → section names; every draft write passes hub-draft-actions.ts',
  'lib/payouts.ts': "a payout ledger entry's meta, copied from the event",
  'lib/proposal-send.ts': 'a proposal brief built from the event as it is',
  'lib/supplier-night-before-email.ts': "the night-before email log's idempotency key",
  'lib/vendor-couple-invite.ts': 'a list of the couple’s events, read for a supplier invite',
  'lib/vendor-invites.ts': 'a claim landing built from the event as it is',
};

function walk(dir: string, out: string[]): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || p.endsWith(`${path.sep}app${path.sep}dev`)) continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.|harness|\.d\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

const TYPE_WORD = /^(string|number|boolean|unknown|Date|null|undefined)\b/;

/** Files whose code (not comments, not string literals) puts a value into an event-date column. */
function dateWriters(): string[] {
  const found = new Set<string>();
  for (const f of [...walk(path.join(ROOT, 'app'), []), ...walk(path.join(ROOT, 'lib'), [])]) {
    const src = fs.readFileSync(f, 'utf8');
    if (!/\.(update|insert|upsert)\(|mergeHubDraft|updateHubDraft/.test(src)) continue;
    for (const raw of src.split('\n')) {
      const t = raw.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
      const ln = raw.replace(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g, "''");
      const re = /\b(event_date|date_candidates|date_window_start|date_window_end)\b\s*(\??:)\s*([^,}\n]*)|[{,]\s*(event_date)\s*[,}]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(ln))) {
        if (m[4]) found.add(path.relative(ROOT, f));
        else if (m[2] === ':') {
          const v = (m[3] ?? '').trim();
          if (v && !TYPE_WORD.test(v)) found.add(path.relative(ROOT, f));
        }
      }
    }
  }
  return [...found].sort();
}

test('every door that sets an event’s date asks the rule', () => {
  const silent = DOORS.filter((f) => !ASKS.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  assert.deepEqual(silent, [], `these doors write an event date without asking lib/event-date-floor.ts:\n${silent.join('\n')}`);
});

test('a NEW file that writes an event date is a door or says why it is not', () => {
  const writers = dateWriters();
  // Anchor: the scan must find the doors it knows — a scan that finds nothing would pass everything.
  for (const known of ['app/dashboard/[eventId]/actions.ts', 'app/dashboard/[eventId]/date-selection/actions.ts', 'app/onboarding/wedding/actions.ts']) {
    assert.ok(writers.includes(known), `the scan no longer finds ${known}`);
  }
  const unexplained = writers.filter((f) => !DOORS.includes(f) && !(f in NOT_AN_EVENT_DATE_WRITE));
  assert.deepEqual(
    unexplained,
    [],
    `these files write an event-date column and neither ask the rule nor say why not — add the call (lib/event-date-floor.ts) or a reason above:\n${unexplained.join('\n')}`,
  );
});

/** Every event-date picker a normal account sees, and the floor it must start at. */
const PICKERS = [
  'app/dashboard/(account)/create-event/_components/create-date-picker.tsx',
  'app/dashboard/[eventId]/details/_components/governed-fields.tsx', // Event Settings + the Maker's day
  'app/dashboard/[eventId]/date-selection/_components/date-picker.tsx', // Date Finder
  'app/dashboard/[eventId]/vendors/_components/fact-sheets.tsx', // Find your date on the suppliers page
  'app/onboarding/_shared/date-calendar.tsx', // the onboarding calendar (wedding + every typed onboarding)
  'app/onboarding/_shared/needs-step.tsx', // "When (optional)"
  'app/onboarding/simple/page.tsx', // the Simple Event form
  'app/vendor-dashboard/invite/_components/locked-qr-generator.tsx', // a supplier's Locked QR date
];

test('every event-date picker starts at the first event day for a normal account', () => {
  const unfloored = PICKERS.filter((f) => !/\beventDateMinFor\(/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  assert.deepEqual(unfloored, [], `these pickers do not start at eventDateMinFor:\n${unfloored.join('\n')}`);
});
