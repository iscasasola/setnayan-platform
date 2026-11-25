/**
 * the-database-never-speaks-on-screen.test.ts — SW-RAWDB (final check, 25 Nov 2026; area 2 builds it for all areas).
 *
 * Eight findings across four areas had one cause: an action took the database's own message (`error.message`, a
 * column, a constraint, a policy name) and put it in front of a person — returned as the action's error, or written
 * into `?error=` and printed by the page as is. The second half was worse: a page that prints its address bar lets
 * anyone craft a link that shows any words under Setnayan's name.
 *
 * The rule each file below now follows: the raw words go to the log (`logQueryError` / `hostRefusal` / the fault
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
import { sponsorErrorKey, sponsorErrorWords, SPONSOR_ERROR_COPY } from '@/app/dashboard/[eventId]/sponsors/sponsor-error-copy';
import { hostRefusal } from '@/lib/host-refusal';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string): string => stripComments(readFileSync(join(web, rel), 'utf8'));

/** Shapes that carry the database's words toward a screen. */
const RAW = [
  /encodeURIComponent\(\s*[A-Za-z_.]*(?:error|Error|Err)\??\.message/,
  /encodeURIComponent\(\s*'[a-z_]+: ' \+ \w+\.message/,
  /encodeURIComponent\(\(e as Error\)\.message/,
  /error:\s*error\.message\.slice\(/,
  /message:\s*\w*Err\.message/,
  /:\s*error\.message\.slice\(0, 80\)/,
  /We could not add them: \$\{/,
  /body=\{readyErr\?\.message/,
  /body=\{linked\.message\}/,
  /\?error=\$\{encodeURIComponent\(result\.error\)/,
];

const ACTION_FILES = [
  'app/host/accept/[token]/actions.ts',
  'app/dashboard/[eventId]/sponsors/actions.ts',
  'app/dashboard/[eventId]/disputes/actions.ts',
  'app/dashboard/[eventId]/guests/new/actions.ts',
  'app/dashboard/[eventId]/guests/import/actions.ts',
  'app/dashboard/(account)/samahan/actions.ts',
  'app/samahan/join/[token]/actions.ts',
  'app/vendor/claim/[token]/finalize/page.tsx',
  'app/dashboard/[eventId]/studio/papic/moderation/actions.ts',
  'app/dashboard/[eventId]/studio/guest-columns/actions.ts',
  'app/dashboard/[eventId]/studio/mood-board/actions.ts',
  'app/dashboard/[eventId]/studio/photo-delivery/actions.ts',
];

test('no covered action hands the database’s own words to a person', () => {
  for (const f of ACTION_FILES) {
    const s = src(f);
    for (const re of RAW) assert.doesNotMatch(s, re, `${f} still carries raw database text (${re})`);
  }
});

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
  const profile = src('app/dashboard/(account)/profile/page.tsx');
  assert.match(profile, /plainRefusal\(decodeURIComponent\(search\.error\)/);
  assert.match(profile, /plainRefusal\(decodeURIComponent\(search\.slug_error\)/);
});

test('sponsor keys: our own sentences keep their key, anything else is the plain fallback', () => {
  assert.equal(sponsorErrorKey(new Error('Full name is required.')), 'name_required');
  assert.equal(sponsorErrorKey(new Error('Sponsor not found.')), 'not_found');
  assert.equal(sponsorErrorKey(new Error('new row violates row-level security policy for table "event_sponsors"')), 'save_failed');
  assert.equal(sponsorErrorWords('email_invalid'), SPONSOR_ERROR_COPY.email_invalid);
  assert.equal(sponsorErrorWords('Your account is suspended. Call +63 900 000 0000.'), SPONSOR_ERROR_COPY.save_failed);
  assert.equal(sponsorErrorWords(undefined), null);
});

test('hostRefusal returns one plain sentence and none of the refusal’s words', () => {
  const orig = console.error;
  const origWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try {
    const words = hostRefusal('test', { code: '42501', message: 'permission denied for table guests' }, 'add that photo');
    assert.equal(words, 'Couldn’t add that photo — nothing was changed. Try again.');
    assert.doesNotMatch(words, /permission|table|42501/);
  } finally {
    console.error = orig;
    console.warn = origWarn;
  }
});
