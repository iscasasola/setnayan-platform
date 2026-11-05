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
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

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
