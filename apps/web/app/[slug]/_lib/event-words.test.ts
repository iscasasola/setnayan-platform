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
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { articleFor, eventWordsFromProfile } from './event-words';
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

test('the indefinite article follows the resolved noun, not the wedding it replaced', () => {
  // 🪤 A BUG THAT WAS REAL FOR A FEW MINUTES AND WAS CAUGHT BY RENDERING THE
  // SENTENCE, NOT BY READING IT. The co-host invitation door carried the literal
  // "a wedding"; replacing it with `a ${w.eventWord}` reads correctly for the two
  // nouns anyone looks at — "a wedding", "a wake" — and "A EVENT" for the generic
  // profile, "a anniversary" for an anniversary. The moment a noun stops being
  // hardcoded, its GRAMMAR stops being hardcoded with it.
  assert.equal(articleFor('wedding'), 'a');
  assert.equal(articleFor('wake'), 'a');
  assert.equal(articleFor('birthday'), 'a');
  assert.equal(articleFor('event'), 'an');
  assert.equal(articleFor('anniversary'), 'an');
  // Case and stray whitespace: this noun comes from an admin-editable table.
  assert.equal(articleFor('  Event '), 'an');
});

test('the co-host door builds its event name through that article', () => {
  // The door is SCANNED rather than imported: it is an async server component
  // that reads a database, so calling it here would need a live Supabase. What
  // is pinned is that the article is a CALL, not a concatenation.
  const src = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'host', 'accept', '[token]', 'page.tsx'),
    'utf8',
  );
  assert.match(
    src,
    /articleFor\(w\.eventWord\)\}\s*\$\{w\.eventWord\}/,
    'the co-host invitation must build "a wake" / "an event" through articleFor, ' +
      'never by concatenating a bare article onto a resolved noun',
  );
  assert.doesNotMatch(
    src,
    /\?\?\s*`a \$\{w\.eventWord\}`/,
    'a bare "a ${w.eventWord}" renders "a event" — use articleFor',
  );
});

// ── THE MASTHEAD NAMES ONE PERSON WHEN THE EVENT HAS ONE ────────────────────
//
// `08` step 3.1: "single-name masthead when `person_b` is null."
//
// 🔴 THE DEFECT THIS CLOSES. `splitCoupleNames` decided the WEDDING treatment —
// two stacked lines with an italic gild joiner between them — by sniffing the
// display name for " & " or " and ". Measured against real non-wedding names
// before the fix, it fired on all of these:
//
//     "Ayala & Partners Year-End"  →  "Ayala"  &  "Partners Year-End"
//     "Bench & Co Summer Outing"   →  "Bench"  &  "Co Summer Outing"
//     "Mateo and Sofia"            →  "Mateo" and "Sofia"
//
// A corporate year-end party was rendered as a couple. The separator is a fact
// about punctuation; whether the event has two people at its centre is a fact
// about the EVENT TYPE, and only the second may choose the treatment.

import { splitCoupleNames } from '../_components/pahina-masthead';

test('twoPeople is the wedding’s alone — every other seeded type is one name', () => {
  // Measured across all eight seed/backfill migrations: `person_b` is populated
  // on the wedding row and NULL on every other.
  assert.equal(eventWordsFromProfile(WEDDING_PROFILE).twoPeople, true);
  assert.equal(eventWordsFromProfile(GENERIC_PROFILE).twoPeople, false);
});

test('a blank person_b from the admin table reads as one person, not two', () => {
  // Same trim-guard as every other noun here: this is downstream of an
  // admin-editable table, and "   " must not read as a second person.
  const w = eventWordsFromProfile({
    ...WEDDING_PROFILE,
    terminology: { ...WEDDING_PROFILE.terminology, personB: '   ' },
  });
  assert.equal(w.twoPeople, false);
});

test('🔒 a wedding’s masthead splits exactly as it does today', () => {
  const n = splitCoupleNames('Maria & Juan', true);
  assert.deepEqual(n, { first: 'Maria', second: 'Juan', joiner: '&' });
  // And the default is today's behaviour, so an un-wired caller cannot flatten
  // a real couple onto one line.
  assert.deepEqual(splitCoupleNames('Maria & Juan'), n);
});

test('a one-person event keeps its name whole, whatever punctuation it holds', () => {
  // 🪤 THE DISCRIMINATING FIXTURE. A name with NO separator collapses to one
  // line under both the old rule and the new one, so a test using "Lola Rosa"
  // would pass whether or not the fix exists. Every name here CONTAINS a
  // separator — these are the only cases where the two rules disagree.
  for (const name of [
    'Ayala & Partners Year-End',
    'Bench & Co Summer Outing',
    'Mateo and Sofia',
    'Sampaguita & Sons Reunion',
  ]) {
    assert.deepEqual(
      splitCoupleNames(name, false),
      { first: name, second: null, joiner: null },
      `"${name}" was split across two lines with a gild joiner — the wedding masthead`,
    );
  }
});

test('every masthead call site passes the event’s own twoPeople', () => {
  // 🚨 FAILS CLOSED. A walk of the file, not a list of the four sites that
  // exist today: a fifth `<PahinaMasthead` written without the prop silently
  // takes the `true` default and splits a corporate name, and this reports it
  // the day it is added.
  const body = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '..', '_components', 'site-body.tsx'),
    'utf8',
  );
  const mounts = body.split('<PahinaMasthead').length - 1;
  const wired = body.split('twoPeople={clientWords.twoPeople}').length - 1;
  assert.ok(mounts > 0, 'site-body.tsx no longer mounts PahinaMasthead — has it moved?');
  assert.equal(
    wired,
    mounts,
    `site-body.tsx mounts the masthead ${mounts} times but wires twoPeople ${wired} ` +
      'times — the unwired mount(s) fall back to splitting, which renders a ' +
      'one-person event as a couple.',
  );
});
