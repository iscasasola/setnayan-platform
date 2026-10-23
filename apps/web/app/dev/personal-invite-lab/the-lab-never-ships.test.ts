/**
 * /dev/personal-invite-lab 404s in production — the same rule, and the same check, as `/dev/add-your-own-lab`: the
 * production test is the FIRST thing the page does, before it reads a search param or draws a fixture.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the personal invite lab calls notFound() in production, before anything else', () => {
  assert.match(LAB, /import \{ notFound \} from 'next\/navigation';/, 'notFound is not imported');
  const page = LAB.slice(LAB.indexOf('export default async function PersonalInviteLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(')')) + 1).trimStart();
  assert.match(
    body,
    /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/,
    'the production 404 is not the first statement — the lab can render on the live site',
  );
});

test('the lab draws the real components', () => {
  assert.match(LAB, /import \{ InviteResult, InviteVendorForm \} from '@\/app\/admin\/vendors\/_components\/invite-vendor-form';/);
  assert.match(LAB, /import \{ TeamInviteDoor \} from '@\/app\/vendor\/claim\/\[token\]\/_components\/claim-parts';/);
});
