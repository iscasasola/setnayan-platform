/**
 * the-database-never-speaks-on-screen.test.ts — SW-RAWDB (final check, 25 Nov 2026; area 2 builds it for all areas).
 *
 * Eight findings across four areas had one cause: an action took the database's own message (`error.message`, a
 * column, a constraint, a policy name) and put it in front of a person — returned as the action's error, or written
 * into `?error=` and printed by the page as is. The second half was worse: a page that prints its address bar lets
 * anyone craft a link that shows any words under Setnayan's name.
 *
 * The action-level half (no `error.message` reaches a redirect, a return value or JSX; the one mapper `plainSaveError`)
 * is held by the shipped `guests/_components/a-host-never-reads-database-words.test.ts`; the sponsor keys by
 * `sponsors/the-url-cannot-forge-a-message.test.ts`. This file holds the pages.
 *
 * The rule each file below now follows: the raw words go to the log (`logQueryError` / `plainSaveError` / the fault
 * log), the person reads one plain sentence, and a page prints only fixed words for a known key.
 * Covered: A2-A9 · A2-C6 · A2-D7 · A2-I18 · A2-S1 · A3·P-09 · A3·S-07 · A4-14 · A5-G1-12.
 * (The api-keys, clusters and quick-add pages named by A2-C6 / A2-D7 are retirement candidates, lane R: untouched.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string): string => stripComments(readFileSync(join(web, rel), 'utf8'));



test('the profile actions send a plain sentence, never error.message, into ?error=', () => {
  const s = src('app/dashboard/(account)/profile/actions.ts');
  assert.doesNotMatch(s, /profile\?error=\$\{encodeURIComponent\(error\.message\)\}/);
  assert.doesNotMatch(s, /slug_error=\$\{encodeURIComponent\(updateErr\.message\)\}/);
});

test('pages print fixed words for ?error=, never the address bar’s own text', () => {
  const host = src('app/host/accept/[token]/page.tsx');
  assert.doesNotMatch(host, /\$\{search\.error\}|search\.msg|search\.expected/);
  const join_ = src('app/samahan/join/[token]/page.tsx');
  assert.doesNotMatch(join_, /\$\{search\.error\}/);
  const disputes = src('app/dashboard/[eventId]/disputes/page.tsx');
  assert.match(disputes, /DISPUTE_ERROR_COPY\[search\.error\] \?\? DISPUTE_ERROR_COPY\.save_failed/);
  assert.doesNotMatch(disputes, /\{search\.error\}/);
  const sponsors = src('app/dashboard/[eventId]/sponsors/page.tsx');
  assert.match(sponsors, /const errorMessage = sponsorErrorWords\(search\.error\)/);
  const newGuest = src('app/dashboard/[eventId]/guests/new/page.tsx');
  assert.doesNotMatch(newGuest, /\?\? rawError/);
  for (const f of ['app/dashboard/(account)/samahan/new/page.tsx', 'app/dashboard/(account)/samahan/[communityId]/page.tsx']) {
    assert.doesNotMatch(src(f), /\?\? rawError/, `${f} prints an unknown ?error= as is`);
  }
  const photo = src('app/dashboard/[eventId]/studio/photo-delivery/page.tsx');
  assert.doesNotMatch(photo, /Could not save sync mode: \{errorMessage\}/);
});

