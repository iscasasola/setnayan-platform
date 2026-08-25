import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_NAV_ALIASES, ADMIN_NAV_DESCRIPTIONS } from './admin-nav-descriptions';

/**
 * A search must find the same thing on a phone as on a laptop.
 *
 * 🪤 THE BUG THIS EXISTS FOR. The owner typed "pending" into the admin search
 * and got *"Nothing called pending."* — correct, and useless: three different
 * pages hold pending work and none has that word in its name. It was fixed by
 * giving the DESKTOP palette a haystack of descriptions plus hand-picked
 * aliases. The phone's "All surfaces" map has its own filter, which kept
 * matching titles only — so **the same complaint stayed live on the device the
 * owner actually reported it from**, while looking fixed everywhere I checked.
 *
 * 🔑 ONE LIST, TWO READERS. The aliases now live beside the descriptions and
 * both surfaces import them. This guard fails if either surface stops reading
 * the shared list, or if a word the owner has actually typed stops resolving.
 */

const HERE = join(process.cwd(), 'app/admin/_components');
const PALETTE = readFileSync(join(HERE, 'admin-command-palette.tsx'), 'utf8');
/**
 * The desktop palette stopped building its own haystack on 2026-08-26: it now
 * imports the destination list from admin-destinations.ts, which joins the menu
 * with the scanned route map. The QUESTION this guard asks is unchanged — does
 * the desktop search read the shared aliases — so it follows the one hop rather
 * than being loosened. 🔑 Matching only the palette's own text would now fail on
 * a correct refactor, and "make the guard pass" is how a guard becomes a rubber
 * stamp; matching the pair keeps it honest in both directions.
 */
const DESKTOP_SOURCE =
  PALETTE +
  (/from '\.\/admin-destinations'/.test(PALETTE)
    ? readFileSync(join(HERE, 'admin-destinations.ts'), 'utf8')
    : '');
const GRID = readFileSync(join(HERE, 'mobile-landing-grid.tsx'), 'utf8');
const FILTER = readFileSync(join(process.cwd(), 'app/_components/more-search.tsx'), 'utf8');

test('both surfaces read the SHARED alias list, not a local copy', () => {
  assert.match(
    DESKTOP_SOURCE,
    /ADMIN_NAV_ALIASES\[item\.key\]/,
    'the desktop palette must read the shared aliases',
  );
  assert.match(
    GRID,
    /ADMIN_NAV_ALIASES\[item\.key\]/,
    'the phone map must read the shared aliases',
  );
  // A second literal alias table anywhere is the drift this whole file guards.
  assert.doesNotMatch(
    PALETTE,
    /const ALIASES\s*[:=]/,
    'the palette re-declared its own alias table — that is the split that left ' +
      'the phone behind in the first place',
  );
  assert.doesNotMatch(GRID, /const ALIASES\s*[:=]/, 'the grid declared its own alias table');
});

test('the phone filter searches the full haystack, not just the label', () => {
  assert.match(
    GRID,
    /data-more-hay=/,
    'phone cards must carry a haystack attribute for the filter to read',
  );
  assert.match(
    FILTER,
    /dataset\.moreHay/,
    'the filter must prefer the haystack; matching the label alone is the original bug',
  );
  // The fallback matters: a grid that has not adopted the attribute must keep
  // filtering as before rather than silently matching nothing.
  assert.match(
    FILTER,
    /dataset\.moreHay\s*\?\?[\s\S]{0,60}dataset\.moreLabel/,
    'the filter must fall back to the label when a card has no haystack',
  );
});

test("the words the owner actually typed resolve to a page", () => {
  // 🔑 These are not hypothetical. "pending" is the exact word from the
  // screenshot that started this. If a future edit prunes the alias lists,
  // this fails with the real query rather than an abstract one.
  const haystacks = Object.entries(ADMIN_NAV_ALIASES).map(([key, words]) =>
    [key, words, ADMIN_NAV_DESCRIPTIONS[key] ?? ''].join(' ').toLowerCase(),
  );
  for (const word of ['pending', 'refund', 'proof', 'screenshot', 'gcash', 'erasure', 'scam']) {
    assert.ok(
      haystacks.some((h) => h.includes(word)),
      `typing "${word}" would find nothing — no admin page's words contain it`,
    );
  }
});

test('every aliased key is a real nav key', () => {
  // An alias for a key that no longer exists is dead weight that looks like
  // coverage — it makes the list appear broader than it is.
  const groups = readFileSync(join(HERE, 'admin-nav-groups.tsx'), 'utf8');
  const orphans = Object.keys(ADMIN_NAV_ALIASES).filter(
    (k) => !groups.includes(`key: '${k}'`),
  );
  assert.deepEqual(
    orphans,
    [],
    `these aliases point at nav keys that no longer exist: ${orphans.join(', ')}`,
  );
});
