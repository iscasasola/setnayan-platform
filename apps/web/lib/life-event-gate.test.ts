/**
 * Life-event gate — unit tests (council verdict 2026-07-17, owner "build it
 * now"). Covers the pure cardinality predicate (one IN-PLANNING life event per
 * account × type × honoree), the grandfather epoch, the soft horizon, the
 * measured-type visibility helpers — plus the INSERT-PATH SCAN: a source-level
 * sweep asserting every `events`-insert server path in app/ is a known,
 * guarded file. A new insert path fails here until it wires the guard
 * (council § 2: grep-based, not an import assertion — an import check missed
 * the wedding-onboarding bypass).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  LIFE_GATE_EPOCH_ISO,
  beyondHorizon,
  blocksLifeEventCreation,
  christeningConcernsBirthdate,
  debutConcernsBirthdate,
  findBlockingLifeEvent,
  hiddenMeasuredTypes,
  isGatedLifeType,
  normalizeHonoree,
  type LifeEventRow,
} from './life-event-gate';

const TODAY = '2026-07-18';
const POST_EPOCH = `${LIFE_GATE_EPOCH_ISO}T10:00:00.000Z`;
const PRE_EPOCH = '2026-06-01T10:00:00.000Z';

function row(overrides: Partial<LifeEventRow>): LifeEventRow {
  return {
    event_id: 'e1',
    event_type: 'debut',
    display_name: "Maria's Debut",
    event_date: null,
    archived: false,
    honoree_label: null,
    honoree_dependent_id: null,
    created_at: POST_EPOCH,
    ...overrides,
  };
}

test('classification: lifestyle + unknown vocab types are never gated (fail open)', () => {
  for (const t of ['travel', 'corporate', 'anniversary', 'celebration', 'simple_event', 'brand_new_admin_type']) {
    assert.equal(isGatedLifeType(t), false, t);
    assert.equal(
      blocksLifeEventCreation(row({ event_type: t }), { eventType: t }, TODAY),
      false,
      t,
    );
  }
  // wedding keeps its own untouched guard — deliberately NOT in this map.
  assert.equal(isGatedLifeType('wedding'), false);
  for (const t of ['debut', 'christening', 'birthday', 'graduation', 'gender_reveal']) {
    assert.equal(isGatedLifeType(t), true, t);
  }
});

test('singleton slot: unlabeled in-planning life event blocks a second unlabeled one', () => {
  assert.equal(blocksLifeEventCreation(row({}), { eventType: 'debut' }, TODAY), true);
  // different type never collides
  assert.equal(
    blocksLifeEventCreation(row({ event_type: 'birthday' }), { eventType: 'debut' }, TODAY),
    false,
  );
});

test('grandfather epoch: pre-gate unlabeled rows never block', () => {
  assert.equal(
    blocksLifeEventCreation(row({ created_at: PRE_EPOCH }), { eventType: 'debut' }, TODAY),
    false,
  );
  // …but a LABELED collision blocks regardless (labels are inherently post-gate)
  assert.equal(
    blocksLifeEventCreation(
      row({ created_at: PRE_EPOCH, honoree_label: 'Maria' }),
      { eventType: 'debut', honoreeLabel: 'maria' },
      TODAY,
    ),
    true,
  );
});

test('honoree label: normalized collision blocks; a different celebrant opens a new slot', () => {
  const existing = row({ honoree_label: 'Maria' });
  assert.equal(
    blocksLifeEventCreation(existing, { eventType: 'debut', honoreeLabel: '  MARIA ' }, TODAY),
    true,
  );
  assert.equal(
    blocksLifeEventCreation(existing, { eventType: 'debut', honoreeLabel: 'Maria (pamangkin)' }, TODAY),
    false,
  );
  // unlabeled candidate does not collide with a labeled event (different keys)
  assert.equal(blocksLifeEventCreation(existing, { eventType: 'debut' }, TODAY), false);
  assert.equal(normalizeHonoree('  Ma.   Sofia '), 'ma. sofia');
});

test('dependent link is the strongest key', () => {
  const existing = row({ honoree_dependent_id: 'dep-1', honoree_label: 'Maria' });
  assert.equal(
    blocksLifeEventCreation(existing, { eventType: 'debut', honoreeDependentId: 'dep-1' }, TODAY),
    true,
  );
  assert.equal(
    blocksLifeEventCreation(
      existing,
      { eventType: 'debut', honoreeDependentId: 'dep-2', honoreeLabel: 'Maria' },
      TODAY,
    ),
    false,
  );
});

test('slot frees: archived or settled (date passed) never blocks — wedding-guard shape', () => {
  assert.equal(
    blocksLifeEventCreation(row({ archived: true }), { eventType: 'debut' }, TODAY),
    false,
  );
  assert.equal(
    blocksLifeEventCreation(row({ event_date: '2026-07-17' }), { eventType: 'debut' }, TODAY),
    false, // yesterday → settled
  );
  assert.equal(
    blocksLifeEventCreation(row({ event_date: '2026-07-18' }), { eventType: 'debut' }, TODAY),
    true, // today → still in planning
  );
});

test('findBlockingLifeEvent returns the first blocker or null', () => {
  const rows = [
    row({ event_id: 'a', archived: true }),
    row({ event_id: 'b', honoree_label: 'Ana' }),
    row({ event_id: 'c' }),
  ];
  assert.equal(findBlockingLifeEvent(rows, { eventType: 'debut' }, TODAY)?.event_id, 'c');
  assert.equal(
    findBlockingLifeEvent(rows, { eventType: 'debut', honoreeLabel: 'ana' }, TODAY)?.event_id,
    'b',
  );
  assert.equal(findBlockingLifeEvent(rows, { eventType: 'christening' }, TODAY), null);
});

test('beyondHorizon: soft advisory boundary per the owner-locked prep table', () => {
  // debut horizon = 548 days (18 months)
  assert.equal(beyondHorizon('debut', '2026-12-01', TODAY), false);
  assert.equal(beyondHorizon('debut', '2028-07-18', TODAY), true); // 2 years out
  // lifestyle type → no horizon
  assert.equal(beyondHorizon('travel', '2030-01-01', TODAY), null);
  assert.equal(beyondHorizon('debut', 'not-a-date', TODAY), null);
});

test('measured visibility: debut/christening hide only when nothing concerns the account', () => {
  // People layer unavailable (flag off) → cannot measure → nothing hides
  assert.deepEqual(hiddenMeasuredTypes(null, TODAY), []);
  // No people at all → both measured types hide (the expander doorway remains)
  assert.deepEqual(hiddenMeasuredTypes([], TODAY).sort(), ['christening', 'debut']);
  // A daughter turning 18 within the horizon → debut concerns the account
  const debutante = { birth_date: '2008-10-10', sex: 'female' }; // 18th: 2026-10-10
  assert.deepEqual(hiddenMeasuredTypes([debutante], TODAY), ['christening']);
  // An infant → christening concerns the account
  const infant = { birth_date: '2026-03-01', sex: null };
  assert.deepEqual(hiddenMeasuredTypes([infant], TODAY), ['debut']);
  // A person with no stored birthdate can't be measured → fail open, hide nothing
  assert.deepEqual(hiddenMeasuredTypes([{ birth_date: null, sex: null }], TODAY), []);
});

test('debut concern: 18F / 21M / either when sex unknown, within 548 days', () => {
  assert.equal(debutConcernsBirthdate('2008-10-10', 'female', TODAY), true);
  assert.equal(debutConcernsBirthdate('2008-10-10', 'male', TODAY), false); // 21st is 2029
  assert.equal(debutConcernsBirthdate('2005-12-01', 'male', TODAY), true); // 21st: 2026-12-01
  assert.equal(debutConcernsBirthdate('2008-10-10', null, TODAY), true); // unknown → 18 counts
  assert.equal(debutConcernsBirthdate('2015-01-01', 'female', TODAY), false); // years away
});

test('christening concern: under 8 today', () => {
  assert.equal(christeningConcernsBirthdate('2026-03-01', TODAY), true);
  assert.equal(christeningConcernsBirthdate('2017-03-01', TODAY), false); // 9 years old
});

// ── INSERT-PATH SCAN (council § 2 — the CI backstop) ─────────────────────────
// Every server file that inserts into `events` must be one of the known,
// guarded paths. Adding a new insert path fails this test until the file wires
// assertLifeEventCreatable / the wedding guard AND is added here.
const GUARDED_EVENT_INSERT_PATHS = [
  'app/dashboard/(account)/create-event/actions.ts', // life-event-guard + wedding-guard
  'app/onboarding/wedding/actions.ts', // wedding-guard (bypass closed 2026-07-17)
  'app/onboarding/simple/actions.ts', // life-event-guard (lifestyle no-op)
  'app/onboarding/_shared/commit-event.ts', // life-event-guard
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

test('insert-path scan: every events-insert server path is guarded and allowlisted', () => {
  // Tests run from apps/web (package.json test:unit), so cwd is the app root.
  const appRoot = join(process.cwd(), 'app');
  // Direct `.from('events').insert(` only (whitespace/newlines between) — a
  // wider window false-positives on `.from('events').update(...)` followed by
  // an unrelated audit-log insert.
  const insertRe = /\.from\(\s*['"`]events['"`]\s*\)\s*\.insert\(/;
  const offenders: string[] = [];
  for (const file of walk(appRoot)) {
    const src = readFileSync(file, 'utf8');
    if (!insertRe.test(src)) continue;
    const rel = file.slice(file.indexOf('app/'));
    if (!GUARDED_EVENT_INSERT_PATHS.includes(rel)) {
      offenders.push(rel);
      continue;
    }
    const guarded =
      src.includes('getBlockingLifeEvent') || src.includes('hasInPlanningWeddingForUser');
    assert.ok(guarded, `${rel} inserts into events but wires no creation guard`);
  }
  assert.deepEqual(
    offenders,
    [],
    `New events-insert path(s) found without a life-event guard: ${offenders.join(', ')} — wire getBlockingLifeEvent (see create-event/life-event-guard.ts) and add the file to GUARDED_EVENT_INSERT_PATHS.`,
  );
});
