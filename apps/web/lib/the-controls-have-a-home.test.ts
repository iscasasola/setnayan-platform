/**
 * the-controls-have-a-home.test.ts — two doors that must exist BEFORE the
 * account home is stripped to events only.
 *
 * A mapping pass over every block on the account home found two things that
 * lived ONLY there. Both are being moved out first, and both failures are
 * silent — the control simply stops existing and nothing errors.
 *
 * 🛡 Mutation-checked by occurrence count, each confirmed RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('the only way to hide a story item still has a home, in BOTH branches', () => {
  // `optOutOfEventStory` / `hideMyStoryItem` / `unhideMyStoryItem` are imported
  // exactly once in the repo, by life-story-section.tsx. If the surface that
  // renders it disappears, so do a person's RA 10173 controls over other
  // people's photographs of them — and prod holds zero story items, so nobody
  // would notice until the first one arrived with no off switch.
  const people = read('app/dashboard/(account)/people/page.tsx');
  const mounts = people.match(/<YourStorySection \/>/g) ?? [];
  assert.equal(
    mounts.length,
    2,
    'YourStorySection must render in BOTH branches of the People page. That page ' +
      'returns a separate PeoplePreview when the connection flags are off, and ' +
      'PRODUCTION TAKES THAT BRANCH — mounting only the main one moves the ' +
      'control somewhere nobody can reach.',
  );
  const section = read('app/dashboard/(account)/people/_components/your-story-section.tsx');
  assert.ok(/LifeStorySection/.test(section), 'the section must render the real controls');
  assert.ok(
    /personLifeStoriesEnabled\(\)/.test(section),
    'it stays flag-gated exactly as it was on the home',
  );
});

test('Your year has a doorway that is not a keyboard shortcut', () => {
  // THE DOORWAY MOVED, THE STANDARD DID NOT (owner 2026-08-21: *"this is the
  // your year concept integrated here. deleting the your year menu"*).
  //
  // History, because this test asserted the opposite two days ago. On
  // 2026-08-19 /dashboard/year had two in-app doors — a strip on the account
  // home and a ⌘K row — and the rail row was added on the reasoning that "the
  // home is becoming events-only, so the doorway moves to the rail BEFORE the
  // strip is removed". The board then went the OTHER way: the year's contents
  // are now the "Worth planning" shelf on My Events. So the rail row, its
  // rail-active match and its registry slot are retired together.
  //
  // 🔑 WHAT THIS TEST IS ACTUALLY FOR IS UNCHANGED: "a palette entry is not a
  // doorway". A keyboard shortcut is not a door, and neither is a route with no
  // visible link. So it now asserts the door that replaced the row — and
  // asserts it in BOTH branches, because the empty branch is the one a
  // brand-new account actually sees, and a door that only exists once you
  // already have moments is no door for the person who has none.
  const list = read('app/dashboard/(launcher)/_components/year-moments-list.tsx');
  assert.ok(
    /href="\/dashboard\/year"/.test(list),
    'the populated "Worth planning" shelf lost its "See the year →" door',
  );

  const strip = read('app/dashboard/(launcher)/_components/year-moments-strip.tsx');
  assert.ok(
    /href="\/dashboard\/year"/.test(strip),
    'the EMPTY branch lost its door — and that is the branch a new account sees',
  );

  const page = read('app/dashboard/(launcher)/page.tsx');
  assert.ok(
    /<YearMomentsStrip /.test(page),
    'the shelf that CARRIES the door is no longer mounted on the board, so the ' +
      'door is a link in a component nothing renders. ⚠ This strip had NO ' +
      'consumer at all before 2026-08-21 — it was built, its docblock claimed ' +
      'it rendered inside Alaala, and it was imported by nothing.',
  );

  // And the retired row stays retired: re-adding it without deleting this
  // assertion gives Your year two doors again, which is the duplication the
  // owner removed.
  const rail = read('app/_components/frontdoor/front-door-shell.tsx');
  assert.ok(
    !/href="\/dashboard\/year"/.test(rail),
    'the Your year rail row is back. It was retired with the menu (owner ' +
      '2026-08-21) — if it is wanted again, change this test deliberately.',
  );
});
