/**
 * the-room-never-names-anyone.test.ts — the seating blocker, guarded at the
 * source.
 *
 * `04` rule 2 (review BLOCKER): *the public seating plan carries table numbers
 * and photo-heat. Never names.* An earlier design published 108 first names on
 * a seating chart. `08` step 2.3's acceptance criterion is literal — "no name
 * appears in the seating markup at all" — so this reads the markup.
 *
 * ── WHY A SOURCE GUARD AND NOT A RENDER TEST ───────────────────────────────
 * A render test proves one fixture produced no name. It cannot prove there is
 * no PATH to one, and the path is the thing: the day somebody adds
 * `display_name` to the room's query "for the tooltip", every existing fixture
 * still renders clean because no fixture has tablemates. So this checks that
 * the room's three files never ASK the database for a person, and that the lens
 * has no prop that could carry one.
 *
 * ── AND WHY IT IS NOT A CHEAPER PROXY ──────────────────────────────────────
 * "The file does not contain the word name" is the proxy, and it is useless:
 * every one of these files says the word "name" in prose a dozen times
 * explaining why it must not have one. So COMMENTS ARE STRIPPED FIRST, through
 * the repo's ONE stripper (`lib/strip-comments.ts`) — a hand-rolled regex both
 * fails the required CI check and silently blanks real code — and what is
 * matched is the actual column identifiers a name arrives in.
 *
 * Every assertion here was sabotage-checked; the occurrence counts are in the
 * PR body.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..', '..');

function code(path: string): string {
  return stripComments(readFileSync(join(WEB, path), 'utf8'));
}

const LENS = code('app/[slug]/_components/story/story-lens.tsx');
const ROOM = code('lib/story-room.ts');
const LOADER = code('app/[slug]/_components/story/spine-data.ts');

/**
 * The columns a person's name actually arrives in, across this schema.
 *
 * Read off the live tables rather than imagined: `guests` carries
 * `first_name` / `last_name` / `display_name`, `public_venue_scene` builds
 * `tablemates` from them, and `guest_columns` / `photo_messages` carry their
 * own author fields. Any of these appearing in the room's source is the defect.
 */
const NAME_COLUMNS = [
  'first_name',
  'last_name',
  'display_name',
  'full_name',
  'guest_name',
  'author_name',
  'tablemates',
  'avatar_config',
  'photo_url',
];

test('no file that draws the room asks the database for a person', () => {
  for (const [where, src] of [
    ['story-lens.tsx', LENS],
    ['story-room.ts', ROOM],
  ] as const) {
    for (const col of NAME_COLUMNS) {
      assert.ok(
        !src.includes(col),
        `${where} mentions \`${col}\` — the public plan carries table numbers and photo heat, never names (04 rule 2, review blocker)`,
      );
    }
  }
});

test('the room loader reads the guest table for an ID and nothing else', () => {
  /*
    The loader DOES touch `guests` — resolving which guest a camera belonged to
    is how a photograph is tied to a table at all. What it must never do is take
    a name off that row while it is there. So the select is read, not the file:
    every `guests` select must be ids only.
  */
  const selects = [...LOADER.matchAll(/\.from\('guests'\)\s*\.select\(\s*'([^']*)'/g)].map(
    (m) => m[1] ?? '',
  );
  assert.ok(selects.length > 0, 'found no guests select to check — has the loader changed shape?');
  for (const sel of selects) {
    const columns = sel.split(',').map((c) => c.trim());
    for (const c of columns) {
      assert.ok(
        /^(guest_id|person_id|event_id|table_id)$/.test(c),
        `the room loader selects \`${c}\` from guests; only ids may leave that table for this surface`,
      );
    }
  }
});

test('nothing the room reads can carry a name, column by column', () => {
  for (const col of NAME_COLUMNS) {
    assert.ok(
      !LOADER.includes(col),
      `spine-data.ts mentions \`${col}\` — a name has no route onto the public plan`,
    );
  }
});

test('the lens takes exactly one string off a table, and it is the label', () => {
  /*
    The positive half. Asserting only that names are absent would pass a lens
    that had stopped rendering anything at all, so this pins what it DOES draw.
  */
  assert.match(LENS, /\{t\.label\}/, 'the lens must draw the table label');
  const tableReads = [...LENS.matchAll(/\bt\.([a-zA-Z]+)/g)].map((m) => m[1]);
  assert.ok(tableReads.length > 0, 'the lens reads nothing off a table — it is drawing nothing');
  for (const field of new Set(tableReads)) {
    assert.ok(
      ['label', 'id', 'shape', 'xPct', 'yPct', 'captures', 'tableId'].includes(field!),
      `the lens reads \`t.${field}\` off a table; the public plan's whole field list is a label, a position and a shape`,
    );
  }
});

test('the plan is drawn only while the reception is in use — through the one function', () => {
  /*
    Owner lock 6 at the call site. `lib/story-room.test.ts` proves
    `seatsAreShown` answers correctly; this proves the lens ASKS it, rather than
    testing the state string itself in three places that can drift apart.
  */
  assert.match(LENS, /seatsAreShown\(/, 'the lens must ask seatsAreShown whether to draw seats');
  const stateComparisons = [...LENS.matchAll(/state === '(\w+)'/g)].map((m) => m[1]);
  for (const s of stateComparisons) {
    assert.ok(
      s !== 'reception',
      "the lens compares state === 'reception' directly; owner lock 6 has ONE test and it is seatsAreShown()",
    );
  }
});

test('the lens withholds small counts BEFORE anything reads them', () => {
  /*
    ⚖ Owner, 2026-09-09: a table with one or two photographs shows nothing —
    "this will subconsciously tell them they did not create enough memories for
    the story".

    🔴 THIS GUARD EXISTS BECAUSE ITS ABSENCE WAS MEASURED. `story-room.test.ts`
    proves `heatWorthShowing` filters correctly, and a sabotage that deleted the
    CALL to it from this component left all twenty of those tests green — the
    floor was still perfectly implemented and simply never applied. A pure
    function nobody calls is the definition of decoration.

    So the call site is pinned: the filtered list is what the plan and the
    sentence both read, and the raw list is touched exactly once — on the line
    that hands it to the filter.
  */
  assert.match(
    LENS,
    /const tables = heatWorthShowing\(measured\)/,
    'the lens must filter the minute’s heat through heatWorthShowing before drawing or describing it',
  );

  // `measured` — the unfiltered list — may be read only twice: to filter it,
  // and to ask whether the minute was quiet rather than empty.
  const rawReads = [...LENS.matchAll(/\bmeasured\b/g)];
  assert.equal(
    rawReads.length,
    3,
    `the unfiltered heat is read ${rawReads.length} times (its declaration, the filter, and the quiet/empty test are the only three allowed) — anything else can put a withheld figure back on the page`,
  );
  assert.match(LENS, /sawSomething = measured\.some/, 'the quiet/empty test is the second read');

  // And nothing downstream may re-derive from the raw list.
  assert.ok(
    !/loudestTable\(measured\)/.test(LENS) && !/heatClassOf\([^)]*measured\)/.test(LENS),
    'the loudest table and the heat classes must come from the FILTERED list',
  );
});

test('the lens is hidden from assistive technology, and says why', () => {
  // Not a style preference: the same fact is in each minute's own "In the room"
  // line, in the reading order. A sticky panel rewritten on every scroll frame
  // would be a live region re-announcing a diagram over the story.
  assert.match(LENS, /aria-hidden="true"/, 'the lens must be aria-hidden');
});
