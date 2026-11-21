/**
 * the-missing-notice-names-labels.test.ts — 🏷 "STILL MISSING" NAMES THE FIELDS AS THE FORM DOES.
 *
 * Controller, 21 Nov 2026 (DECISION_LOG "11 SUPPLIER TOOL PAGES REDRAW — APPROVED (v3)"): the Attributes page's
 * missing-fields notice shows field LABELS, not keys — "Silhouettes, Fabric", never "silhouettes, fabric_type".
 *
 * SABOTAGE (run once, red, restored): `missingLabels` returning the keys → 1; the view printing `missing.join` of the
 * raw `?missing=` keys → 2.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { missingLabels } from './_components/missing-labels';

test('1 · keys become the form’s labels; an unknown key never shows raw', () => {
  const fields = {
    silhouettes: { type: 'multi_select', label: 'Silhouettes' },
    fabric_type: { type: 'enum', label: 'Fabric' },
  } as const;
  assert.deepEqual(missingLabels(fields, ['silhouettes', 'fabric_type']), ['Silhouettes', 'Fabric']);
  assert.deepEqual(missingLabels(fields, ['lead_time_weeks']), ['Lead time weeks']);
  assert.deepEqual(missingLabels(null, ['fabric_type']), ['Fabric type']);
});

test('2 · the page hands the notice labels, never the raw ?missing= keys', () => {
  const page = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/attributes/page.tsx'), 'utf8'));
  assert.match(page, /missingLabels\(/, 'the page no longer turns the missing keys into labels');
  const view = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/attributes/_components/service-rows.tsx'), 'utf8'));
  assert.match(view, /Still missing: \{missing\.join\(', '\)\}/, 'the notice lost its words');
  assert.doesNotMatch(view, /missingFields|font-mono/, 'the notice prints keys again');
});
