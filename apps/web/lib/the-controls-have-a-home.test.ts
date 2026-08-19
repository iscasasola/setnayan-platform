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
  // Before this, /dashboard/year had exactly two in-app doors: the strip on the
  // account home, and a ⌘K row. The account home's own docblock states the
  // standard — "a palette entry is not a doorway" — which is the justification
  // it gives for building the People tile.
  const rail = read('app/_components/frontdoor/front-door-shell.tsx');
  assert.ok(/href="\/dashboard\/year"/.test(rail), 'the rail must carry a Your year row');
  assert.ok(/RAIL_SLOT\.year/.test(rail), 'its label must come from the registry, like its siblings');

  const registry = read('lib/nav-registry-defaults.ts');
  assert.ok(
    /"customer\.account\.year"/.test(registry),
    'without a registry slot the row can never be renamed from admin — the exact ' +
      'defect the People row carried: a reference that looks like a mechanism.',
  );

  const matcher = read('app/_components/frontdoor/rail-active.ts');
  assert.ok(
    /key: 'year', href: '\/dashboard\/year'/.test(matcher),
    'without a match row the rail never lights up on the page it links to',
  );
});
