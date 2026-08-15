/**
 * year-view-has-a-door.test.ts — the Year view must stay reachable by clicking,
 * and the account's own birthday must stay WIRED IN.
 *
 * ─── THE REGRESSION THIS EXISTS TO CATCH ─────────────────────────────────────
 * Measured 2026-08-15: a repo-wide sweep for `dashboard/year` found ONE in-app
 * href, inside `<YearMomentsList>`, which renders only when the "This year" home
 * strip renders — and that strip returned `null` whenever its derived list was
 * empty. So the page was unreachable by clicking for a brand-new account, for
 * anyone whose events were all ones they were INVITED to (the strip reads
 * organiser rows only), and for anyone whose events were all archived. The page
 * renders content for those people — its own call takes the `includeHolidays`
 * default, so Christmas and Valentine's are on it.
 *
 * 🔑 A DOORWAY THAT ONLY OPENS WHEN THERE IS ALREADY SOMETHING BEHIND IT IS NOT
 * A DOORWAY — and the failure is silent: no error, no 404, just a page nobody
 * can get to.
 *
 * ─── 🚨 THE FIRST CUT OF THIS FILE WAS DECORATION, AND ITS OWN DOCBLOCK SAID
 *     OTHERWISE ─────────────────────────────────────────────────────────────
 * It claimed *"each one was mutation-checked by deleting the line it guards"*.
 * Only ONE spelling had been. Re-measured — `<EmptyYear` occurrences printed
 * before → after, so the sabotage was proven to land — **three other spellings
 * of the identical regression kept it 6/6 GREEN**:
 *
 *     if (!moments.length) return null;            1 → 0 renders · 6 pass 0 fail
 *     if (moments.length === 0) { return null; }   1 → 0 renders · 6 pass 0 fail
 *     if (moments.length < 1) return null;         1 → 0 renders · 6 pass 0 fail
 *
 * …because the old assertion pattern-matched one literal form, and because the
 * orphaned `EmptyYear` function kept holding the two `<Link>`s, so the href count
 * never moved. Nothing removes an unreferenced local component: `tsconfig` sets
 * no `noUnusedLocals` and eslint is `next/core-web-vitals` only.
 *
 * 🔑 **MATCH THE ACT, NOT ONE SPELLING OF IT.** The strip is now asserted to
 * RENDER `<EmptyYear …/>` and to contain no `return null` at all — a rule with no
 * variants to enumerate. And a second assertion pins the callers' WIRING, because
 * the first cut let `buildSelfMoments` be deleted from the strip with the whole
 * suite green: the one user-visible thing the feature adds had no coverage that
 * it was connected.
 *
 * ─── WHY THIS IS A SOURCE-TEXT GUARD ─────────────────────────────────────────
 * The doors live in an RSC (`command-data.ts`, which reaches the server Supabase
 * client) and in an async server component. Neither can be imported by a plain
 * `node:test` process, and a rendering harness for two `<Link>`s would be more
 * machinery than the thing it guards.
 *
 * ⚠ EVERY READ GOES THROUGH `stripComments` FIRST. These files describe the very
 * hrefs being counted in their own prose — this file included — and a raw-text
 * scan matches its own explanation. That has now happened four separate times in
 * this repo. Proven both ways: replacing the real `<Link>` with a JSX comment
 * mentioning the href left the unstripped version fully green.
 *
 * ─── THE INVARIANT ───────────────────────────────────────────────────────────
 * TWO INDEPENDENT DOORS in different files, at least one of which cannot depend
 * on the person already having moments — plus the own-birthday read staying
 * connected at both call sites.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(import.meta.dirname, '..');

const PALETTE = join(WEB, 'app/_components/frontdoor/command-data.ts');
const STRIP = join(WEB, 'app/dashboard/(launcher)/_components/year-moments-strip.tsx');
const LIST = join(WEB, 'app/dashboard/(launcher)/_components/year-moments-list.tsx');
const YEAR_PAGE = join(WEB, 'app/dashboard/(account)/year/page.tsx');

/** Source with comments blanked — never the raw text. */
function code(p: string): string {
  const src = stripComments(readFileSync(p, 'utf8'));
  // A stripper bug that blanked the file would make every "must not contain"
  // assertion below pass vacuously. Refuse to run on an empty read.
  assert.ok(src.trim().length > 200, `${p}: stripped source is implausibly short`);
  return src;
}

