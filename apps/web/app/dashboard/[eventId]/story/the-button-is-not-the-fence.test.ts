/**
 * THE BUTTON IS NOT THE FENCE (08 step 1.6).
 *
 * The editor greys the Published rung out. That is a courtesy, not a gate: an
 * old tab, a client build from before this shipped, or a hand-made request all
 * reach `saveEditorial` directly, and `event_editorial.status` is what every
 * public reader consults. So the same question has to be asked ON THE SERVER,
 * and this file proves it is.
 *
 * ── WHY A SOURCE SCAN, AND WHAT KEEPS IT HONEST ─────────────────────────────
 * `saveEditorial` is a `'use server'` action that opens the admin client and
 * reads four tables; there is no seam to call it through without a database.
 * The DECISION it makes is already tested exhaustively as a pure function
 * (`lib/publish-once-knowing-who-reads-it.test.ts`, all twenty-four cases). What
 * is left to prove is that the action CONSULTS it — a wiring claim, which is
 * what a source scan can actually establish.
 *
 * 🔑 EVERY ARM IS DERIVED AND CHECKED SEPARATELY, NEVER COUNTED AGAINST A FLOOR.
 * This repo has already shipped two guards that went green while a sabotage
 * deleted one of four arms, because they asserted "at least three". Each arm
 * below is its own assertion with its own message, so deleting any one of them
 * fails with the name of the thing that was deleted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const ACTIONS = join(import.meta.dirname, 'actions.ts');

/** The repo's ONE stripper — a docblock DESCRIBING the gate is not the gate. */
function source(): string {
  return stripComments(readFileSync(ACTIONS, 'utf8'));
}

/** The body of `saveEditorial`, so a call somewhere else in the file cannot
 *  stand in for one inside the action that actually writes the status. */
function saveEditorialBody(): string {
  const src = source();
  const start = src.indexOf('export async function saveEditorial');
  assert.ok(start >= 0, 'saveEditorial is gone from actions.ts');
  const next = src.indexOf('export async function ', start + 10);
  return next > start ? src.slice(start, next) : src.slice(start);
}

test('the action READS THE DESK ITSELF rather than trusting the client', () => {
  /*
    "Everything is decided" is a claim about four other tables. A boolean sent
    up from a browser is not evidence of it — that is the difference between a
    gate and a suggestion.
  */
  const body = saveEditorialBody();
  assert.match(
    body,
    /await\s+loadDesk\s*\(\s*eventId\s*\)/,
    'saveEditorial no longer loads the desk — the publish gate is taking the ' +
      'client’s word for whether the host has decided their guests’ words.',
  );
});

