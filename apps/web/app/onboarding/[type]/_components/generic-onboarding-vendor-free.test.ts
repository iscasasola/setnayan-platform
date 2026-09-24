/**
 * generic-onboarding-vendor-free.test.ts — owner 2026-09-25, verbatim: "i
 * noticed that simple event has questions for suppliers. the simple event is
 * only for our own services."
 *
 * Pins the `vendorFree` prop's four effects inside the GENERIC (non-wedding)
 * wizard, so a Simple Event (or any future `marketplaceEnabled: false` type)
 * reached through it never asks a question sized for vendors it does not have:
 *   1. the "How much do you want to do?" effort axis — it scales vendor
 *      category picks (`effortLimit`) — is dropped from the screen list;
 *   2. the region screen's sub-line stops promising to "line up vendors";
 *   3. the reveal's vendor-team fallback line is reworded;
 *   4. no `interested_categories` / dispatch count is saved.
 *
 * ⚠ SOURCE-LEVEL, same posture as `../vendor-free-onboarding-gate.test.ts` and
 * `lib/vendor-free-surfaces.test.ts`: this is a 1,600+ line client component
 * with a localStorage draft, a multi-screen state machine, and a server
 * commit action — the invariant worth pinning is "the flag is wired to the
 * right screens", which reading the real source proves without re-building a
 * DOM harness for a component this large.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const COMPONENT = join(HERE, 'generic-onboarding.tsx');
const src = () => stripComments(readFileSync(COMPONENT, 'utf8'));

test('vendorFree is a real prop, defaulted false (byte-identical for every other type)', () => {
  const s = src();
  assert.match(s, /vendorFree\?:\s*boolean/, 'Props must declare vendorFree');
  assert.match(
    s,
    /vendorFree\s*=\s*false,?\s*\n?\s*\}\s*=\s*props/,
    'must default to false so every marketplace-enabled type is unaffected',
  );
});

test('the effort axis (vendor-sizing) is dropped from the screen list when vendorFree', () => {
  const s = src();
  assert.match(
    s,
    /const activeAxes = useMemo\(\s*\n?\s*\(\)\s*=>\s*\(vendorFree \? quizAxes\.filter\(\(a\) => a\.id !== ['"]effort['"]\)/,
    'activeAxes must filter out the effort axis specifically (by id, not by ' +
      'dropping every axis) when vendorFree',
  );
  // axisIds — which builds the `screens` sequence — must be derived from the
  // FILTERED list, or the effort screen would still appear in the sequence.
  assert.match(
    s,
    /const axisIds = useMemo<string\[\]>\(\(\) => activeAxes\.map/,
    'axisIds must read activeAxes (the vendorFree-filtered list), not the raw quizAxes prop',
  );
});

test('the region sub-line does not promise vendors when vendorFree', () => {
  const s = src();
  assert.match(
    s,
    /vendorFree \? ['"]So your plan fits where it happens\.['"] : ['"]So we can line up vendors near you\.['"]/,
    'the region screen must reword its vendor promise for a vendor-free type',
  );
});

test('the reveal fallback line does not promise a vendor "team" when vendorFree', () => {
  const s = src();
  assert.match(
    s,
    /vendorFree\s*\n?\s*\?\s*`We.ll set up your \$\{label\.toLowerCase\(\)\} dashboard/,
    'the no-picks reveal fallback must not say "line up the right team" on a ' +
      'type with no vendor team to line up',
  );
});

test('no interested_categories / inquiry dispatch is saved when vendorFree', () => {
  const s = src();
  assert.match(
    s,
    /picks:\s*vendorFree \? \[\] : finalPlan\.picks/,
    'the commit payload must save no picks (→ style_preferences.interested_categories) for a vendor-free type',
  );
  assert.match(
    s,
    /inquiriesPerCategory:\s*vendorFree \? 0 : 3/,
    'no per-category inquiry dispatch size for a type with no vendors to dispatch to',
  );
});

test('interestedServices (Setnayan in-app services) is NOT vendor-gated', () => {
  // The opposite of the picks assertion above, on purpose: Papic / Setnayan AI
  // pre-surfacing is exactly what a Simple Event exists to sell, so this must
  // stay unconditional even as `picks` is gated.
  const s = src();
  assert.doesNotMatch(
    s,
    /interestedServices:\s*vendorFree/,
    'interestedServices must not be gated on vendorFree — those are in-app ' +
      'services, never vendor categories',
  );
});
