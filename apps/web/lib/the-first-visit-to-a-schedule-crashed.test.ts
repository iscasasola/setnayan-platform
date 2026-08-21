import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * the-first-visit-to-a-schedule-crashed.test.ts
 *
 * 🚨 THE FIRST EVER VISIT TO SCHEDULE ON A NON-WEDDING EVENT RETURNED A 500.
 * The seed was a `'use server'` action ending in two `revalidatePath` calls,
 * and the page called it DURING RENDER, which Next.js forbids:
 *
 *   Error: Route /dashboard/[eventId]/schedule used "revalidatePath …"
 *   during render which is unsupported.
 *
 * 🪤 It hid itself: the INSERT commits before the revalidate, so the rows land
 * and the SECOND visit is fine. Measured on the owner's own Movie Night — the
 * five blocks were written at 08:17:49 by the request that 500'd at 08:17:47.
 *
 * 🛡 Every assertion below was mutation-checked by occurrence count.
 */

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => readFileSync(join(WEB, p), 'utf8');
/** Comments quote the strings these assertions ban — strip before matching. */
const code = (p: string) =>
  src(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

test('the render-time seed does not revalidate', () => {
  const seed = code('lib/schedule-seed.server.ts');
  assert.ok(
    !/revalidatePath/.test(seed),
    'revalidating during a render is the 500 this whole file exists to stop',
  );
  assert.match(seed, /import 'server-only';/, 'it reads the admin client — keep it off the client');
});

test('the schedule page seeds through the plain helper, never the action module', () => {
  const page = code('app/dashboard/[eventId]/schedule/page.tsx');
  assert.match(page, /from '@\/lib\/schedule-seed\.server'/);
  assert.ok(
    !/seedNonWeddingRunOfShow[\s\S]{0,80}from '\.\/actions'/.test(page),
    'importing it from the server-action module is what broke',
  );
});

test("the seed is gone from the 'use server' module", () => {
  const actions = code('app/dashboard/[eventId]/schedule/actions.ts');
  assert.ok(
    !/export async function seedNonWeddingRunOfShow/.test(actions),
    'a use-server module is for things a person submits',
  );
});

/*
  A seeding hiccup must not take down a page whose job is showing a schedule.
  The old version threw on a read or a write error — during render, another 500.
*/
test('the seed fails soft, and never throws into a render', () => {
  const seed = code('lib/schedule-seed.server.ts');
  assert.ok(!/throw new Error/.test(seed), 'no throw may escape into the render');
  assert.equal(
    (seed.match(/logQueryError\(/g) || []).length,
    3,
    'every one of the three failure points must be logged, not swallowed',
  );
});
