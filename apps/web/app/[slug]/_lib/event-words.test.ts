/**
 * THE EVENT HUB SPEAKS ITS OWN EVENT — and a wedding does not move.
 *
 * Two duties, and the second is the one that matters:
 *
 *   1. A non-wedding stops being told about "the couple".
 *   2. 🔒 A WEDDING READS BYTE-IDENTICALLY TO BEFORE THIS WORK EXISTED.
 *
 * Duty 2 is why the literal sentences are pinned here rather than described.
 * Production is 3 weddings, 2 simple events and 1 date, so the wedding arm is
 * the ONLY arm any person has ever seen — and it is the one that must not
 * change. If a future edit alters what a wedding guest reads, this file goes
 * red instead of the change shipping quietly.
 *
 * ⚠ The strings below are copied from the rooms. They are duplicated ON PURPOSE:
 * a test that imported them would agree with any edit, which is the failure mode
 * this repo has already recorded ("a guard comparing two hand-typed things is
 * not a guard" — that one compared two things that could drift together; these
 * are pinned against a FROZEN literal, which cannot).
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eventWordsFromProfile } from './event-words';
import {
  WEDDING_PROFILE,
  GENERIC_PROFILE,
  type EventTypeProfile,
} from '@/lib/event-type-profile';

/** A profile with an arbitrary organiser noun, for the non-wedding arms. */
function profileWith(organizerNoun: string, eventWord = 'event'): EventTypeProfile {
  return {
    ...GENERIC_PROFILE,
    terminology: { ...GENERIC_PROFILE.terminology, organizerNoun, eventWord },
  };
}

// ── 1 · THE WEDDING DOES NOT MOVE ───────────────────────────────────────────

test('a wedding still says "the couple", exactly', () => {
  const w = eventWordsFromProfile(WEDDING_PROFILE);
  assert.equal(w.organizer, 'couple');
  assert.equal(w.theOrganizer, 'the couple');
  assert.equal(w.TheOrganizer, 'The couple');
  assert.equal(w.theOrganizerPossessive, 'the couple’s');
  assert.equal(w.TheOrganizerPossessive, 'The couple’s');
  assert.equal(w.eventWord, 'wedding');
});

test('every rewritten sentence reproduces its original wedding text byte for byte', () => {
  const w = eventWordsFromProfile(WEDDING_PROFILE);

  // Each pair is [what the room renders now, what it rendered before this work].
  // The right-hand side is frozen and must never be edited to match a change.
  const pairs: Array<[string, string]> = [
    [
      `Your seat is being arranged. Once ${w.theOrganizer} posts the seating, your exact table and a map to it will appear right here.`,
      'Your seat is being arranged. Once the couple posts the seating, your exact table and a map to it will appear right here.',
    ],
    [
      `${w.TheOrganizer} is still arranging the venue layout. Check back closer to the day — your seat pass will appear here.`,
      'The couple is still arranging the venue layout. Check back closer to the day — your seat pass will appear here.',
    ],
    [
      `${w.TheOrganizer} hasn’t published the seating plan for this celebration. Check back closer to the day — once they post it, you’ll be able to find your table here.`,
      'The couple hasn’t published the seating plan for this celebration. Check back closer to the day — once they post it, you’ll be able to find your table here.',
    ],
    [
      `${w.TheOrganizer} is still arranging the venue layout. Check back closer to the day — your table map will appear here.`,
      'The couple is still arranging the venue layout. Check back closer to the day — your table map will appear here.',
    ],
    [
      `${w.TheOrganizer} will assign seats closer to the day.`,
      'The couple will assign seats closer to the day.',
    ],
    [
      `The digital money dance — straight to ${w.theOrganizer}.`,
      'The digital money dance — straight to the couple.',
    ],
    [
      `${w.TheOrganizer} hasn’t published the program yet. Check back closer to the day.`,
      'The couple hasn’t published the program yet. Check back closer to the day.',
    ],
    [
      `Every shot lands in ${w.theOrganizerPossessive} gallery — and tagged guests get theirs in real time.`,
      'Every shot lands in the couple’s gallery — and tagged guests get theirs in real time.',
    ],
    [
      `This name will appear on your invitation, in ${w.theOrganizerPossessive} guest list, and on photos you’re tagged in.`,
      'This name will appear on your invitation, in the couple’s guest list, and on photos you’re tagged in.',
    ],
    [
      `Pin your cash on ${w.theOrganizer} — wherever you are in the world.`,
      'Pin your cash on the couple — wherever you are in the world.',
    ],
  ];

  for (const [now, before] of pairs) assert.equal(now, before);
  // Pin the count too: deleting a pair to make this pass would otherwise be
  // silent, and every one of these is a sentence a real guest reads.
  assert.equal(pairs.length, 10, 'a pinned wedding sentence was removed');
});

