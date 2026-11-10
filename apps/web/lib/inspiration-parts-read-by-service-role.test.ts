/**
 * lib/inspiration-parts-read-by-service-role.test.ts — THE PARTS ARE READ WITH THE ROLE THAT MAY READ THEM (G6,
 * 2026-11-10).
 *
 * `inspiration_parts`, `inspiration_part_services` and `inspiration_part_categories_derived` are SELECT-granted to
 * `authenticated` only — `anon` holds nothing (20271287668170 / 20271291224109, the exposure freeze). Their one
 * reader, `getInspirationParts()`, went through the VIEWER's cookie client while its callers grew to pages a
 * stranger opens (the public shop page `/v/[slug]`, Find inspiration). Every request with no session read as
 * `anon`, was refused (42501 — 58 production errors on each relation, 36 visitors, since 28 Oct) and silently drew
 * the SEED instead of the admin's edited parts.
 *
 * The fix is the caller, not a grant: the helper reads with the service role, and `anon` still holds nothing.
 * This pins both halves:
 *   1 · the helper builds its client with `createAdminClient()` and never imports the cookie client;
 *   2 · the committed exposure baseline still gives `anon` nothing on the three relations (a "fix" by GRANT would
 *       have to change it — `exposure-freeze.db.test.ts` stops a widening there too);
 *   0 · non-vacuity: a page a stranger opens really does call the helper, so the rule is about something.
 *
 * 🛡 Sabotaged: `const sb = await createClient()` (from './supabase/server') put back in the helper turns 1 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const HELPER = readFileSync(join(WEB, 'lib', 'inspiration-parts-db.ts'), 'utf8');
const RELATIONS = ['inspiration_parts', 'inspiration_part_services', 'inspiration_part_categories_derived'] as const;

/** The helper's code with comments removed — a sentence ABOUT the cookie client must not pass or fail this. */
const code = stripComments(HELPER);

test('0 · a page a signed-out visitor opens draws the parts — so who reads them matters', () => {
  const shop = readFileSync(join(WEB, 'app', 'v', '[slug]', 'page.tsx'), 'utf8');
  assert.match(shop, /getInspirationParts\(\)/, 'the public shop page no longer calls getInspirationParts — re-point this test');
  for (const r of RELATIONS) assert.ok(code.includes(`.from('${r}')`), `the helper no longer reads ${r} — re-point this test`);
});

test('1 · getInspirationParts reads with the service role, never the viewer\'s cookie client', () => {
  assert.doesNotMatch(code, /from '\.\/supabase\/server'|from '@\/lib\/supabase\/server'/, 'the helper imports the cookie client again');
  assert.match(code, /import \{ createAdminClient \} from '\.\/supabase\/admin'/, 'the helper does not import createAdminClient');
  const body = /export const getInspirationParts = cache\(async \(\)[\s\S]*?\n\}\);/.exec(code)?.[0] ?? '';
  assert.ok(body, 'getInspirationParts not found in the helper');
  assert.match(body, /=\s*createAdminClient\(\)/, 'getInspirationParts does not build its client with createAdminClient()');
});

test('2 · anon still holds NOTHING on the three relations — the fix was the caller, not a grant', () => {
  const baseline = readFileSync(join(WEB, '..', '..', 'supabase', 'security', 'exposure-surface.baseline.txt'), 'utf8');
  for (const r of ['inspiration_parts', 'inspiration_part_services']) {
    assert.ok(baseline.includes(`tpriv\tpublic.${r}|authenticated\tS`), `baseline lost authenticated SELECT on ${r} — is the scan still reading it?`);
  }
  for (const r of RELATIONS) {
    assert.ok(!baseline.includes(`tpriv\tpublic.${r}|anon`), `anon was granted ${r} — read with the service role instead`);
    assert.doesNotMatch(baseline, new RegExp(`col\\tpublic\\.${r}\\.\\w+\\tanon=S`), `anon was granted a column of ${r}`);
  }
});
