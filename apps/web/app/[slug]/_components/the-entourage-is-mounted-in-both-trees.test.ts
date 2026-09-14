/**
 * TWO MOUNTS, AND THE BAR STILL HOLDS FIVE.
 *
 * `site-body.tsx` renders two separate subtrees — the anonymous one and the
 * guest one — and only one of them runs for any given viewer. A section mounted
 * in one is INVISIBLE to half the people it was built for, and nothing about
 * the page looks wrong while that is true: the other tree renders perfectly.
 * That is the shape of defect this repo keeps catching, so it gets a check
 * rather than a comment asking the next session to remember.
 *
 * The second assertion guards the OWNER'S RULING of 2026-09-14. Asked whether
 * the entourage should take a sixth slot in the bottom bar, he kept the locked
 * five and put it under Details instead. `site-nav.ts` must therefore never
 * learn the word — a slot added there is the ruling being reversed by accident.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

test('the entourage is mounted in BOTH of site-body’s trees', () => {
  const src = stripComments(read('app/[slug]/_components/site-body.tsx'));
  /* At a TAG BOUNDARY, never as a bare substring: `<EntourageSection` also
     matches `<EntourageSectionHeader`, and a rename to a wrapper would pass a
     substring count while rendering nothing. */
  const mounts = src.match(/<EntourageSection[\s/>]/g) ?? [];
  assert.equal(mounts.length, 2, `expected 2 mounts, found ${mounts.length}`);
  /* The anchor is what makes it linkable from the dashboard and from the
     couple's own copy. Both mounts carry it. */
  const anchors = src.match(/id="site-entourage"/g) ?? [];
  assert.equal(anchors.length, 2, `expected 2 anchors, found ${anchors.length}`);
});

test('the bottom bar did not quietly grow a sixth slot', () => {
  const nav = stripComments(read('app/[slug]/_lib/site-nav.ts'));
  assert.ok(
    !/entourage/i.test(nav),
    'site-nav.ts mentions the entourage — the five-slot ruling is being reversed',
  );
});

test('the section draws nothing when nobody holds a role', () => {
  const src = stripComments(read('app/[slug]/_components/entourage-section.tsx'));
  assert.ok(
    /groups\.length === 0\)\s*return null/.test(src),
    'entourage-section must return null on an empty list — no heading over nothing',
  );
});

/*
  🔑 A COLUMN THE QUERY NEVER NAMES CANNOT BE PRINTED.

  `personName` can compose a perfect "Atty. Arnaldo M. Espinas" and its unit
  test can pass forever while the invitation still reads "Arnaldo Espinas" —
  because the SELECT asked for two of the five parts. That is the whole shape of
  this defect: the pure half is right, the read is short, and nothing is red.
  So the read is pinned here, beside the render, not left to the resolver's own
  test.
*/
test('🔑 every column the entourage renders from is named in ONE place, and both reads use it', () => {
  /*
    A COLUMN THE QUERY NEVER NAMES CANNOT BE PRINTED — and there are now TWO
    queries. `/[slug]` renders the section and `/[slug]/everyone` renders the
    full page, and `_lib/loaders.ts` forbids cross-route imports of its cached
    loaders, so each route runs its own. The column list is the one thing that
    must be identical between them: named in one and not the other renders a
    DIFFERENT entourage on two pages of the same invitation, with nothing red.

    So the check moved with the list. It asserts the CONSTANT holds every
    column, and that neither read has quietly gone back to a literal.
  */
  const lib = stripComments(read('lib/entourage.ts'));
  const m = lib.match(/ENTOURAGE_COLUMNS\s*=\s*\n?\s*'([^']+)'/);
  assert.ok(m, 'ENTOURAGE_COLUMNS is gone — this guard is pointing at nothing');
  const columns = m![1]!;
  for (const column of [
    'guest_id',
    'pair_with_guest_id',
    'display_name',
    'name_prefix',
    'first_name',
    'middle_name',
    'last_name',
    'name_suffix',
    'role',
    'extra_roles',
  ]) {
    assert.ok(
      columns.includes(column),
      `ENTOURAGE_COLUMNS no longer asks for ${column} — that part of the entourage stops printing on BOTH pages, silently`,
    );
  }

  for (const file of ['app/[slug]/_lib/loaders.ts', 'app/[slug]/everyone/page.tsx']) {
    const src = stripComments(read(file));
    assert.ok(
      src.includes('.select(ENTOURAGE_COLUMNS)'),
      `${file} reads the entourage with its own column literal instead of ENTOURAGE_COLUMNS — the two pages can now drift`,
    );
    assert.ok(
      /\.is\(\s*['"]deleted_at['"]\s*,\s*null\s*\)/.test(src),
      `${file} no longer excludes removed guests`,
    );
  }
});