// ── 2 · EVERY OTHER EVENT STOPS BEING A WEDDING ─────────────────────────────

test('a birthday hears its own word, not "the couple"', () => {
  const w = eventWordsFromProfile(profileWith('celebrant', 'birthday'));
  assert.equal(w.TheOrganizer, 'The celebrant');
  assert.equal(
    `${w.TheOrganizer} will assign seats closer to the day.`,
    'The celebrant will assign seats closer to the day.',
  );
  assert.equal(w.eventWord, 'birthday');
  assert.ok(!w.theOrganizer.includes('couple'));
});

test('a corporate day and a graduation each get their own', () => {
  assert.equal(eventWordsFromProfile(profileWith('organizer')).TheOrganizer, 'The organizer');
  assert.equal(eventWordsFromProfile(profileWith('graduate')).TheOrganizer, 'The graduate');
});

test('an unknown type degrades to "the host" — plain, never wrong', () => {
  const w = eventWordsFromProfile(GENERIC_PROFILE);
  assert.equal(w.theOrganizer, 'the host');
  assert.equal(w.theOrganizerPossessive, 'the host’s');
});

// ── 3 · THE EDGES ───────────────────────────────────────────────────────────

test('a noun already ending in s takes the bare apostrophe', () => {
  // Nothing seeded ends in s today; one added later must not read "parents’s".
  const w = eventWordsFromProfile(profileWith('parents'));
  assert.equal(w.theOrganizerPossessive, 'the parents’');
});

test('a blank noun from the admin table never renders an empty gap', () => {
  // This table is admin-editable, so a cleared field is reachable. "The  will
  // assign seats" is worse than a plain word.
  const w = eventWordsFromProfile(profileWith('   ', '  '));
  assert.equal(w.TheOrganizer, 'The host');
  assert.equal(w.eventWord, 'event');
});

// ── 4 · THE HONOREE / ORGANISER SPLIT (owner ruling 2026-08-18) ─────────────

test('couple, host and organizer RUN the event — they keep being named', () => {
  // The owner kept all five words. Three of them name whoever runs the event,
  // so an admin sentence may name them without saying anything untrue.
  for (const noun of ['couple', 'host', 'organizer']) {
    const w = eventWordsFromProfile(profileWith(noun));
    assert.equal(w.organizerIsHonoree, false, `${noun} was treated as the honoree`);
  }
  assert.equal(eventWordsFromProfile(WEDDING_PROFILE).organizerIsHonoree, false);
});

test('celebrant and graduate are the person the event is ABOUT', () => {
  // At a seven-year-old's birthday the celebrant is the seven-year-old, so the
  // six admin sentences must not say he arranged the venue.
  for (const noun of ['celebrant', 'graduate']) {
    assert.equal(
      eventWordsFromProfile(profileWith(noun)).organizerIsHonoree,
      true,
      `${noun} is being named as the person who does the admin`,
    );
  }
});

test('an unrecognised word is treated as an organiser, not an honoree', () => {
  // The safe direction: naming a real organiser reads fine; naming a child who
  // arranged nothing does not. A word added later keeps today's behaviour.
  assert.equal(eventWordsFromProfile(profileWith('convenor')).organizerIsHonoree, false);
});

test('the six admin sentences read correctly for BOTH kinds of word', () => {
  const child = eventWordsFromProfile(profileWith('celebrant', 'birthday'));
  const host = eventWordsFromProfile(profileWith('host'));
  const wed = eventWordsFromProfile(WEDDING_PROFILE);

  const seats = (w: ReturnType<typeof eventWordsFromProfile>) =>
    w.organizerIsHonoree
      ? 'Seats will be assigned closer to the day.'
      : `${w.TheOrganizer} will assign seats closer to the day.`;

  assert.equal(seats(child), 'Seats will be assigned closer to the day.');
  assert.equal(seats(host), 'The host will assign seats closer to the day.');
  // 🔒 And the wedding is untouched — the couple both run it and are honoured
  // by it, which is exactly why `couple` works where `celebrant` does not.
  assert.equal(seats(wed), 'The couple will assign seats closer to the day.');
});

test('the sentences that are genuinely ABOUT the honoree still name them', () => {
  // A birthday greeting really is for the celebrant, and a gift really is too.
  // This split must not leak into those.
  const child = eventWordsFromProfile(profileWith('celebrant', 'birthday'));
  assert.equal(
    `Your greeting is on its way to ${child.theOrganizer}.`,
    'Your greeting is on its way to the celebrant.',
  );
});

test('the typographic apostrophe is used, never the straight one', () => {
  // The guest tree is set in an editorial face; a straight quote is visible.
  const w = eventWordsFromProfile(WEDDING_PROFILE);
  assert.ok(w.theOrganizerPossessive.includes('’'));
  assert.ok(!w.theOrganizerPossessive.includes("'"));
});
