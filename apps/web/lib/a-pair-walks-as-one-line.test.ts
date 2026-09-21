import { test } from 'node:test';
import { rosterDoors } from './roster-doors';
import { stripComments } from './strip-comments';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildEntourage,
  entourageGroupOfRole,
  entourageLines,
  peopleOf,
  type EntourageGuestRow,
} from './entourage';

/**
 * ⚖ OWNER 2026-09-20 — the pairing + walking-order ruling.
 *
 *  · A paired couple does NOT collapse on the roster, and no column is removed.
 *    RSVP, meal, seat and contact are facts about a PERSON: a ninang can decline
 *    while her ninong attends.
 *  · The pair collapses to ONE line only where the pair is the unit — the
 *    walking-order panel and the printed processional.
 *  · The order belongs to the LINE. Both halves carry the same
 *    `entourage_order`, which is why this needed no schema change.
 *  · Walking order and seating stay two orderings. Moving a pair never moves a
 *    chair.
 *
 * The first three are executed here, not grepped. The roster one is necessarily
 * a source assertion — but it asserts a COUNT, so a column quietly disappearing
 * fails rather than passing on prose that still mentions it.
 */

const row = (over: Partial<EntourageGuestRow>): EntourageGuestRow => ({
  display_name: null,
  first_name: 'A',
  last_name: 'B',
  role: 'guest',
  extra_roles: null,
  ...over,
});

/** Two people, mutually paired, in the same printed group. */
function pairedFixture(): EntourageGuestRow[] {
  return [
    row({ guest_id: 'ninong', first_name: 'Ramon', last_name: 'Zamora', role: 'principal_sponsor_ninong', pair_with_guest_id: 'ninang' }),
    row({ guest_id: 'ninang', first_name: 'Rosa', last_name: 'Zamora', role: 'principal_sponsor_ninang', pair_with_guest_id: 'ninong' }),
    row({ guest_id: 'solo', first_name: 'Ana', last_name: 'Abad', role: 'principal_sponsor_ninang', pair_with_guest_id: null }),
  ];
}

// ── the decision, executed ─────────────────────────────────────────────────

test('a pair is ONE line; a single is its own line', () => {
  const lines = entourageLines(pairedFixture(), 'principal_sponsors');
  assert.equal(lines.length, 2, 'three people must print as two lines');
  const paired = lines.find((ln) => ln[0] && ln[1]);
  assert.ok(paired, 'the mutual pair did not share a line');
  assert.deepEqual(
    [paired[0]?.id, paired[1]?.id].sort(),
    ['ninang', 'ninong'],
    'the pair shares a line with the wrong people',
  );
});

test('🔑 the LINE is ordered, not the role — a pair moves as one', () => {
  /*
    This is the defect the build exists for. Ninong and ninang are two different
    ROLES, so ordering each role separately could not express a pair at all:
    "move her up" moved her past other ninangs while he stayed where he was.
    Both halves carrying the same number is what makes the column able to say
    this — it always could; nothing was writing it that way.
  */
  const rows = pairedFixture().map((r) =>
    r.guest_id === 'solo' ? { ...r, entourage_order: 0 } : { ...r, entourage_order: 1 },
  );
  const lines = entourageLines(rows, 'principal_sponsors');
  assert.equal(lines[0]?.[0]?.id ?? lines[0]?.[1]?.id, 'solo', 'the hand-placed single is not first');
  const second = lines[1]!;
  assert.ok(second[0] && second[1], 'the pair came apart when it was ordered');
});

test('an unplaced line sorts after every placed one, and never as position zero', () => {
  // `entourage_order ?? 0` would rank everyone untouched ABOVE the line the
  // couple deliberately put first.
  const rows = pairedFixture().map((r) =>
    r.guest_id === 'solo' ? { ...r, entourage_order: 5 } : r,
  );
  const lines = entourageLines(rows, 'principal_sponsors');
  assert.equal(lines[0]?.[0]?.id ?? lines[0]?.[1]?.id, 'solo');
});

test('the invitation prints the pair as one row too', () => {
  const groups = buildEntourage(pairedFixture());
  const sponsors = groups.find((g) => g.key === 'principal_sponsors');
  assert.ok(sponsors, 'the sponsors group did not print');
  assert.equal(sponsors.rows.length, 2, 'the print did not collapse the pair to one line');
  // And nobody is printed twice by the collapse.
  const ids = peopleOf(sponsors).map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'somebody is printed twice');
});

