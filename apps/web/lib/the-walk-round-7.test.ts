/**
 * 🚶 ROUND 7 — W1's re-walk, 13 Nov 2026. Each test names the walk row.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { realNameOrNull, ROSTER_UNNAMED } from './no-name';
import { NEED_PRESET_LABEL } from './event-needs';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('RW-64 · a stand-in is never a name — "Someone —", "Someone", "—" are no name; a real name is kept', () => {
  for (const stand of ['Someone —', 'Someone', ' — ', '—', 'someone –', '', null, undefined]) {
    assert.equal(realNameOrNull(stand), null, `${JSON.stringify(stand)} read as a name`);
  }
  assert.equal(realNameOrNull('Ana Reyes'), 'Ana Reyes');
  assert.equal(realNameOrNull('Ana —'), 'Ana');
  assert.equal(realNameOrNull('Someone Reyes'), 'Someone Reyes', 'a real surname keeps the word');
  assert.equal(ROSTER_UNNAMED, 'Someone');
  assert.match(code('lib/people-you-can-invite.ts'), /if \(realNameOrNull\(p\.name\) === null\) continue;/, 'the picker');
  assert.match(code('app/[slug]/invite/reply/page.tsx'), /realNameOrNull\(\s*guestDisplayName\(/, 'the reply page');
  assert.match(code('app/_components/account-switcher/get-switcher-data.ts'), /displayName: realNameOrNull\(profile\?\.display_name\),/, 'the switcher');
});

test('RW-65 · plain words for the simple preset; the Get-together tile says supplier', () => {
  assert.equal(NEED_PRESET_LABEL.simple, 'Just photos and one QR for everyone');
  assert.doesNotMatch(JSON.stringify(NEED_PRESET_LABEL), /Simple event|Papic \+/);
  const sql = readFileSync(join(WEB, '..', '..', 'supabase/migrations/20271345904117_rw65_get_together_says_supplier.sql'), 'utf8');
  assert.match(sql, /SET description = '[\s\S]*?No suppliers to book\.'/);
  assert.match(sql, /AND description = '[\s\S]*?No vendors, no marketplace\.'/, 'only the seed text is replaced — an admin edit stays');
});
