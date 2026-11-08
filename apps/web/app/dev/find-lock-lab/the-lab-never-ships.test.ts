/**
 * /dev/find-lock-lab 404s in production — the production test is the FIRST statement — and it mounts the REAL
 * admin find line and the REAL shop-page notice, with every state computed by the real `findLockState`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the find-lock lab calls notFound() in production, before anything else', () => {
  const page = LAB.slice(LAB.indexOf('export default async function FindLockLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(') {') + 1) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab mounts the real find line, the real notice and the real state function', () => {
  assert.match(LAB, /from '@\/app\/admin\/verify\/_components\/find-line';/);
  assert.match(LAB, /from '@\/app\/v\/\[slug\]\/_components\/not-yet-verified-notice';/);
  assert.match(LAB, /import \{ findLockState, shopTakesMessages \} from '@\/lib\/findable-shop';/);
  assert.match(LAB, /state=\{findLockState\(s\.row\)\}/, 'a state was typed instead of computed');
});

test('the shop view decides its doors with the real isBookable and shopTakesMessages, never typed', () => {
  assert.match(LAB, /const bookable = isBookable\(parseVisibility\(shopRow\.row\.public_visibility\)\);/);
  assert.match(LAB, /const canMessage = shopTakesMessages\(shopRow\.row, bookable\);/);
  assert.match(LAB, /\{bookable \? \(\s*<CheckADateLink/, 'Check a date is not on bookable in the lab');
});