test('a ceremony-only sponsor still walks, and says so', () => {
  const rows = pairedFixture().map((r) =>
    r.guest_id === 'solo' ? { ...r, invited_to_blocks: ['ceremony'] } : r,
  );
  const lines = entourageLines(rows, 'principal_sponsors');
  const solo = lines.flat().find((h) => h?.id === 'solo');
  assert.ok(solo, 'the ceremony-only sponsor was dropped from the processional');
  assert.equal(solo.ceremonyOnly, true, 'the ceremony-only fact did not reach the line');
});

test('a pair may not span two printed groups — the two never share a line', () => {
  const rows = [
    row({ guest_id: 'maid', first_name: 'Mia', last_name: 'Cruz', role: 'maid_of_honor', pair_with_guest_id: 'bearer' }),
    row({ guest_id: 'bearer', first_name: 'Bo', last_name: 'Cruz', role: 'ring_bearer', pair_with_guest_id: 'maid' }),
  ];
  assert.notEqual(
    entourageGroupOfRole('maid_of_honor'),
    entourageGroupOfRole('ring_bearer'),
    'the fixture no longer straddles two groups',
  );
  for (const key of ['honour', 'bearers']) {
    for (const line of entourageLines(rows, key)) {
      assert.ok(
        !(line[0] && line[1]),
        `${key} paired two people who print in different groups`,
      );
    }
  }
});

// ── the roster keeps both rows and every column ────────────────────────────

const ROSTER = readFileSync(
  join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'guest-list-multiselect.tsx'),
  'utf8',
);

test('⚖ the roster never collapses a pair, and removes no column', () => {
  /*
    RSVP, meal, seat and contact are facts about a PERSON — a ninang can decline
    while her ninong attends — so the roster shows two rows and every column.
    Collapsing there would be the one change this ruling forbids.
  */
  const head = ROSTER.slice(ROSTER.indexOf('<thead'), ROSTER.indexOf('</thead>'));
  // 🪤 A COLUMN IS A HEADER CELL HOWEVER IT IS SPELLED. Since #5793 six of the
  // eight render through `<ArrangeTh>` (the header became the arrangement
  // control), so counting literal `<th` tags reported "down to 2 columns" while
  // all eight were on screen — this assertion went red on a merge, not on a
  // removal. Matched at a tag boundary so `<ArrangeThing` could not count.
  const columns = (head.match(/<(?:th|ArrangeTh)[\s>]/g) ?? []).length;
  assert.ok(columns >= 8, `the roster is down to ${columns} columns`);

  // Rows are emitted per GUEST, never per pair: no mount is conditioned on a
  // partner, and nothing skips a row because somebody else already showed it.
  assert.ok(
    !/pair_with_guest_id[^\n]*\?[^\n]*null\s*:\s*<DesktopRow/.test(ROSTER),
    'a roster row is now conditional on pairing',
  );
  /* The partner is SHOWN, as a line under the name, with a way to undo it.
     🪤 Matched with a tag boundary: a bare `includes('<PartnerLine')` also
     matches `<PartnerLineX`, so renaming the mount passed a first draft of
     this. A substring is not a mount. */
  assert.match(ROSTER, /<PartnerLine[\s/>]/, 'the roster stopped showing "walks with"');
  assert.match(ROSTER, /\bunpairGuestAction\b/, 'the roster lost its unpair control');
});

// ── the two orderings stay two orderings ───────────────────────────────────

test('⛔ reordering the processional cannot touch a chair', () => {
  const action = readFileSync(
    join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', 'entourage-order-actions.ts'),
    'utf8',
  );
  // Comments may name them; a WRITE may not.
  const code = stripComments(action);
  for (const seatThing of ['event_seat_assignments', 'seating_priority']) {
    assert.ok(
      !code.includes(seatThing),
      `the walking-order action touches ${seatThing} — moving a pair would move a chair`,
    );
  }
  assert.match(code, /entourage_order: index/, 'the action no longer writes the line position');
});

// ── ⚖ "where is the arranging? why do you not build it?" (owner 2026-09-20) ──

const PANEL = readFileSync(
  join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'entourage-order-panel.tsx'),
  'utf8',
);
const DRAG = readFileSync(
  join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'walking-order-lines.tsx'),
  'utf8',
);

