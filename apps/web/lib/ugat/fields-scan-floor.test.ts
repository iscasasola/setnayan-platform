/**
 * fields-scan-floor.test.ts — the FIELDS scan over the real app is not empty.
 *
 * The Fields map is regenerated on every CI run (scripts/root-map.ts) rather
 * than committed, so there is no "stale file" to refuse; what can still go
 * wrong is a scanner that quietly matches nothing and reports a clean app.
 * These floors catch that, plus one known fact read end to end.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scanFields } from './scan-fields';
import { EVENT_FACT_HOME_PARTS, EVENT_FACT_HOME_SCREENS } from './fields';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..');

test('the real scan is not empty — the floors', () => {
  const screens = JSON.parse(readFileSync(join(HERE, 'screens.generated.json'), 'utf8'));
  const m = scanFields({ webRoot: WEB, screens });
  assert.ok(m.actions.length >= 800, `only ${m.actions.length} actions mapped`);
  assert.ok(m.forms.filter((f) => f.actions.length).length >= 400, 'the form → action resolution narrowed');
  const withWrites = m.screens.filter((s) => s.writes.length).length;
  assert.ok(withWrites >= 150, `only ${withWrites} screens write anything — the closure narrowed`);
  for (const id of EVENT_FACT_HOME_SCREENS) assert.ok(m.screens.some((s) => s.id === id), `${id} is a screen`);
  for (const f of EVENT_FACT_HOME_PARTS) assert.ok(m.homeParts?.some((s) => s.id === f), `${f} (a part of the event-answer home) still exists`);
  const details = m.screens.find((s) => s.id === '/dashboard/[eventId]/details');
  assert.ok(details?.reads.includes('events.event_date'), 'Your info reads the event date');
  const home = m.screens.find((s) => s.id === '/dashboard/[eventId]');
  assert.ok(home?.calcs.includes('days-to-go') && home.calcs.includes('guests-coming'), 'Home computes days to go and coming');
  const guest = m.actions.find((a) => a.ref === 'app/dashboard/[eventId]/guests/new/actions.ts#createGuest');
  assert.deepEqual(guest?.saves.first_name?.includes('guests.first_name'), true, 'a guest\'s first name reaches guests.first_name');
});
