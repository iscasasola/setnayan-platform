/**
 * host-setlist-read.test.ts — the couple can see their own band's set list.
 *
 * The set list shipped a while ago: tables, an editor, and a tested builder. The
 * couple could not see it AT ALL, because each table carried exactly one policy
 * and its audience was the vendor. One missing predicate was the whole feature.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const code = (p: string) =>
  read(p)
    // ⚠ BLOCK COMMENTS FIRST, and NEVER a `{ /* … */ }` pattern. An earlier
    // version stripped JSX comments with /\{\s*\/\*[\s\S]*?\*\/\s*\}/ and it
    // ATE 2.4 KB OF REAL CODE: the `}: {` opening a props type is a `{` followed
    // by a docblock, so the match ran on to a later `*/}` and swallowed
    // everything between — including the very line under test. Removing block
    // comments first turns `{/* … */}` into a harmless `{}` and can never
    // consume code.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n');
const sql = () =>
  readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');

test('the couple is admitted to both set-list tables', () => {
  const s = sql();
  for (const policy of ['vendor_event_sets_couple_read', 'vendor_event_set_songs_couple_read']) {
    assert.ok(new RegExp(`CREATE POLICY ${policy}`).test(s), `${policy} is gone`);
  }
});

test('the audience is the couple, NOT couple-or-coordinator', () => {
  const s = sql();
  const block = s.slice(s.indexOf('CREATE POLICY vendor_event_sets_couple_read'));
  const mine = block.slice(0, block.indexOf('DO $$'));
  assert.ok(
    /current_couple_event_ids\(\)/.test(mine),
    'the couple-read policies no longer use the couple-only helper',
  );
  assert.ok(
    !/current_couple_or_coordinator_event_ids\(\)/.test(mine),
    'A coordinator was admitted to the band’s sets. On this same page a ' +
      'coordinator can read neither the couple’s own picks nor the act’s name, ' +
      'so they would see a set list belonging to nobody they can identify.',
  );
});

test('the reader REPORTS a refused read instead of returning empty', () => {
  const src = code('lib/vendor-sets.ts');
  const fn = src.slice(src.indexOf('export async function fetchEventSetsForHost'));
  assert.ok(/failed: true/.test(fn), 'the host reader swallows failure to an empty list again');
  assert.ok(
    /vendor_profile_id/.test(fn),
    'the host reader stopped selecting which act a set belongs to — with two ' +
      'acts booked the couple cannot tell whose list is whose',
  );
  assert.ok(
    !/\.eq\('vendor_profile_id'/.test(fn),
    'the host reader filters by a vendor id the couple does not have',
  );
});

test('a refused read says so on screen rather than claiming the band did nothing', () => {
  const src = code('app/dashboard/[eventId]/studio/playlist/_components/host-setlist-panel.tsx');
  assert.ok(/if \(failed\)/.test(src), 'the panel no longer distinguishes a refusal from an empty list');
  assert.ok(
    /couldn’t load|couldn't load/.test(src),
    'the refusal branch stopped saying the read failed — an empty list here ' +
      'tells the couple their band has built nothing, which may be false',
  );
});

test('the panel is not gated on the page’s capped music-vendor lookup', () => {
  const src = code('app/dashboard/[eventId]/studio/playlist/page.tsx');
  assert.ok(
    /<HostSetlistPanel/.test(src),
    'the panel is not rendered — the policy would be a permission nobody uses',
  );
  assert.ok(
    !/musicVendorRow[\s\S]{0,120}<HostSetlistPanel/.test(src),
    'the panel is gated on musicVendorRow, which is `.limit(1)` and filtered by ' +
      'a hand-kept category list — an act filed under any other category has ' +
      'built real sets that would never render.',
  );
});

test('the page keeps one block per act', () => {
  const src = code('app/dashboard/[eventId]/studio/playlist/page.tsx');
  assert.ok(
    /setsByAct/.test(src) && /buildVendorSets\(\{ sets,/.test(src),
    'sets are no longer grouped per act before building. Two booked acts may ' +
      'each have a "Set 1" — the uniqueness rule is per act — so one combined ' +
      'call merges two bands’ running orders into a single list.',
  );
});
