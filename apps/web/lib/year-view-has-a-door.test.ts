/**
 * year-view-has-a-door.test.ts — the Year view must stay reachable by clicking.
 *
 * ─── THE REGRESSION THIS EXISTS TO CATCH ─────────────────────────────────────
 * Measured 2026-08-15: a repo-wide sweep for `dashboard/year` found exactly ONE
 * in-app href, inside `<YearMomentsList>`, which renders only when the "This
 * year" home strip renders — and that strip returned `null` whenever its
 * derived list was empty. So the page was unreachable by clicking for a
 * brand-new account, for anyone whose events were all ones they were INVITED to
 * (the strip reads organiser rows only), and for anyone whose events were all
 * archived. The page itself renders content for those people — its own call
 * takes the `includeHolidays` default, so Christmas and Valentine's are on it.
 *
 * 🔑 A DOORWAY THAT ONLY OPENS WHEN THERE IS ALREADY SOMETHING BEHIND IT IS NOT
 * A DOORWAY — and the failure is silent: no error, no 404, just a page nobody
 * can get to. That is the same shape as every other "rejected, not thrown" bug
 * in this repo, and the same shape as `Route_Wayfinding_Audit_2026-07-15`'s
 * finding that a nav row is not a doorway; a rendered link is.
 *
 * ─── WHY THIS IS A SOURCE-TEXT GUARD ─────────────────────────────────────────
 * The two doors live in an RSC (`command-data.ts`, which reaches the server
 * Supabase client) and in an async server component. Neither can be imported by
 * a plain `node:test` process, and a rendering harness for two `<Link>`s would
 * be more machinery than the thing it guards. So this reads the sources.
 *
 * ⚠ THAT MAKES ANCHORING THE WHOLE JOB, because this repo has shipped five
 * guards that passed while the thing they guarded was gone. Every assertion
 * below matches the ACT (a rendered href to this exact route) rather than a
 * symbol name, so renaming `EmptyYear` or `action-year` cannot satisfy it and
 * deleting the JSX cannot survive it. Each one was mutation-checked by deleting
 * the line it guards and confirming the occurrence count moved AND this file
 * went red.
 *
 * ─── THE INVARIANT ───────────────────────────────────────────────────────────
 * TWO INDEPENDENT DOORS, in different files, at least one of which cannot
 * depend on the person already having moments. One door is what got us here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(import.meta.dirname, '..');

const PALETTE = join(WEB, 'app/_components/frontdoor/command-data.ts');
const STRIP = join(WEB, 'app/dashboard/(launcher)/_components/year-moments-strip.tsx');
const LIST = join(WEB, 'app/dashboard/(launcher)/_components/year-moments-list.tsx');

function read(p: string): string {
  return readFileSync(p, 'utf8');
}

/** Count of rendered hrefs to a route — `href="/x"` or `href: '/x'`. */
function doorCount(src: string, route: string): number {
  const r = route.replace(/\//g, '\\/');
  return (src.match(new RegExp(`href\\s*[:=]\\s*['"\`]${r}['"\`]`, 'g')) ?? []).length;
}

test('the command palette carries a door to the Year view', () => {
  // The DATA-INDEPENDENT door: this row is built from a static literal, so it
  // is there for a person with no events, no birthday and nothing derived.
  assert.equal(
    doorCount(read(PALETTE), '/dashboard/year'),
    1,
    'command-data.ts must list exactly one /dashboard/year action row',
  );
});

test('the home strip carries a door to the Year view even when it is empty', () => {
  const src = read(STRIP);
  assert.equal(
    doorCount(src, '/dashboard/year'),
    1,
    'year-moments-strip.tsx must render its own /dashboard/year link (the empty branch)',
  );
  // The populated branch's door lives in year-moments-list.tsx, so a hit in
  // THIS file can only be the empty branch — that is what localises it.
});

test('the empty strip also offers the one thing that fills it', () => {
  assert.equal(
    doorCount(read(STRIP), '/dashboard/profile'),
    1,
    'the empty "This year" tile must link to the profile, where the birthday is typed',
  );
});

test('the strip never disappears entirely when there are no moments', () => {
  const src = read(STRIP);
  // The exact regression: `if (moments.length === 0) return null;`. Matched on
  // the ACT (returning nothing for an empty list), whitespace-tolerant, not on
  // any identifier that could be renamed around it.
  assert.doesNotMatch(
    src,
    /moments\.length\s*===\s*0\s*\)\s*return\s+null/,
    'an empty moment list must render the invitation tile, not null — returning null seals the only strip-side door',
  );
});

test('the populated strip keeps its "See the year" door', () => {
  assert.equal(
    doorCount(read(LIST), '/dashboard/year'),
    1,
    'year-moments-list.tsx must keep the "See the year →" link',
  );
});

test('the doors are in at least two independent files', () => {
  // The whole point: losing any single file must not close the route. Counted
  // over FILES, not occurrences, so three links in one file cannot satisfy it.
  const filesWithADoor = [PALETTE, STRIP, LIST].filter((p) => doorCount(read(p), '/dashboard/year') > 0);
  assert.ok(
    filesWithADoor.length >= 2,
    `expected ≥2 files to carry a /dashboard/year door, found ${filesWithADoor.length}`,
  );
});
