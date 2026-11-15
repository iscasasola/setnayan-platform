/** /dev/offer-maker-lab 404s in production, before anything else (the supplier lab's rule). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.lab.tsx'), 'utf8'));

test('the offer maker lab calls notFound() in production, before anything else', () => {
  assert.match(LAB, /import \{ notFound \} from 'next\/navigation';/);
  assert.match(LAB, /export default async function OfferMakerLabPage\([^)]*\)\s*\{\s*if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/, 'the production 404 is not the first statement');
});
