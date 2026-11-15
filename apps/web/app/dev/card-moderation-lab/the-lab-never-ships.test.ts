/**
 * /dev/card-moderation-lab 404s in production — the production test is the FIRST statement — and it mounts the REAL
 * admin section and the REAL public gallery, not copies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.lab.tsx'), 'utf8'));

test('the card moderation lab calls notFound() in production, before anything else', () => {
  const page = LAB.slice(LAB.indexOf('export default async function CardModerationLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(') {') + 1) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab mounts the real admin section, the real gallery and the real card builder', () => {
  assert.match(LAB, /from '@\/app\/admin\/vendors\/\[vendorProfileId\]\/_components\/service-cards-section';/);
  assert.match(LAB, /from '@\/app\/v\/\[slug\]\/_components\/services-gallery';/);
  assert.match(LAB, /import \{ toServiceCard \} from '@\/lib\/service-card-view-model';/);
  // The public frame filters by the same switch the shop page reads.
  assert.match(LAB, /const activeServices = rows\.filter\(\(s\) => s\.is_active\);/);
});

test('the plan-hold frames mount the real picker, the real tag and the real Today line — never copies', () => {
  assert.match(LAB, /import \{ StayOnPicker, type StayOnPlan \} from '@\/app\/vendor-dashboard\/services\/_components\/stay-on-picker';/);
  assert.match(LAB, /import \{ PlanHoldTag \} from '@\/app\/vendor-dashboard\/services\/_components\/plan-hold-tag';/);
  assert.match(LAB, /import \{ StayOnTodayLineView \} from '@\/app\/vendor-dashboard\/_components\/stay-on-today-line';/);
  // The ladder and each plan's mode come from the same helpers My Shop's section uses.
  assert.match(LAB, /ladderFor\(current, pending\)/);
  assert.match(LAB, /pickModeFor\(tier, current, pending\)/);
});
