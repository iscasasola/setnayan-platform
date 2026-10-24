/**
 * 🌱🖼 "Add to the inspiration library" is a COUNTED first step for the trades that supply a part — prototype
 * `supplier_personal_invite_2026-10-23.html` frame B6 (owner-approved): "Inspiration becomes a counted step for those
 * trades". Every shop, never by plan; absent for a trade that supplies nothing (the six steps, unchanged).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFirstStepsRail, firstStepsThen, type FirstStepsInput } from './vendor-first-steps';
import { INSPIRATION_LIBRARY_HREF, INSPIRATION_LIBRARY_ROW } from './inspiration-library-entry';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

const NEW_SHOP: FirstStepsInput = {
  verified: false,
  profileDone: 6,
  profileTotal: 6,
  hasLogo: true,
  serviceCount: 1,
  docsStatus: 'none',
  docsIn: 0,
  docsTotal: 4,
  submitMissing: [],
  customerCount: 0,
};

test('without the library, the rail is the shipped steps as before', () => {
  const rail = buildFirstStepsRail(NEW_SHOP);
  assert.ok(!rail.steps.some((s) => s.key === 'inspiration'));
  assert.deepEqual(rail.steps.map((s) => s.n), rail.steps.map((_, i) => i + 1));
});

test('a supplying trade gets the step after "Add what you offer", counted, numbered in order', () => {
  const rail = buildFirstStepsRail({ ...NEW_SHOP, inspiration: { count: 0 } });
  const keys = rail.steps.map((s) => s.key);
  assert.equal(keys.indexOf('inspiration'), keys.indexOf('service_card') + 1);
  assert.equal(rail.actionable, buildFirstStepsRail(NEW_SHOP).actionable + 1);
  const step = rail.steps.find((s) => s.key === 'inspiration')!;
  assert.equal(step.title, INSPIRATION_LIBRARY_ROW.label);
  assert.equal(step.href, INSPIRATION_LIBRARY_HREF);
  assert.equal(step.state, 'now', 'details, logo and a service are in — the library is next');
  assert.deepEqual(rail.steps.map((s) => s.n), rail.steps.map((_, i) => i + 1));
  assert.ok(firstStepsThen(buildFirstStepsRail({ ...NEW_SHOP, serviceCount: 0, inspiration: {} })).some((t) => t.key === 'inspiration'));
});

test('a photo in the library ticks it; an unmeasured count never does', () => {
  assert.equal(buildFirstStepsRail({ ...NEW_SHOP, inspiration: { count: 3 } }).steps.find((s) => s.key === 'inspiration')?.state, 'done');
  assert.notEqual(buildFirstStepsRail({ ...NEW_SHOP, inspiration: {} }).steps.find((s) => s.key === 'inspiration')?.state, 'done');
});

test('the server half asks the same trade rule as Today’s row, and never the plan', () => {
  const src = stripComments(readFileSync(join(WEB, 'lib/vendor-first-steps.server.ts'), 'utf8'));
  assert.match(src, /moodboardLibraryAccessForProfile\(profile\)\.allowed/);
  assert.match(src, /inspiration: libraryOpen \?/);
  assert.doesNotMatch(src, /inspiration[^\n]*tier/i, 'the inspiration step is gated by plan');
});
