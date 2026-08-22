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

test('Your year and Your Story are retired as MENUS, not as places', () => {
  // THE OWNER RETIRED BOTH MENUS (2026-08-21): *"remove the your year and your
  // story. we already have the your year inside my events. we already have your
  // story on untold."*
  //
  // 🔑 WHAT THIS TEST HAS ALWAYS BEEN FOR IS UNCHANGED: "a palette entry is not
  // a doorway". Retiring a menu is only safe if the place it led to is still
  // reachable by something a person can SEE. So this asserts the replacements,
  // not the removals — a test that only checked the old rows were gone would
  // pass just as happily if the destinations had been orphaned.

  // ── YOUR YEAR — its contents are the board's "Worth planning" shelf ────────
  const page = read('app/dashboard/(launcher)/page.tsx');
  assert.ok(
    /<YearMomentsStrip /.test(page),
    'the "Worth planning" shelf is no longer mounted on the board — the year has ' +
      'no home at all now that its own page redirects here.',
  );

  // ⚠ THE HOLIDAYS HAD TO MOVE FIRST. They were the ONE thing /dashboard/year
  // held that the shelf did not, and they are the dates the shelf exists to warn
  // about (Christmas, Valentine's — the ones that book out early). Retiring the
  // page without this flag would have deleted them from the product silently.
  const strip = read('app/dashboard/(launcher)/_components/year-moments-strip.tsx');
  assert.ok(
    /includeHolidays:\s*true/.test(strip),
    'the shelf stopped including holidays, so retiring /dashboard/year now loses ' +
      'them — that page was the only other place they rendered.',
  );

  // The old page must not serve content any more, or there are two years again.
  const yearPage = read('app/dashboard/(account)/year/page.tsx');
  assert.ok(
    /redirect\('\/dashboard#worth-planning'\)/.test(yearPage),
    '/dashboard/year no longer redirects to the shelf. It is linked from the ' +
      'daily digest email and from anybody who bookmarked it — deleting the ' +
      'route 404s them, and restoring the page brings back the duplicate.',
  );

  // ── YOUR STORY — its door is the account switcher ─────────────────────────
  //
  // ⚠ REWRITTEN 2026-08-22, AND THE OLD VERSION WAS DECORATION. It asserted two
  // things about the BOARD: that a "Write the story of <name>" chip existed, and
  // that the board contained `href="/dashboard/creator"`.
  //
  // Both premises are dead. The chip never led here — it opened the Storyteller
  // composer, and the owner had it repointed at the celebration's OWN story page
  // and then removed entirely in favour of the card. And the board's only
  // remaining `/dashboard/creator` string sits inside `BecomeStorytellerRow`,
  // a component with ZERO call sites anywhere in the app — so that assertion was
  // passing on a link nothing renders. **A string in an unmounted component is
  // not a door.**
  //
  // The real, visible door is the account switcher in the top bar. So this now
  // checks the link AND that the component carrying it is actually mounted on
  // the board's own layout — the two halves that together make it reachable.
  const switcher = read('app/_components/account-switcher/account-switcher.tsx');
  assert.ok(
    /href="\/dashboard\/creator"/.test(switcher),
    'the account switcher no longer links /dashboard/creator — that is now the ' +
      'only door to Your Story a person can see, so removing it strands the desk.',
  );
  const launcherLayout = read('app/dashboard/(launcher)/layout.tsx');
  assert.ok(
    /<AccountSwitcher/.test(launcherLayout),
    'the account switcher is no longer mounted on the board, so its Your Story ' +
      'link renders nowhere a person standing on the board can reach.',
  );

  // ── AND THE RETIRED ROWS STAY RETIRED ────────────────────────────────────
  const rail = read('app/_components/frontdoor/front-door-shell.tsx');
  assert.ok(
    !/href="\/dashboard\/year"/.test(rail),
    'the Your year rail row is back (owner retired it 2026-08-21).',
  );
  assert.ok(
    !/href="\/dashboard\/creator"/.test(rail),
    'the Your Story rail row is back (owner retired it 2026-08-21).',
  );

  const palette = read('app/_components/frontdoor/command-data.ts');
  assert.ok(
    !/'\/dashboard\/year'/.test(palette) && !/'\/dashboard\/creator'/.test(palette),
    'a ⌘K row for a retired menu is back. Both were removed with their rails; ' +
      'the year one now points at a redirect, which is a door that lies about ' +
      'where it goes.',
  );
});
