/**
 * 🎞 FORM MEDIA OBEYS THE PLAN (DECISION_LOG 2026-10-28 "FORM MEDIA BY PLAN"; THE ONE BUILD · Forms, B2 §5 guard 7).
 *
 * Owner, verbatim: *"Upload for pro and ultra .Video links for solo, pro, and ultra"* — gated ONLY through the one caps
 * home (`lib/vendor-tier-caps.ts`), never inline; a locked control names the plan it needs, never a dead button.
 *   1. the caps table says exactly that, per plan;
 *   2. the save refuses through `tierCaps(...).formMediaUploads / .formVideoLinks` and names the plan via `firstPlanWith`;
 *   3. no Forms file compares a tier string itself;
 *   4. the Maker lists a locked kind with its plan (`disabledNote`), it does not drop it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIER_CAPS, firstPlanWith } from './vendor-tier-caps';
import { stripComments } from './strip-comments';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(WEB, rel), 'utf8'));
const FORMS_FILES = [
  'app/vendor-dashboard/forms/actions.ts',
  'app/vendor-dashboard/forms/_components/form-maker.tsx',
  'app/vendor-dashboard/forms/_components/forms-page-body.tsx',
  'app/vendor-dashboard/clients/[eventId]/_pages/forms.tsx',
];

test('the caps table: uploads Pro + Ultra, video links Solo + Pro + Ultra', () => {
  const uploads = Object.entries(TIER_CAPS).filter(([, c]) => c.formMediaUploads).map(([t]) => t).sort();
  const video = Object.entries(TIER_CAPS).filter(([, c]) => c.formVideoLinks).map(([t]) => t).sort();
  assert.deepEqual(uploads, ['enterprise', 'pro']);
  assert.deepEqual(video, ['enterprise', 'pro', 'solo']);
  assert.equal(firstPlanWith((c) => c.formMediaUploads), 'pro');
  assert.equal(firstPlanWith((c) => c.formVideoLinks), 'solo');
});

test('the save refuses through the caps home and names the plan', () => {
  const a = read('app/vendor-dashboard/forms/actions.ts');
  assert.match(a, /caps\.formMediaUploads/);
  assert.match(a, /caps\.formVideoLinks/);
  assert.match(a, /firstPlanWith\(\(c\) => c\.formMediaUploads\)/);
  assert.match(a, /firstPlanWith\(\(c\) => c\.formVideoLinks\)/);
  assert.match(a, /tierCaps\(asVendorTier\(/);
});

test('no Forms file compares a tier string itself', () => {
  for (const f of FORMS_FILES) {
    const src = read(f);
    assert.ok(!/===\s*'(solo|pro|enterprise|verified|free)'/.test(src), `${f} gates on a typed tier`);
    assert.ok(!/tier_state\s*===/.test(src), `${f} gates on a typed tier`);
  }
});

test('a locked kind is listed with the plan it needs, never dropped', () => {
  const m = read('app/vendor-dashboard/forms/_components/form-maker.tsx');
  assert.match(m, /disabledNote: `Media files come with \$\{locks\.media\}\.`/);
  assert.match(m, /disabledNote: `Video links come with \$\{locks\.video\}\.`/);
});
