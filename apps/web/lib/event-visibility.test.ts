import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  EVENT_VISIBILITIES,
  normalizeVisibility,
  openToStrangers,
  listablePublicly,
  requiresInvitedAccount,
  type EventVisibility,
} from './event-visibility';

/*
  Owner 2026-08-15 — a fourth audience: "only guests with a Setnayan account".

  🔴 THE REGRESSION THESE GUARD IS A SPELLING, NOT A BUG. Every decision about
  who may read a celebration must test this column by ALLOW-LIST. The exclusion
  spelling (`!== 'private'`) is what would have made this new, most-private
  setting completely public across 31 call sites the moment it existed — and the
  same shape on the same column was publishing link-only celebrations to the
  stories shelf and the sitemap earlier the same day.
*/

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Comments here DESCRIBE the removed exclusion tests; scanning them cries wolf. */
const codeOnly = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** Files that decide who may READ a celebration. */
const ACCESS_SOURCES = ['lib/slug-access.ts', 'lib/launch-save-the-date.ts'] as const;

test('the four audiences, widest first, and nothing else', () => {
  assert.deepEqual([...EVENT_VISIBILITIES], [
    'public',
    'unlisted',
    'invited_accounts',
    'private',
  ]);
});

test('only public and unlisted are open to a stranger', () => {
  const open = EVENT_VISIBILITIES.filter(openToStrangers);
  assert.deepEqual(open, ['public', 'unlisted']);
  // The new setting must NEVER be open on the link alone — that is its purpose.
  assert.equal(openToStrangers('invited_accounts'), false);
  assert.equal(openToStrangers('private'), false);
});

test('only public may be LISTED — unlisted is readable but never advertised', () => {
  assert.deepEqual(EVENT_VISIBILITIES.filter(listablePublicly), ['public']);
  // The distinction that "link only" exists for.
  assert.equal(openToStrangers('unlisted'), true);
  assert.equal(listablePublicly('unlisted'), false);
});

test('anything unreadable fails to the most private value', () => {
  for (const junk of [null, undefined, '', 'PUBLIC', 'tagged_only', 'anything']) {
    assert.equal(normalizeVisibility(junk as string | null), 'private');
  }
  for (const v of EVENT_VISIBILITIES) assert.equal(normalizeVisibility(v), v);
});

test('only the new setting pays for the guest-list lookup', () => {
  const needs = EVENT_VISIBILITIES.filter(requiresInvitedAccount);
  assert.deepEqual(needs, ['invited_accounts']);
});

test('no access decision tests this column by exclusion', () => {
  for (const rel of ACCESS_SOURCES) {
    const code = codeOnly(read(rel));
    const bad = code.match(/visibility\s*!==\s*['"](private|public|unlisted)['"]/g) ?? [];
    assert.equal(
      bad.length,
      0,
      `${rel} decides access with an exclusion test (${bad.join(', ')}). ` +
        `An exclusion admits every value added after it — use openToStrangers().`,
    );
  }
});

test('the slug gate calls the allow-list, and the invited-account path exists', () => {
  const code = codeOnly(read('lib/slug-access.ts'));
  assert.ok(code.includes('openToStrangers('), 'canViewSlugEvent must gate on the allow-list');
  assert.ok(
    code.includes('requiresInvitedAccount('),
    'the guest-list lookup must be reached only for the setting that needs it',
  );
  assert.ok(
    /isInvitedAccount\s*\(/.test(code),
    'the invited-account check must actually be called, not merely exported',
  );
});

test('the public event page locks the new setting, and not by exclusion', () => {
  const code = codeOnly(read('app/[slug]/page.tsx'));
  assert.ok(
    /visibility === 'private' \|\| visibility === 'invited_accounts'/.test(code),
    "app/[slug]/page.tsx must take the locked path for 'invited_accounts' too — " +
      'otherwise the new setting renders the celebration to everyone.',
  );
});

test('the host can actually choose it — a setting with no handle is not a setting', () => {
  const screen = read('app/dashboard/[eventId]/website/privacy/page.tsx');
  assert.ok(
    /value="invited_accounts"/.test(screen),
    'the privacy screen must offer the fourth option; five settings in this ' +
      'product have shipped with no way to reach them.',
  );
  const action = codeOnly(read('app/dashboard/[eventId]/website/privacy/actions.ts'));
  assert.ok(
    action.includes('EVENT_VISIBILITIES'),
    'the write action must validate against the shared list, not a hand-typed copy',
  );
});

test('the migration and the code agree on the four values', () => {
  const sql = readFileSync(
    join(WEB, '../../supabase/migrations/20271142156675_invited_accounts_visibility.sql'),
    'utf8',
  );
  for (const v of EVENT_VISIBILITIES) {
    assert.ok(
      sql.includes(`'${v}'::text`),
      `migration CHECK is missing '${v}' — the database would refuse a value the app can write`,
    );
  }
});
