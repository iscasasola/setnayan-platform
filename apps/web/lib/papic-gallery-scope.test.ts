/**
 * An RLS refusal and an empty wedding are the same value: `[]`, no error.
 * These pin the separate permission question that tells them apart — and the
 * fail-closed direction, which is the whole point.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { viewerSeesCoupleScopedPapic } from './papic-gallery-scope';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Minimal stub of the chained PostgREST builder this function uses. */
function stub(opts: {
  user: { id: string } | null;
  row?: { user_id: string } | null;
  error?: { message: string } | null;
}) {
  return {
    auth: { getUser: async () => ({ data: { user: opts.user } }) },
    from() {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({
          data: opts.row ?? null,
          error: opts.error ?? null,
        }),
      };
      return chain;
    },
  } as never;
}

test('a couple member sees the whole album', async () => {
  const ok = await viewerSeesCoupleScopedPapic(stub({ user: { id: 'u1' }, row: { user_id: 'u1' } }), 'e1');
  assert.equal(ok, true);
});

test('a coordinator is NOT a couple member — the caveat shows', async () => {
  // This is the live case: COORDINATOR_AREAS grants guest list, seat plan,
  // schedule, vendors, invitations, mood board — and no photo area at all.
  const ok = await viewerSeesCoupleScopedPapic(stub({ user: { id: 'coord' }, row: null }), 'e1');
  assert.equal(ok, false);
});

test('a signed-out viewer never counts as permitted', async () => {
  assert.equal(await viewerSeesCoupleScopedPapic(stub({ user: null }), 'e1'), false);
});

test('a FAILED permission read fails toward showing the caveat', async () => {
  // The direction is the point. An unproven "you see everything" is exactly the
  // claim this module exists to stop making — so an error must not read as yes.
  const ok = await viewerSeesCoupleScopedPapic(
    stub({ user: { id: 'u1' }, row: { user_id: 'u1' }, error: { message: 'denied' } }),
    'e1',
  );
  assert.equal(ok, false, 'an error must never resolve to "permitted"');
});

test('the permission question is asked separately from the photo read', () => {
  // Deriving it from the photo count is the bug: zero photos and zero
  // permission produce the identical response.
  const page = readFileSync(
    join(HERE, '..', 'app', 'dashboard', '[eventId]', 'studio', 'papic', 'page.tsx'),
    'utf8',
  );
  assert.match(page, /viewerSeesCoupleScopedPapic\(supabase, eventId\)/);
  const code = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(
    !/seesAll\s*=\s*(photos|hasPhotos)/.test(code),
    'permission must not be inferred from how many photos came back',
  );
});

test('the caveat copy does not claim the album is empty', () => {
  const page = readFileSync(
    join(HERE, '..', 'app', 'dashboard', '[eventId]', 'studio', 'papic', 'page.tsx'),
    'utf8',
  );
  assert.match(page, /aren&rsquo;t\s*\n?\s*shared with you/, 'it must say withheld, not absent');
});
