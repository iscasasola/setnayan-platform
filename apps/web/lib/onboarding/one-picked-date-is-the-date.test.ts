/**
 * 📅 ONE PICKED DATE IS THE DATE (owner 2026-10-08). He created a HANGOUT,
 * picked ONE date, and the Home cover showed no date — the generic onboarding
 * wrote `event_date: null` + `date_candidates: [d]`, and Home reads
 * `event_date`. This holds both halves: the WRITE (a single pick for a
 * fixed-date input type lands in `event_date`, day precision) and the READ (an
 * event already stored the old way shows its one date on Home and the Event Hub
 * cover, without a migration).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildGenericEventInsert, type GenericInsertOpts } from './event-insert';
import type { GenericOnboardingPayload } from './types';
import { ANCHOR_BY_TYPE, isFixedDateInputType, withPickedDate } from '../event-anchor';
import { formatEventDate } from '../events';

const OPTS: GenericInsertOpts = {
  slug: 'our-hangout',
  now: '2026-10-08T00:00:00.000Z',
  userId: 'u1',
  isAnonymous: false,
  experienceEnabled: false,
  homeSignalsEnabled: false,
};

function payload(over: Partial<GenericOnboardingPayload>): GenericOnboardingPayload {
  return {
    eventType: 'hangout',
    displayName: 'Saturday hangout',
    region: 'NCR',
    venueLatitude: null,
    venueLongitude: null,
    pax: null,
    budgetBand: null,
    budgetAmountCentavos: null,
    dateMode: 'specific',
    dateCandidates: ['2026-11-14'],
    windowStart: null,
    windowEnd: null,
    moodFeelKey: null,
    experiencePersona: null,
    experienceForWhom: null,
    experienceAxes: {},
    picks: [],
    interestedServices: [],
    refinements: {},
    basicMoodboard: null,
    places: [],
    guidanceOptIn: true,
    sendTopInquiries: false,
    inquiriesPerCategory: 3,
    role: 'host',
    ...over,
  } as GenericOnboardingPayload;
}

test('a single hangout pick writes event_date at day precision, no candidates', () => {
  const row = buildGenericEventInsert(payload({}), OPTS);
  assert.equal(row.event_date, '2026-11-14');
  assert.equal(row.event_date_precision, 'day');
  assert.equal(row.date_candidates, null);
  assert.equal(row.date_mode, 'specific');
});

test('two picks keep the candidate flow (the date-selection lock)', () => {
  const row = buildGenericEventInsert(payload({ dateCandidates: ['2026-11-14', '2026-11-21'] }), OPTS);
  assert.equal(row.event_date, null);
  assert.equal('event_date_precision' in row, false);
  assert.deepEqual(row.date_candidates, ['2026-11-14', '2026-11-21']);
});

test('a type whose date is not a fixed input keeps its candidates (birthday)', () => {
  const row = buildGenericEventInsert(payload({ eventType: 'birthday' }), OPTS);
  assert.equal(row.event_date, null);
  assert.deepEqual(row.date_candidates, ['2026-11-14']);
});

test('a wedding is never a fixed-date input type — its date comes from booking a venue', () => {
  assert.equal(isFixedDateInputType('wedding'), false);
  const old = { event_type: 'wedding', event_date: null, date_candidates: ['2026-11-14'] };
  assert.equal(withPickedDate(old), old, 'a wedding row is returned untouched');
});

test('an unknown type does not ride the fallback anchor into the fix', () => {
  assert.equal(isFixedDateInputType('made_up_type'), false);
  assert.equal(isFixedDateInputType(null), false);
});

test('the fixed-date input types are exactly the authored map entries', () => {
  const fixed = Object.entries(ANCHOR_BY_TYPE)
    .filter(([, a]) => a.kind === 'fixed_date' && a.dateModel === 'input')
    .map(([t]) => t);
  assert.ok(fixed.includes('hangout'));
  for (const t of fixed) assert.equal(isFixedDateInputType(t), true, t);
});

test('an EXISTING hangout stored the old way shows its one date', () => {
  const stored = { event_type: 'hangout', event_date: null, event_date_precision: 'year', date_candidates: ['2026-11-14'] };
  const read = withPickedDate(stored);
  assert.equal(read.event_date, '2026-11-14');
  assert.equal((read as { event_date_precision?: string }).event_date_precision, 'day');
  assert.ok(formatEventDate(read.event_date), 'Home has a label to draw');
  // Two stored candidates stay a choice — no date invented.
  assert.equal(withPickedDate({ ...stored, date_candidates: ['2026-11-14', '2026-11-21'] }).event_date, null);
  // A real date is never overridden.
  assert.equal(withPickedDate({ ...stored, event_date: '2026-12-01' }).event_date, '2026-12-01');
});

test('Home and the Event Hub cover read the event through withPickedDate', () => {
  const root = join(__dirname, '..', '..');
  const home = readFileSync(join(root, 'app/dashboard/[eventId]/page.tsx'), 'utf8');
  assert.match(home, /const event = eventRes\.data \? withPickedDate\(eventRes\.data\) : null;/);
  assert.match(home, /leanSelect =\s*'[^']*\bdate_candidates\b/);
  const shell = readFileSync(join(root, 'app/[slug]/_lib/loaders.ts'), 'utf8');
  assert.match(shell, /return data \? withPickedDate\(data\) : data;/);
  assert.match(shell, /gifts_on, date_candidates'/);
});
