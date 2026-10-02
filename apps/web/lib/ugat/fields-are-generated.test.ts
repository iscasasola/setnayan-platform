/**
 * fields-are-generated.test.ts — the committed FIELDS map cannot go stale by
 * hand. Same posture as screens-are-generated.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scanFields } from './scan-fields';
import { serializeFieldsMap, type UgatFieldsMap } from './fields';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..');

test('the committed fields map matches a fresh scan exactly', () => {
  const screens = JSON.parse(readFileSync(join(HERE, 'screens.generated.json'), 'utf8'));
  const fresh = serializeFieldsMap(scanFields({ webRoot: WEB, screens }));
  const committed = readFileSync(join(HERE, 'fields.generated.json'), 'utf8');
  assert.ok(fresh === committed, 'fields changed — run: pnpm --filter @setnayan/web ugat:fields');
});

test('the scan is not empty — the floor', () => {
  const m = JSON.parse(readFileSync(join(HERE, 'fields.generated.json'), 'utf8')) as UgatFieldsMap;
  assert.ok(m.actions.length >= 800, `only ${m.actions.length} actions mapped`);
  assert.ok(m.forms.filter((f) => f.actions.length).length >= 400, 'the form → action resolution narrowed');
  const withWrites = m.screens.filter((s) => s.writes.length).length;
  assert.ok(withWrites >= 150, `only ${withWrites} screens write anything — the closure narrowed`);
  const details = m.screens.find((s) => s.id === '/dashboard/[eventId]/details');
  assert.ok(details?.reads.includes('events.event_date'), 'Your info reads the event date');
});