/** Count of rendered hrefs to a route — `href="/x"` or `href: '/x'`. */
function doorCount(src: string, route: string): number {
  const r = route.replace(/\//g, '\\/');
  return (src.match(new RegExp(`href\\s*[:=]\\s*['"\`]${r}['"\`]`, 'g')) ?? []).length;
}

function count(src: string, re: RegExp): number {
  return (src.match(re) ?? []).length;
}

test('the command palette carries a door to the Year view', () => {
  // The DATA-INDEPENDENT door: built from a static literal, so it is there for a
  // person with no events, no birthday and nothing derived.
  assert.equal(
    doorCount(code(PALETTE), '/dashboard/year'),
    1,
    'command-data.ts must list exactly one /dashboard/year action row',
  );
});

test('the home strip carries a door to the Year view even when it is empty', () => {
  assert.equal(
    doorCount(code(STRIP), '/dashboard/year'),
    1,
    'year-moments-strip.tsx must render its own /dashboard/year link (the empty branch)',
  );
});

test('the empty strip also offers the one thing that fills it', () => {
  assert.equal(
    doorCount(code(STRIP), '/dashboard/profile'),
    1,
    'the empty "This year" tile must link to the profile, where the birthday is typed',
  );
});

test('the strip never returns nothing — the empty case RENDERS the invitation', () => {
  const src = code(STRIP);
  // The act, not a spelling. Any `return null` in this component seals the door
  // again, however the emptiness test is written.
  assert.equal(
    count(src, /\breturn\s+null\b/g),
    0,
    'year-moments-strip.tsx must not return null — that removes the only strip-side door to /dashboard/year',
  );
  assert.ok(
    count(src, /<EmptyYear\b/g) >= 1,
    'the empty branch must render <EmptyYear /> (the tile that holds the two links)',
  );
});

test('the empty tile does not state a fact it has not established', () => {
  const src = code(STRIP);
  // A refused read reaches the same branch as a genuinely empty year, and the
  // component used to assert "Nothing comes back around yet" for both. The
  // `unsure` prop is what keeps the claim honest — if it goes, so does the fix.
  // 🪤 `\b` IS LOAD-BEARING. The first cut tested /unsure/, which a rename to
  // `unsureX` still satisfies — the same prefix trap as `f.event_dateX`, and the
  // mutation run caught it (7 → 7 occurrences, guard stayed GREEN). Counted, not
  // just tested, so a single leftover mention in one branch cannot stand in for
  // the prop being threaded through both.
  assert.ok(
    count(src, /\bunsure\b/g) >= 3,
    'EmptyYear must keep an `unsure` path (prop, call site, and branch) so a failed read is not reported as "nothing"',
  );
  assert.ok(
    /\breadFailed\b/.test(src),
    'the failed-read flag must still be derived from the query errors, not assumed false',
  );
  assert.equal(
    count(src, /Nothing comes back around/g),
    0,
    'that sentence claims more than the 366-day window can support — a wedding 2 years out reaches it',
  );
});

test('the populated strip keeps its "See the year" door', () => {
  assert.equal(
    doorCount(code(LIST), '/dashboard/year'),
    1,
    'year-moments-list.tsx must keep the "See the year →" link',
  );
});

test('the doors are in at least two independent files', () => {
  // Losing any single file must not close the route. Counted over FILES, not
  // occurrences, so three links in one file cannot satisfy it.
  const filesWithADoor = [PALETTE, STRIP, LIST].filter(
    (p) => doorCount(code(p), '/dashboard/year') > 0,
  );
  assert.ok(
    filesWithADoor.length >= 2,
    `expected ≥2 files to carry a /dashboard/year door, found ${filesWithADoor.length}`,
  );
});

test('both surfaces actually READ the account’s own birthday', () => {
  // 🚨 Without this the whole feature can be deleted with the suite green: the
  // derivation is unit-tested, but nothing asserted either caller CALLS it.
  for (const [name, p] of [
    ['the home strip', STRIP],
    ['the Year page', YEAR_PAGE],
  ] as const) {
    const src = code(p);
    assert.ok(
      count(src, /\bbuildSelfMoments\s*\(/g) >= 1,
      `${name} must call buildSelfMoments — otherwise the own birthday never reaches a screen`,
    );
    assert.ok(
      /\bbirth_date\b/.test(src),
      `${name} must select birth_date — buildSelfMoments has nothing to derive from otherwise`,
    );
  }
});

test('one calendar day never prints twice', () => {
  // A birthday created through onboarding is `recurs: true` by default, so a
  // person with that event AND the date on their profile collided exactly.
  // Both surfaces must go through the shared merge, not concatenate by hand.
  for (const [name, p] of [
    ['the home strip', STRIP],
    ['the Year page', YEAR_PAGE],
  ] as const) {
    assert.ok(
      count(code(p), /\bmergeSelfMoments\s*\(/g) >= 1,
      `${name} must merge via mergeSelfMoments — a raw spread prints the same date twice`,
    );
  }
});

test('the Year page checks its birthday read for an error', () => {
  const src = code(YEAR_PAGE);
  // Supabase resolves with an error rather than throwing, so an unchecked read
  // tells somebody who typed their birthday months ago to add it — forever, with
  // nothing in the logs. Its twin in the strip already checks.
  assert.ok(
    /logQueryError\s*\(/.test(src),
    'year/page.tsx must log a failed users read — otherwise the prompt lies with no trace',
  );
});