test('the action asks the SAME gate the button asks', () => {
  const body = saveEditorialBody();
  assert.match(
    body,
    /publishBlockers\s*\(/,
    'saveEditorial no longer calls publishBlockers — the button and the fence ' +
      'can now drift into different ideas of "ready".',
  );
  /*
    🔴 AND EACH FACT IS CHECKED AT ITS SOURCE, NOT AT THE CALL. An earlier
    version of this test asserted only that `deskClear` APPEARED as a key in the
    call — and went green against `deskClear = true`, hardcoded, which is the
    whole gate removed. Measured, not reasoned about: the sabotage took the
    occurrence count of `deskClear = deskIsClear(desk.items)` from 1 to 0 and
    the guard still reported 8 of 8 passing.

    *A guard that watches the wiring and not the value is decoration.* So the
    derivation of each fact is asserted, and the name reaching the call is only
    the last of the three checks.
  */
  assert.match(
    body,
    /deskClear\s*=\s*deskIsClear\(\s*desk\.items\s*\)/,
    'deskClear is no longer derived from the desk — the gate is being handed a ' +
      'constant, and an undecided desk now publishes.',
  );
  assert.match(
    body,
    /consented:\s*consentedAt\s*!==\s*null/,
    'the consent fact is no longer derived from the stored record — the gate is ' +
      'being handed a constant, and a story publishes with nobody having agreed.',
  );
  assert.match(
    body,
    /openCount\s*=\s*desk\.items\.filter\(\s*isWaitingOnTheHost\s*\)\.length/,
    'the refusal’s count is no longer derived from the desk, so a host is told a ' +
      'number nobody measured.',
  );
  // …and all three still reach the call. A gate handed two of its three inputs
  // is a gate that stopped reading one, silently.
  for (const fact of ['deskLoaded', 'deskClear', 'consented']) {
    assert.match(
      body,
      new RegExp(`${fact}\\s*[,:]`),
      `the publish gate is no longer handed \`${fact}\`.`,
    );
  }
});

test('a blocked publish RETURNS — it does not fall through to the write', () => {
  const body = saveEditorialBody();
  assert.match(
    body,
    /if\s*\(\s*blockers\.length\s*>\s*0\s*\)\s*\{\s*return\s*\{\s*ok:\s*false/,
    'a blocked publish no longer returns early. A gate that computes a refusal ' +
      'and then writes the row anyway is decoration.',
  );
});

test('an unreadable desk FAILS CLOSED', () => {
  /*
    A rejected query is an ABSENCE, not a thrown error — and `loadDesk` can also
    genuinely throw. Both paths must leave `deskLoaded` false. The initialiser is
    the load-bearing half: if it started `true`, a refusal would publish.
  */
  const body = saveEditorialBody();
  assert.match(
    body,
    /let\s+deskLoaded\s*=\s*false\s*;/,
    'deskLoaded no longer starts false — a desk that could not be read would ' +
      'now count as a desk that is clear.',
  );
  assert.match(
    body,
    /catch\s*\{\s*deskLoaded\s*=\s*false\s*;\s*\}/,
    'the catch around loadDesk no longer forces deskLoaded false.',
  );
  // And the only thing that can turn it true is the desk having no unreadable
  // sources — not merely having loaded.
  assert.match(
    body,
    /deskLoaded\s*=\s*desk\.unreadable\.length\s*===\s*0\s*;/,
    'a desk with an unreadable source now counts as readable. An unreadable ' +
      'source and an empty one look identical.',
  );
});

test('the gate is only reached for `published` — the way down stays open', () => {
  const body = saveEditorialBody();
  assert.match(
    body,
    /if\s*\(\s*audience\s*===\s*'published'\s*\)/,
    'the publish gate is no longer scoped to the published rung. Gating the way ' +
      'DOWN strands a host at published the moment one new thing lands on their ' +
      'desk — and breaks the promise printed under the consent tick.',
  );
});

test('the edition is stamped ONLY on the first move to published', () => {
  const body = saveEditorialBody();
  assert.match(
    body,
    /audience\s*===\s*'published'\s*&&\s*!wasPublished/,
    'the stamp is no longer scoped to the FIRST transition to published.',
  );
  assert.match(
    body,
    /existing\?\.edition_no\s*==\s*null/,
    'the stamp no longer checks that the number is still empty — "theirs ' +
      'forever" means a re-publish keeps the number it was given.',
  );
  assert.match(
    body,
    /existing\?\.room_snapshot\s*==\s*null/,
    'the room freeze no longer checks that nothing is frozen yet.',
  );
});

test('narrowing the audience revalidates the story, the recap AND the print sheet', () => {
  /*
    Going back to guests-only has to actually take the page back from a
    stranger. `/${slug}` alone did not: the recap and the print sheet are their
    own cached routes (`revalidate = 300`) reading the same story, and print is
    the one a stranger can keep.
  */
  const body = saveEditorialBody();
  for (const path of ['`/${ev.slug}`', '`/${ev.slug}/recap`', '`/${ev.slug}/print`']) {
    assert.ok(
      body.includes(`revalidatePath(${path})`),
      `an audience change no longer revalidates ${path} — a narrowed story stays ` +
        `readable there for up to five minutes.`,
    );
  }
});

test('the host’s last word is written through the HOST’S OWN SESSION', () => {
  /*
    `event_editorial` has no couple-facing write RLS, which is why its upsert
    runs on the admin client. `events` DOES have one. Writing the last word with
    the admin client sitting in scope two lines up would drop that second fence
    for nothing — the exact shape of the rule this build is under ("service-role
    reads are outside every RLS rule").
  */
  const body = saveEditorialBody();
  const lastWord = body.slice(body.indexOf('input.lastWord'));
  assert.match(
    lastWord.slice(0, 400),
    /const\s+session\s*=\s*await\s+createClient\s*\(\s*\)/,
    'the last word is no longer written through the caller’s own session.',
  );
  assert.doesNotMatch(
    lastWord.slice(0, 400),
    /admin\s*\n?\s*\.from\(\s*'events'\s*\)\s*\n?\s*\.update/,
    'the last word is being written with the admin client.',
  );
});