test('🔑 the arranging is reachable WITHOUT knowing to filter first', () => {
  /*
    It was built and it was hidden: the panel rendered only under a role filter,
    so on the default view the one place to arrange the processional did not
    exist. From where the owner was standing that is the same as not built.
  */
  const { printedGroupsForView } = require('../app/dashboard/[eventId]/guests/_components/entourage-order-panel') as {
    printedGroupsForView: (v: string) => string[];
  };
  assert.ok(printedGroupsForView('all').length > 1, '"All" offers no group to arrange');
  assert.ok(printedGroupsForView('').length > 1, 'an empty view offers no group to arrange');
  assert.deepEqual(
    printedGroupsForView('principal_sponsors'),
    ['principal_sponsors'],
    'a role view no longer narrows to its own group',
  );
});

test('the panel heads each group with its printed NAME, not a raw key', () => {
  // A first draft rendered `key.replace(/_/g, ' ')` — "principal sponsors",
  // lower case, which is a key with its underscores knocked out, not a heading.
  assert.match(PANEL, /entourageGroupLabel\(key\)/, 'the panel is printing a raw group key');
});

test('⚖ drag is ADDITIONAL — the buttons remain the always-available path', () => {
  // The Move ↑ / ↓ forms are plain server-action posts: no JavaScript, works on
  // a phone and under assistive tech. The drag layer wraps them, never replaces
  // them, and hides its own handle below `sm`.
  /* 🪤 Tag boundaries, for the THIRD time in this session: `<MoveButton` is a
     substring of `<MoveButtonX`, so a bare match passes a renamed mount. A
     substring is not a mount. */
  assert.match(PANEL, /<MoveButton[\s/>]/, 'the always-available buttons are gone');
  assert.match(PANEL, /<WalkingOrderLines[\s/>]/, 'the drag layer is not mounted');
  assert.match(DRAG, /hidden[^"]*sm:inline-flex/, 'the drag handle is offered on touch');
});

test('a drag handle answers the keyboard, and says what it did', () => {
  // 🔑 A handle that only drags is a control half the room cannot use — and a
  // reorder nobody can hear is indistinguishable from a dead one.
  for (const [what, re] of [
    ['grab with Space', /e\.key === ' '/],
    ['move with arrows', /ArrowUp|ArrowDown/],
    ['cancel with Escape', /e\.key === 'Escape'/],
    ['announce its state', /aria-pressed=\{held\}/],
    ['announce the move', /aria-live="polite"/],
  ] as const) {
    assert.match(DRAG, re, `the drag handle cannot ${what}`);
  }
});

test('⛔ the drag path posts NAMES, and touches no chair', () => {
  // A position only means something against the list the client was looking at.
  // Naming the lines lets a stale order be refused instead of obeyed.
  const action = readFileSync(
    join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', 'entourage-order-actions.ts'),
    'utf8',
  );
  const code = stripComments(action);
  assert.match(code, /setEntourageLineOrder/, 'the explicit-order action is gone');
  assert.match(code, /order_is_stale/, 'a stale client order is applied instead of refused');
  for (const seatThing of ['event_seat_assignments', 'seating_priority']) {
    assert.ok(!code.includes(seatThing), `the drag path touches ${seatThing}`);
  }
});

// ── ⚖ "so how to launch it on the guestlist?" (owner 2026-09-20) ────────────

const SWITCHER = readFileSync(
  join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'view-switcher.tsx'),
  'utf8',
);
const PAGE = readFileSync(
  join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', 'page.tsx'),
  'utf8',
);
const ROSTER_DOORS_SRC = readFileSync(join(process.cwd(), 'lib', 'roster-doors.ts'), 'utf8');

test('🔑 there is a LABELLED way in — a tab in the guest list’s tab row', () => {
  /*
    The panel had no entry point at all: it rendered under a role filter only,
    so arranging the processional was reachable solely by somebody who already
    knew to filter first. A control nobody can find is not a control.

    🪤 The door MOVED (2026-09-21): from the List · Mind map switcher to the tab
    row beside Roster (lib/roster-doors.ts), and the switcher's copy was deleted
    as a duplicate ("wedding march is repeated?"). Executed, not grepped.
  */
  const walk = rosterDoors({ eventId: 'E', view: 'list', finished: false, hasProcessional: true, hasJoinLink: true })
    .tabs.find((d) => d.key === 'walk');
  assert.ok(walk && walk.kind === 'tab', 'the Wedding March has no way in');
  assert.equal(walk.label, 'Wedding March', 'the tab has no readable label');
  assert.equal(walk.href, '/dashboard/E/guests?gview=walk', 'the tab goes nowhere');
});

test('the walking order is a VIEW, not a banner bolted over the roster', () => {
  // The whole processional above the guest list would push the list down the
  // page on every visit, for a job done a handful of times.
  assert.match(PAGE, /gview === 'walk' \? \(\s*<EntourageOrderPanel/, 'the walk view does not render the panel');
  assert.match(PAGE, /'list' \| 'map' \| 'walk'/, 'the page cannot parse the walk view');
  /* 🪤 Slice from the roster's JSX, not from the first mention of its key —
     `rosterLensKey` is DECLARED far above the markup, so slicing at the
     identifier swallowed the walk branch and failed on correct code. A window
     has to face the thing it is judging. */
  const rosterAt = PAGE.indexOf('<div key={rosterLensKey}');
  assert.notEqual(rosterAt, -1, 'the roster block is gone — this guard is blind');
  assert.ok(
    !/<EntourageOrderPanel/.test(PAGE.slice(rosterAt)),
    'the panel is still mounted over the roster as well as being a view',
  );
  // And exactly one mount overall, so it cannot be in two places at once.
  assert.equal((PAGE.match(/<EntourageOrderPanel/g) ?? []).length, 1);
});

test('⚖ a move keeps you in the view you made it from', () => {
  // Dropping `gview` on the way back would bounce the couple out to the roster
  // after every single move — the control would work and still feel broken.
  const action = readFileSync(
    join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', 'entourage-order-actions.ts'),
    'utf8',
  );
  assert.match(
    action,
    /new URLSearchParams\(\{\s*gview: 'walk'/,
    'the walking-order actions redirect back to the roster instead of the view',
  );
});

test("⚖ the owner's word is the ONLY word the couple sees", () => {
  /*
    Owner 2026-09-20 named it: "[Wedding March]". A button called one thing that
    opens a view called another is two names for one idea, and the second one
    always reads as a different feature. So the header button, the view tab and
    the panel's own heading all say it. `entourage_order` stays — a schema name
    is not a word anybody reads.
  */
  /* 🪤 Comments are not copy. A first draft failed on a docblock that explains
     the walking order in prose, which is exactly the kind of false positive
     that teaches somebody to delete the guard. Strip comments; judge the
     strings a couple can actually read. */
  const copyOf = (src: string) =>
    stripComments(src);
  for (const [what, src] of [
    ['the header button', PAGE],
    ['the view tab', ROSTER_DOORS_SRC],
    ['the panel heading', PANEL],
  ] as const) {
    const copy = copyOf(src);
    assert.match(copy, /Wedding March/, `${what} does not use the owner's word`);
    assert.ok(!/Walking order/.test(copy), `${what} still says "Walking order" to the couple`);
  }
});

test('🔑 a celebration with no processional is not offered one', () => {
  /*
    A generic event's roles are guest · host · vip · family · helper — not one
    of them walks down an aisle. "Wedding March" on a birthday guest list would
    be the wrong word over an empty view.

    DERIVED from the event's own role set, never from a list of event types, so
    a new profile answers correctly the day it is added.
  */
  assert.match(
    PAGE,
    /const hasProcessional = resolveRoleSet\(guestRoleSetKey\)\.offeredRoles\.some/,
    'the button is no longer derived from the event\'s own roles',
  );
  // 🪤 The gate moved when the masthead's doors became one row of tabs
  // (2026-09-21): it lives in lib/roster-doors.ts now, and is EXECUTED here
  // rather than matched as a string in a file it no longer lives in.
  const noAisle = rosterDoors({ eventId: 'E', view: 'list', finished: false, hasProcessional: false, hasJoinLink: true });
  assert.ok(!noAisle.tabs.some((d) => d.key === 'walk'), 'the button shows on every event type');
  const aisle = rosterDoors({ eventId: 'E', view: 'list', finished: false, hasProcessional: true, hasJoinLink: true });
  assert.ok(aisle.tabs.some((d) => d.key === 'walk'), 'a wedding lost its Wedding March');
  // …and the page still hands the row the DERIVED answer, not a constant.
  assert.match(PAGE, /hasProcessional=\{hasProcessional\}/, 'the tab row is not given the derived answer');
  // ⚖ And ONLY there (owner 2026-09-21: "wedding march is repeated?"). The
  // List · Mind map switcher carried a second, UNGATED copy — birthdays saw it.
  const switcherCode = stripComments(SWITCHER);
  assert.ok(
    !/Wedding March/.test(switcherCode) && !/key: 'walk'/.test(switcherCode),
    'Wedding March is back in the List · Mind map switcher — two doors, one ungated',
  );
});
