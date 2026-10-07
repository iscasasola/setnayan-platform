/**
 * the-top-bar-searches-guests.test.ts — ON THE GUEST LIST THE TOP BAR SEARCHES
 * THIS EVENT'S GUESTS, AND THE PAGE'S OWN ROW IS ADD ONLY.
 *
 * Owner 2026-09-30 (DECISION_LOG "GUEST LIST: ACCESS + CHECK-IN BECOME COLUMNS;
 * HOSTS FOLDS INTO THE GUEST LIST; THE TOP BAR SEARCHES GUESTS"): *"i thought we
 * had a build that will make the search on the top to do the search? so the text
 * box on people will only be add?"* → *"ok"*. INTERACTION_RULES § 4: "The top bar
 * searches the place you're in … The page itself only has 'Add'."
 *
 * Two ways this breaks, both silent: a search box creeps back into the page's
 * row (two searches, one page — the July failure `capture-bar.tsx` records), or
 * the top bar stops driving `?q=` here and quietly opens the palette over your
 * own events again, so typing a guest's name finds nothing.
 *
 * Source scan, comment-stripped: the docblocks below name every string.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { resolveSearchScope } from '@/lib/search-scope';

const APP = join(process.cwd(), 'app');
const GUESTS = join(APP, 'dashboard', '[eventId]', 'guests');
const LAUNCHER = join(APP, 'dashboard', '(launcher)', '_components');
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

test('the Guest list has ONE search box of its own — the thumb row’s “Search or add” (Maker PR 4f, G3)', () => {
  // ⤷ 2026-10-07 (owner, the prototype): the search/add box lives in the THUMB
  // row; it reads the top bar's ?q= on arrival, so the two never disagree.
  const page = read(join(GUESTS, 'page.tsx'));
  const screen = read(join(GUESTS, '_components', 'guests-screen.tsx'));
  assert.doesNotMatch(page, /<LiveSearch\b|<GuestsSearch\b|type="search"|role="search"/, 'the page draws a second search box');
  assert.equal((screen.match(/data-guests-search=""/g) ?? []).length, 1, 'the screen draws more than one search box');
  assert.match(screen, /placeholder="Search or add"/);
  assert.match(page, /initialQuery=\{search\.select === 'to-invite' \? 'to invite' : \(search\.q \?\? ''\)\}/, 'the thumb row no longer adopts the top bar’s ?q=');
  assert.ok(!existsSync(join(GUESTS, '_components', 'guests-search.tsx')), 'the old page-level search box is back');
  // …and it answers with the ONE matcher, through the roster view.
  const lib = read(join(APP, '..', 'lib', 'guest-roster-view.ts'));
  assert.match(lib, /return guestMatchesSearch\(q, g, searchFacts\);/, 'the thumb row search grew its own matcher');
});

test('the top bar resolves to the guests scope on the list — and drives ?q= there', () => {
  assert.equal(resolveSearchScope('/dashboard/S89E-ABCDEFGHJK/guests').key, 'guests');
  const bar = read(join(LAUNCHER, 'home-command-bar.tsx'));
  assert.match(
    bar,
    /if \(scope\.key === 'guests'\) return <GuestsTopSearch scope=\{scope\} \/>;/,
    'the shared bar no longer hands the Guest list its guest search',
  );
  const top = read(join(LAUNCHER, 'guests-top-search.tsx'));
  // The ?q= writer is the roster's own, verbatim — not a second one.
  assert.match(top, /<LiveSearch\b/, 'the top bar guest search stopped using the roster\'s ?q= writer');
  assert.match(top, /useSearchParams\(\)\.get\('q'\)/, 'landing on /guests?q=… no longer shows the query in the bar');
  // The way out keeps what was typed.
  assert.match(top, /marketplaceEscapeItem\(typed, scope\)/, 'the escape row out of the narrowed box is gone');
  // ⌘K comes back to the top bar.
  assert.match(top, /useEffect\(\(\) => claimCommandKey\(\), \[\]\)/, 'the top bar guest search does not claim ⌘K');
});

test('nothing on the Guest list page claims ⌘K any more — the top bar owns it', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name);
      if (name.isDirectory()) {
        // Child routes (a guest card, the desk) are their own pages.
        if (dir === GUESTS && name.name !== '_components') continue;
        walk(p);
      } else if (/\.tsx?$/.test(name.name) && !/\.test\.ts$/.test(name.name)) {
        if (/claimCommandKey\(/.test(read(p))) offenders.push(p);
      }
    }
  };
  walk(GUESTS);
  assert.deepEqual(offenders, [], 'a Guest list component claims ⌘K — two owners on one page');
});

/**
 * ⚖ Owner 2026-10-03 (screenshots: "VIP" and "Bestman" found nobody): ONE
 * matcher answers the search — `guestMatchesSearch` in lib/guest-search.ts,
 * table-tested in lib/guest-search.test.ts. The top bar writes `?q=` through
 * the roster's own writer (above); the page must answer that `?q=` with the one
 * matcher, never an inline `haystack.includes(q)` of its own.
 *
 * 🛡 Sabotaged (see the PR): putting the inline `haystack.includes(q)` back in
 * the page's filter turns this red.
 */
test('the top bar\'s ?q= is answered by the ONE guest matcher', () => {
  const page = read(join(GUESTS, 'page.tsx'));
  const live = read(join(GUESTS, '_components', 'live-search.tsx'));
  assert.match(live, /params\.set\('q', trimmed\)/, 'the top bar no longer writes ?q=');
  assert.match(page, /const q = \(search\.q \?\? ''\)/, 'the page no longer reads ?q=');
  assert.match(page, /import \{ guestMatchesSearch \} from '@\/lib\/guest-search';/, 'the page lost the one guest matcher');
  assert.match(page, /!guestMatchesSearch\(q, g, \{/, 'the page filters ?q= without the one guest matcher');
  assert.doesNotMatch(page, /haystack|\.includes\(q\)/, 'a second, inline guest matcher is back in the page');
});
