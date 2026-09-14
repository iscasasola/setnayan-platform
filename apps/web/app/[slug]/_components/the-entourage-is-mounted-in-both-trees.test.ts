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
test('the entourage read asks for every column it renders from', () => {
  const src = stripComments(read('app/[slug]/_lib/loaders.ts'));
  const start = src.indexOf('loadEntourage');
  assert.ok(start > 0, 'loadEntourage is gone — this guard is pointing at nothing');
  const select = src.slice(start, start + 1200);
  /* 🔑 `guest_id` and `pair_with_guest_id` join the list for the same reason the
     name parts did: pairing is resolved entirely from those two columns, so a
     query that stops naming them makes every pair vanish — the couple's work
     silently undone, the page still perfectly formed. */
  for (const column of [
    'guest_id',
    'pair_with_guest_id',
    'name_prefix',
    'first_name',
    'middle_name',
    'last_name',
    'name_suffix',
  ]) {
    assert.ok(
      select.includes(column),
      `loadEntourage no longer selects ${column} — that part of every name stops printing, silently`,
    );
  }
});
