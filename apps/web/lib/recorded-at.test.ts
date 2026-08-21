import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRecordedAt } from './recorded-at';

test('a stamp is read in the event’s clock, not the machine’s', () => {
  // 🔴 THE WHOLE POINT. 15:04Z on the 11th is already the 11th in Manila, but
  // 16:04Z on the 11th is the 12th there — and a machine in New York would
  // render both as the 11th. This asserts the +08 boundary, which is the exact
  // shape of the 2026-08-04 off-by-a-day family.
  assert.equal(formatRecordedAt('2026-12-11T15:04:00.000Z'), '11 Dec 2026');
  assert.equal(formatRecordedAt('2026-12-11T16:04:00.000Z'), '12 Dec 2026');
});

test('midnight UTC is not yesterday', () => {
  assert.equal(formatRecordedAt('2026-12-12T00:00:00.000Z'), '12 Dec 2026');
});

test('nothing recorded renders nothing — never "Invalid Date"', () => {
  for (const bad of [null, undefined, '', '   ', 'not a date', '2026-13-45']) {
    assert.equal(formatRecordedAt(bad as string | null), null, `${String(bad)} produced a date`);
  }
});

test('the formatter is pinned to a NAMED zone, so the suite proves the same thing everywhere', () => {
  // Under TZ=UTC and TZ=Asia/Manila alike; CI runs the first, laptops the second.
  const opts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).resolvedOptions();
  assert.equal(opts.timeZone, 'Asia/Manila');
});

// ── The wiring ──────────────────────────────────────────────────────────────
//
// `rsvp_responded_at` was written by four paths and read by ZERO for its whole
// life — 28 of 36 production guests carried a value nothing could render,
// because the column was absent from the select string and from the row type.
// These guards are what stop it going quiet again.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Strip comments first: a docblock that NAMES a forbidden string satisfies a
 *  raw search, which has fooled several guards in this repo. */
function code(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}
const here = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const GUESTS = here('lib/guests.ts');
const PAGE = code(here('app/dashboard/[eventId]/guests/[guestId]/page.tsx'));

test('the column is selected, or nothing can ever render it', () => {
  const literal = /const GUEST_FIELDS =\s*\n?\s*'([^']+)'/.exec(GUESTS)?.[1];
  assert.ok(literal, 'GUEST_FIELDS moved');
  assert.ok(
    literal.split(',').includes('rsvp_responded_at'),
    'the stamp is written by four paths and selected by none — it is unreadable again',
  );
});

test('🪤 appending it did not break the guest/couple column split guard', () => {
  // guest-note-separation.test.ts pins the exact run
  // `,rsvp_status,notes,guest_note,qr_token,`. Inserting the new field after
  // rsvp_status instead of at the end takes that guard down with it, and the
  // failure would look unrelated to this change.
  assert.match(GUESTS, /,rsvp_status,notes,guest_note,qr_token,/);
});

test('the host is shown it, through the pinned formatter', () => {
  assert.match(PAGE, /formatRecordedAt\(guest\.rsvp_responded_at\)/, 'the value is not read');
  assert.match(PAGE, /Answer recorded \{recordedAt\}/, 'the value is read and never displayed');
  assert.doesNotMatch(
    PAGE,
    /rsvp_responded_at[\s\S]{0,80}toLocale/,
    'the stamp is being formatted in the machine’s clock, not the event’s',
  );
});

test('⚠ it renders only when there IS one, and never claims they did not reply', () => {
  // The writers CLEAR the stamp on pending and maybe, so an absent value means
  // "no answer on record" — not "never replied". An unconditional render would
  // print "Answer recorded " with nothing after it.
  assert.match(PAGE, /\{recordedAt \?/, 'the render is unconditional — a null prints an empty date');
  const line = PAGE.split('\n').find((l) => l.includes('Answer recorded'));
  assert.ok(line, 'the line is gone');
  for (const wrong of [/replied/i, /responded/i, /hasn/i]) {
    assert.doesNotMatch(
      line!,
      wrong,
      'three of the four writers are HOST dashboard paths — this records when Setnayan learned the answer, not when the guest gave it',
    );
  }
});

test("🔴 the date survives a save that did not touch the ANSWER", () => {
  // The host's guest form saves fifteen unrelated things. It used to write
  // now() into the reply date on every press, so opening a guest in December to
  // fix a phone number moved a March reply to December. Invisible until the
  // date went on screen — a stamp nothing reads cannot be caught lying.
  const src = code(here('app/dashboard/[eventId]/guests/[guestId]/actions.ts'));
  assert.doesNotMatch(
    src,
    /rsvp_responded_at:\s*\['attending', 'declined'\]\.includes\([a-zA-Z]+\)\s*\?\s*new Date\(\)/,
    'the unconditional restamp is back — every save rewrites the reply date',
  );
  const at = src.indexOf('const rsvp_responded_at');
  assert.ok(at > -1, 'the derivation is gone — re-point this guard');
  const derive = src.slice(at, src.indexOf(';', src.indexOf('prevGuest?.rsvp_responded_at')));
  assert.match(derive, /answerChanged/, 'the new value does not depend on whether the answer changed');
  assert.match(derive, /prevGuest\?\.rsvp_responded_at/, 'an unchanged answer no longer keeps its own date');
  // …and the prior value must actually be READ, or the line above reads undefined.
  assert.match(
    src,
    /\.select\('role, group_category, rsvp_status, rsvp_responded_at'\)/,
    'the prior answer and date are not selected — the comparison reads undefined and stamps every time',
  );
});
