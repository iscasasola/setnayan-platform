import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
  A chapter can finally say which celebration it is about.

  🔴 THE THREE DEFECTS THESE GUARD, ALL MEASURED BEFORE THE FIX:
   1 · `creator_chapters.event_id` was SELECTed, JOINed and commented about in
       three files and written by NOTHING, so the cross-links between a couple's
       own chapter and Setnayan's editorial about the same day could never once
       appear. Prod: one published chapter, event_id NULL.
   2 · The same fact had TWO homes — `substrate.papic_gallery_id` (a hand-typed
       string) drove "shop this event", while the real column drove the
       cross-links and was always empty.
   3 · Both were reachable only by pasting machine ids into text boxes. Nobody
       ever did.

  🔑 EACH TEST NAMES THE REGRESSION, NOT THE IMPLEMENTATION. A writer that stops
  writing, a second home reappearing, or the picker reverting to a text box are
  the three ways this silently goes back to being decorative.
*/

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const codeOnly = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const ACTIONS = 'app/dashboard/(account)/creator/actions.ts';
const COMPOSER = 'app/dashboard/(account)/creator/page.tsx';
const CHAPTER_PAGE = 'app/u/[userSlug]/c/[chapterId]/page.tsx';

test('the join has a writer — both create and update set event_id', () => {
  const code = codeOnly(read(ACTIONS));
  const writes = code.match(/\.event_id\s*=\s*eventId/g) ?? [];
  assert.ok(
    writes.length >= 2,
    `expected createChapter AND updateChapter to write event_id; found ${writes.length}. ` +
      `A column nothing writes is a gate with no handle — this one shipped that way.`,
  );
});

test('unlinking is written, not skipped', () => {
  const code = codeOnly(read(ACTIONS));
  // `undefined` (field absent) leaves the column alone; `null` (picked "not
  // about one of mine") must actually clear it. Guarding the exact test because
  // a truthiness check here would make detaching silently impossible.
  assert.ok(
    /eventId !== undefined/.test(code),
    'event_id must be written whenever the field was submitted, including when ' +
      'it is null — otherwise a chapter can be linked but never unlinked.',
  );
});

test('the submitted event is re-checked against what the author hosts', () => {
  const code = codeOnly(read(ACTIONS));
  assert.ok(/from\('event_members'\)/.test(code), 'membership must be verified server-side');
  assert.ok(
    /member_type['"]\s*,\s*['"]couple/.test(code),
    'only a host may attach a celebration — a form can be posted with any id, ' +
      'and attaching publishes that day’s name, date, venue and suppliers.',
  );
});

test('one home for the day — the gallery value is DERIVED, never a second box', () => {
  const action = codeOnly(read(ACTIONS));
  assert.ok(
    /substrate\.papic_gallery_id\s*=\s*eventId/.test(action),
    'the gallery value must be derived from event_id; two homes for one fact is ' +
      'exactly how half this feature shipped working and half shipped dead.',
  );
  assert.ok(
    !/formData\.get\(['"]papic_gallery_id['"]\)/.test(action),
    'the action must not read a papic_gallery_id field — that is the second home',
  );
});

test('the composer asks with a picker, not a machine id', () => {
  const code = codeOnly(read(COMPOSER));
  assert.ok(
    /<select[\s\S]{0,120}name="event_id"/.test(code),
    'the celebration must be chosen from a list',
  );
  assert.ok(
    !/name="papic_gallery_id"/.test(code),
    'the raw gallery-id text box must be gone — nobody ever filled it',
  );
});

test('the public chapter reads the column first, and can still render old rows', () => {
  const code = codeOnly(read(CHAPTER_PAGE));
  assert.ok(
    /chapter\.event_id \?\? papic_gallery_id/.test(code),
    'the column is the answer; the old bag is only a fallback for chapters ' +
      'written before the picker existed',
  );
  const loader = codeOnly(read('lib/creator-public.ts'));
  assert.ok(
    /event_id/.test(loader.split('\n').find((l) => l.includes('chapter_id, public_id')) ?? ''),
    'the public loader must SELECT event_id — a column absent from the select ' +
      'reads as null forever, which is how this looked fixed while staying dead',
  );
});

test('the day sources its own suppliers — not just filters a typed list', () => {
  const loader = codeOnly(read('lib/creator-public.ts'));
  assert.ok(
    /export async function loadBookedVendorProfileIds/.test(loader),
    'the booked suppliers of a linked celebration must be readable as a SOURCE; ' +
      'the product recorded them and only ever used them to filter a hand-typed list',
  );
  const page = codeOnly(read(CHAPTER_PAGE));
  assert.ok(
    /loadBookedVendorProfileIds\(linkedEventId\)/.test(page),
    'the chapter page must fall back to the day’s own suppliers when the author ' +
      'named none — otherwise "Shop this event" stays empty on a chapter that IS ' +
      'attached to a real celebration',
  );
  assert.ok(
    /namedVendorIds\.length > 0/.test(page),
    'an author who DID name a list must keep it — sourcing is the fallback, not an override',
  );
});

test('the last machine-id box is gone from the composer', () => {
  const code = codeOnly(read(COMPOSER));
  assert.ok(
    !/name="vendor_ids"/.test(code),
    'the comma-separated supplier-id field must not come back — nobody ever filled it, ' +
      'and the day already knows who worked it',
  );
});
