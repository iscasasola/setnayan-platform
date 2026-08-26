/**
 * admin-job-ask-form.test.ts — the fill-form flow prepares, it never presses.
 *
 * The one-person admin plan (2026-07-11) binds this: the machine may prepare
 * and hold back, it may never be the thing that lets money, a price, an
 * approval or a publish through. `ask-the-admin.test.ts` already pins that
 * boundary for the AI step's OWN table; this pins it for the NEW piece — the
 * ask-form built directly into the palette — by source inspection, the same
 * technique that guard uses.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const palette = () =>
  stripComments(readFileSync(join(WEB, 'app/admin/_components/admin-command-palette.tsx'), 'utf8'));

test('the palette never imports a real admin action — only job metadata', () => {
  const src = palette();
  // Every admin `actions.ts` exports the functions that actually mutate. The
  // palette may import job NAMES (strings, from the generated data) and route
  // metadata, and nothing else that could let it call one directly.
  assert.ok(
    !/from ['"][^'"]*\/actions['"]/.test(src),
    'the palette imports a mutating actions module — it must only route',
  );
  // Called-as-a-function, not merely mentioned — the placeholder text in the
  // search input itself says "…payouts, taxonomy, secrets, venues", which is
  // not a call and must not fail this.
  for (const word of ['approve', 'refund', 'publish', 'payout', 'createCanonicalLeaf']) {
    assert.ok(!src.includes(`${word}(`), `the palette calls ${word}() — it may only route`);
  }
});

test('preparing a job writes a URL, never an await — the only network call left is the ask() escape hatch', () => {
  const src = palette();
  const awaits = [...src.matchAll(/\bawait\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g)].map((m) => m[1] ?? '');
  const allowed = new Set(['askTheAdmin']);
  const stray = awaits.filter((name) => !allowed.has(name));
  assert.deepEqual(stray, [], `the palette awaits something new: ${stray.join(', ')}`);
});

test('the job-prepare button routes with router.push, and only that', () => {
  const src = palette();
  const prepareIdx = src.indexOf('Prepare the form');
  assert.ok(prepareIdx > 0, 'the prepare button was renamed or removed — re-pin this test');
  // Walk backwards to the enclosing onClick and confirm it builds a href and
  // pushes it — no server call, no direct action used inline. Anchored on the
  // onClick keyword itself, not a fixed character count, so line-wrapping the
  // JSX attributes in between can never starve the window.
  const onClickIdx = src.lastIndexOf('onClick', prepareIdx);
  assert.ok(onClickIdx > 0 && prepareIdx - onClickIdx < 1000, 'the prepare button\'s onClick moved out of range — re-pin this test');
  const before = src.slice(onClickIdx, prepareIdx);
  assert.match(before, /buildJobHref\(askJob, askValues\)/, 'the prepare button stopped building a href');
  assert.match(before, /router\.push\(href\)/, 'the prepare button stopped routing — it must never submit itself');
});

test('every ask-form field comes from the generated job data, never hand-typed', () => {
  const src = palette();
  assert.match(src, /askJob\.fields\.slice\(0, MAX_ASK_FIELDS\)/, 'the field list is no longer read from the job');
  assert.match(src, /askJob\.refusedWhenEmpty\.includes\(field\)/, 'the required marker stopped reading refusedWhenEmpty');
});
