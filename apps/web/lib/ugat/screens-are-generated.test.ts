/**
 * screens-are-generated.test.ts — the committed Screens · Doors map cannot go
 * stale by hand. Same posture as admin-map-is-generated.test.ts: re-scan the
 * real tree and refuse any difference. CI also runs
 * scripts/check-ugat-screens.mjs, which prints the counts and the ratchet.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scanScreens, serializeScreensMap } from './scan-screens';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..');

test('the committed screens map matches a fresh scan exactly', () => {
  const fresh = serializeScreensMap(scanScreens({ webRoot: WEB }));
  const committed = readFileSync(join(HERE, 'screens.generated.json'), 'utf8');
  assert.ok(fresh === committed, 'screens changed — run: pnpm --filter @setnayan/web ugat:screens');
});

test('the scan is not empty and not a handful — the floor', () => {
  // A scanner that silently matched nothing would pass the equality above
  // after one regeneration.
  const map = JSON.parse(readFileSync(join(HERE, 'screens.generated.json'), 'utf8'));
  assert.ok(map.screens.length >= 250, `only ${map.screens.length} screens scanned`);
  const connected = map.screens.filter((s: { status: string }) => s.status === 'connected').length;
  assert.ok(connected >= 200, `only ${connected} connected — the door scan narrowed`);
});
