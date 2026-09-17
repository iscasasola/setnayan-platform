import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { supplierInquiryBody } from '@/lib/supplier-inquiry-opening';
import {
  WEDDING_PROFILE,
  GENERIC_PROFILE,
  SIMPLE_PROFILE,
  TRAVEL_PROFILE,
  WAKE_PROFILE,
  type EventTypeProfile,
} from '@/lib/event-type-profile';
import { stripComments } from '@/lib/strip-comments';

/**
 * THE FIRST MESSAGE A HOST SENDS A SUPPLIER SPEAKS THEIR OCCASION'S LANGUAGE.
 *
 * 🔴 One hard-coded sentence — "Hi! We're planning our wedding and would love to
 * hear about your availability and packages for our date" — was sent for EVERY
 * celebration type from two byte-identical constants. A birthday, a corporate
 * booking, a trip. And a WAKE: a family arranging a funeral introduced
 * themselves to a florist by saying they were planning a wedding.
 *
 * ⚠ THE ASSERTION IS "IT CAME FROM THE PROFILE", NEVER A BANNED-NOUN LIST.
 * A phrasing ban fails in BOTH directions — it misses a reword that makes the
 * identical mistake, and it convicts innocent code (a wedding SHOULD say
 * "wedding"). Every case below derives the expectation from the profile it
 * passes in.
 */

const PROFILES: ReadonlyArray<readonly [string, EventTypeProfile]> = [
  ['wedding', WEDDING_PROFILE],
  ['generic', GENERIC_PROFILE],
  ['simple', SIMPLE_PROFILE],
  ['travel', TRAVEL_PROFILE],
  ['wake', WAKE_PROFILE],
];

let ran = 0;

test('🔑 every profile’s opening names ITS OWN eventWord', () => {
  for (const [name, profile] of PROFILES) {
    ran++;
    const body = supplierInquiryBody(profile);
    assert.ok(
      body.includes(profile.terminology.eventWord),
      `${name}: opening does not use its own eventWord ` +
        `("${profile.terminology.eventWord}") — it is hard-coded again:\n${body}`,
    );
  }
});

test('🔒 no profile’s opening names ANOTHER profile’s eventWord', () => {
  /*
    The real defect, stated as a property: a wake must not say "wedding", but
    equally a wedding must not say "wake". Derived from the profiles themselves,
    so a new event type is covered the day its row exists.
  */
  for (const [name, profile] of PROFILES) {
    const body = supplierInquiryBody(profile);
    const mine = profile.terminology.eventWord;
    for (const [otherName, other] of PROFILES) {
      const theirs = other.terminology.eventWord;
      if (theirs === mine) continue;
      ran++;
      assert.ok(
        !body.includes(theirs),
        `${name} addressed a supplier about a ${theirs} (${otherName}'s word):\n${body}`,
      );
    }
  }
});

test('⚖ the SOLEMN arm is drafted, not a noun swapped into the cheerful one', () => {
  /*
    `register: 'solemn'` is documented in the profile as "a TONE build across
    the whole guest tree, not a row in a table". Swapping one noun would still
    say "would love to hear" and "packages" to a grieving family — shopping
    language for a funeral.

    Asserted structurally: the solemn body must NOT be the celebratory body with
    its eventWord substituted. That compares two generated strings rather than
    forbidding any particular word.
  */
  const solemn = supplierInquiryBody(WAKE_PROFILE);
  const swapped = supplierInquiryBody(WEDDING_PROFILE).replace(
    WEDDING_PROFILE.terminology.eventWord,
    WAKE_PROFILE.terminology.eventWord,
  );
  ran++;
  assert.notEqual(
    solemn,
    swapped,
    'the solemn opening is the celebratory one with a noun replaced',
  );
  // And it must not carry the celebratory arm's shopping register.
  for (const phrase of ['would love to', 'packages', '!']) {
    ran++;
    assert.ok(
      !solemn.includes(phrase),
      `the wake opening says "${phrase}" — that is the celebratory register:\n${solemn}`,
    );
  }
});

test('every opening still asks the two things a supplier needs', () => {
  // Availability and cost. Without these the message is polite and useless.
  for (const [name, profile] of PROFILES) {
    const body = supplierInquiryBody(profile);
    ran++;
    assert.match(body, /availabilit/i, `${name} never asks about availability`);
    assert.match(body, /rate|price|cost/i, `${name} never asks what it costs`);
  }
});

// ── Both call sites ask the profile. ───────────────────────────────────────

const CALLERS = [
  'app/dashboard/[eventId]/vendors/_actions/unlock-category.ts',
  'app/v/[slug]/inquiry-actions.ts',
];

test('neither caller hard-codes an opening any more', () => {
  for (const rel of CALLERS) {
    const src = stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
    assert.match(
      src,
      /supplierInquiryBody\(await resolveProfileByEvent\(/,
      `${rel} does not derive its opening from the event's profile`,
    );
    /*
      ⚠ Not a banned-noun check on the file — these are supplier surfaces and
      may legitimately mention a wedding elsewhere. What must be absent is a
      reconstructed GREETING: the specific shape that was duplicated.
    */
    assert.ok(
      !/We're planning our wedding/.test(src),
      `${rel} still holds the hard-coded greeting`,
    );
  }
});

test('case count', () => {
  console.log(`      (${ran} opening assertions executed)`);
  assert.ok(ran >= 25, `expected >= 25 executed assertions, ran ${ran}`);
});
