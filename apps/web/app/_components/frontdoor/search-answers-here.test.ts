/**
 * search-answers-here.test.ts — the search box and the page that answers it.
 *
 * ─── WHAT THIS GUARDS, AND WHY IT IS NOT DECORATION ──────────────────────
 * Owner 2026-08-20: the top bar's search must answer in the front door's own
 * body. Before this change every typed word went to the supplier marketplace,
 * which leads with its VENDOR verdict — measured live the same day, `?q=doves`
 * printed "No vendors match exactly. Try widening your search…" ABOVE the
 * doves guide it had found.
 *
 * That defect is invisible to every other check in this repo: both pages
 * render, both return 200, nothing throws, and the query even works. It can
 * only be caught by asserting WHICH page the box posts to and WHAT that page
 * resolves. So this file asserts exactly those two things, plus the promise
 * that now depends on them.
 *
 * 🔑 THE PROMISE MOVED WITH THE DESTINATION. `public-search-nouns.ts` swears
 * the box searches "suppliers, stories and guides", and `site-search-core.test`
 * proves each noun has a resolver SOMEWHERE. It cannot know the box stopped
 * pointing at the page holding them. `suppliers` was resolved by the
 * marketplace query; the front door now answers it itself with
 * `searchLiveShops` and always carries a row handing the words to /explore.
 * Delete either and the box promises a noun its own destination cannot serve —
 * the original defect, wearing the new destination.
 *
 * Every assertion below was mutation-checked by occurrence count (an unmeasured
 * mutation proves nothing): each one was made to FAIL by a single edit that
 * looks like the regression, not by renaming a symbol.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PUBLIC_SEARCH_NOUNS } from '@/lib/public-search-nouns';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

/**
 * Strip comments before matching. Every file touched by this change EXPLAINS
 * the old `/explore` destination in prose, so a raw-source guard would report
 * the defect it just fixed — this repo has shipped five guards that matched
 * their own explanatory text.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SHELL = 'app/_components/frontdoor/front-door-shell.tsx';
const ESCAPE = 'app/_components/frontdoor/command-escape.ts';
const RESULTS = 'app/_components/frontdoor/front-door-results.tsx';
const FRONTDOOR = 'app/_components/frontdoor/front-door.tsx';
const PAGE = 'app/page.tsx';
const DATA = 'app/_components/frontdoor/data.ts';

// ── One box, one destination ───────────────────────────────────────────────

test('the public search form posts to the front door, not the marketplace', () => {
  const src = stripComments(read(SHELL));
  const forms = src.match(/<form[^>]*className="fd-searchbox"[^>]*>/g) ?? [];
  assert.equal(forms.length, 1, 'expected exactly one fd-searchbox form to judge');
  assert.match(
    forms[0]!,
    /action="\/"/,
    'the signed-out search box points somewhere other than `/` — if it posts to ' +
      '/explore again, a story query answers with "No vendors match exactly."',
  );
});

test("the palette's escape row lands on the same page the form does", () => {
  const src = stripComments(read(ESCAPE));
  // The row a signed-in person presses. It must reach the front door's own
  // results, or a member and a stranger typing the same words get different
  // answers from one bar — the split the 2026-08-14 "one search" lock forbids.
  assert.match(
    src,
    /href:\s*`\/\?q=\$\{encodeURIComponent\(q\)\}`/,
    'the escape row no longer lands on the front door',
  );
  assert.equal(
    (src.match(/href:\s*`\/explore\?q=/g) ?? []).length,
    0,
    'the escape row points back at the marketplace',
  );
});

// ── The page that answers actually answers ─────────────────────────────────

test('the front page reads the typed query and hands it to the results view', () => {
  const page = stripComments(read(PAGE));
  assert.match(page, /params\.q\b/, 'app/page.tsx no longer reads ?q=');
  assert.match(page, /<FrontDoor[^>]*\bq=\{q\}/, 'the query never reaches the front door');

  const fd = stripComments(read(FRONTDOOR));
  assert.match(
    fd,
    /<FrontDoorResults/,
    'the front door no longer mounts the results view — a search would silently ' +
      'render the ordinary shelf, which looks like the query was ignored',
  );
  // A whitespace-only ?q= is not a search. Without the trim, pressing Enter on
  // an empty box replaces the whole front page with an empty results list.
  assert.match(fd, /\(q \?\? ''\)\.trim\(\)/, 'the query is no longer trimmed');
});

test('the results view resolves every noun the box promises', () => {
  const src = stripComments(read(RESULTS));
  assert.deepEqual(
    [...PUBLIC_SEARCH_NOUNS],
    ['suppliers', 'stories', 'guides'],
    'the promise changed — this test names each noun below and must be updated with it',
  );
  // stories + guides
  assert.match(
    src,
    /\bsearchReads\(/,
    'the results view stopped resolving stories and guides',
  );
  // suppliers, from the shops the front page already publishes
  assert.match(
    src,
    /\bsearchLiveShops\(/,
    'the results view stopped resolving suppliers — the box still promises them',
  );
});

test('the marketplace row is permanent, not an empty state', () => {
  const src = stripComments(read(RESULTS));
  assert.match(
    src,
    /href=\{`\/explore\?q=\$\{encodeURIComponent\(query\)\}`\}/,
    'the row handing the typed words to the marketplace is gone — that row is ' +
      'the only way to reach the word-bridge and all 192 categories',
  );
  /*
    🔑 IT MUST NOT BE CONDITIONAL ON HAVING FOUND NOTHING. The two searches are
    different searches: this page matches shop names and cities, /explore
    resolves what a supplier DOES. Rendering the row only on zero results hides
    the stronger search at exactly the moment two weak matches make the page
    look answered. The invite block is inside a plain <div>, never a `total ===
    0 ?` branch.
  */
  const gated =
    /\{\s*total === 0 \?\s*\(?\s*<div className="fd-grid">[\s\S]{0,400}?fd-invite/.test(src);
  assert.equal(gated, false, 'the marketplace row became an empty state');
});

// ── One definition of who may be shown ─────────────────────────────────────

test('both shop readers share one visibility gate', () => {
  const src = stripComments(read(DATA));
  /*
    🚨 THE DIRECTION THIS DRIFTS IN IS A HIDDEN SHOP ON THE FRONT PAGE. A shop
    is live only when it is BOTH published and approved; either `.eq()` alone
    has published a hidden shop before. Two readers now need the pair, so the
    pair is written once and applied with `.match()`.
  */
  assert.equal(
    (src.match(/public_visibility:\s*'verified'/g) ?? []).length,
    1,
    'the live-shop gate is defined more than once — a second hand-typed copy is ' +
      'how one reader starts publishing what the other hides',
  );
  assert.equal(
    (src.match(/\.eq\('public_visibility'/g) ?? []).length,
    0,
    'a reader applies the visibility gate inline instead of using LIVE_SHOP_GATE',
  );
  assert.equal(
    (src.match(/\.match\(LIVE_SHOP_GATE\)/g) ?? []).length,
    3,
    'expected exactly three reads behind the gate — the shelf COUNT, the shelf ' +
      'ROWS and the search. A new read must apply the gate too; a dropped one ' +
      'is a reader that stopped asking whether a shop may be shown',
  );
  // The search must not out-reach the shelf's own tokenizer.
  assert.match(
    src,
    /searchTokens\(query\)/,
    'the shop search rolled its own word split — one typed query must be split ' +
      'one way for both halves of the answer',
  );
});
