/**
 * D2 (2026-09-11): `addRepertoireSong` had no server-side category check at
 * all — only the PAGE (`repertoire/page.tsx`) gated a non-music vendor away
 * via `isMusicVendor`. A server action is a POST target, not a page; nothing
 * stopped a direct POST from a caterer's session.
 *
 * Source-scan (the action calls `redirect()`/`cookies()` via next/navigation
 * and a real Supabase server client, which is what the page-level test for
 * the sibling access gate — `repertoire/page.tsx`'s own `isMusicVendor` call
 * — is not unit-tested behaviourally either; this pins that the SAME shared
 * rule (`lib/songs.ts`'s `isMusicToolCategory`) now guards the action too,
 * refusing before any database write).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'actions.ts'), 'utf8'),
);

test('addRepertoireSong refuses BEFORE the vendor_songs write, using the shared music rule', () => {
  const fnStart = src.indexOf('export async function addRepertoireSong');
  assert.ok(fnStart > 0, 'addRepertoireSong must exist');
  const fnBody = src.slice(fnStart, src.indexOf('export async function removeRepertoireSong'));

  const guardIdx = fnBody.search(/isMusicToolCategory\(profile\.services\)/);
  assert.ok(guardIdx > 0, 'must check isMusicToolCategory(profile.services)');

  const writeIdx = fnBody.indexOf(".from('vendor_songs')");
  assert.ok(writeIdx > 0, 'the vendor_songs write must exist');
  assert.ok(guardIdx < writeIdx, 'the category refusal must run before the write, not after');
});

test('isMusicToolCategory is imported from the one shared music rule', () => {
  assert.match(src, /import \{ findOrCreateSongId, isMusicToolCategory \} from '@\/lib\/songs';/);
});
