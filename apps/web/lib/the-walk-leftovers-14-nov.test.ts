/**
 * 🚶 THE 14 NOV 2026 WALK — the leftovers that must not come back. Each test names the walk item.
 *
 * SABOTAGE: let `accountPersonName` return the stored display name raw again → item 1 is RED; print
 * `user.display_name` raw on /u → item 1 is RED; give an admin page a title without "· Admin" (or put back
 * "Setnayan HQ") → item 6 is RED; title the get-together page "Create a Simple Event" again → item 6 is RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from './strip-comments';
import { accountPersonName } from './account-person-name';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function pages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) pages(p, out);
    else if (name === 'page.tsx') out.push(p);
  }
  return out;
}

test('item 1 · a stored stand-in ("Someone —") is never a person’s name — group chat, /u, the chat picker, the share card', () => {
  // The one place a group names an account: a stand-in display name falls through to first + last, then to null.
  assert.equal(accountPersonName({ display_name: 'Someone —', first_name: 'Ana', last_name: 'Reyes' }), 'Ana Reyes');
  assert.equal(accountPersonName({ display_name: 'Someone —', first_name: null, last_name: null }), null);
  assert.equal(accountPersonName({ display_name: null, first_name: 'Someone', last_name: '—' }), null);
  assert.equal(accountPersonName({ display_name: 'Ana —', first_name: null, last_name: null }), 'Ana');

  const u = code('app/u/[userSlug]/page.tsx');
  assert.doesNotMatch(u, /user\.display_name\?\.trim\(\)/, '/u prints the stored display name raw again');
  assert.doesNotMatch(u, /'Someone on Setnayan'/, '/u says "Someone" for a person with no name');
  assert.match(u, /handle=\{user\.slug \?/, '/u prints the raw S89U-… address when the account has no slug');
  assert.match(code('app/api/og/u/[slug]/route.ts'), /realNameOrNull\(resolved\.user\.display_name\)/, 'the share card');
  const picker = code('app/samahan/chat/new/page.tsx');
  assert.doesNotMatch(picker, /'Someone'/, 'the group chat picker');
  assert.match(picker, /realNameOrNull\(p\.name\)/, 'the group chat picker');
});

test('item 6 · every admin tab reads "X · Admin"; the get-together page has its current name', () => {
  const bad: string[] = [];
  for (const file of pages(join(WEB, 'app/admin'))) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const m = src.match(/export const metadata[^=]*=\s*\{\s*title:\s*(['"`])([\s\S]*?)\1/);
    if (!m) continue;
    if (!/ · Admin$/.test(m[2]!) || /Setnayan HQ|· Setnayan/.test(m[2]!)) bad.push(`${relative(WEB, file)} → "${m[2]}"`);
  }
  assert.deepEqual(bad, [], `admin tab titles off the "X · Admin" pattern:\n${bad.join('\n')}`);
  const simple = code('app/onboarding/simple/page.tsx');
  assert.match(simple, /export const metadata = \{ title: 'Plan a get-together' \};/);
  assert.doesNotMatch(simple, /Simple Event/);
});
