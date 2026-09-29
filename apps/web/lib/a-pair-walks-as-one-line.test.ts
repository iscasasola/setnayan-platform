import { test } from 'node:test';
import { rosterDoors } from './roster-doors';
import { DETAILS_ITEM_GROUPS, detailsItemHref } from './maker-details-items';
import { yourEventItems, yourEventLabel } from './details-your-event';
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
  // ⚖ 2026-09-23: the write itself moved to `lib/entourage-write.ts` when it
  // became ONE statement instead of one per person. Follow it — a "touches no
  // chair" test that stops looking where the writing happens proves nothing.
  const write = stripComments(readFileSync(join(process.cwd(), 'lib', 'entourage-write.ts'), 'utf8'));
  for (const seatThing of ['event_seat_assignments', 'seating_priority']) {
    assert.ok(!write.includes(seatThing), `the order write touches ${seatThing}`);
  }
  assert.match(write, /orders\.push\(index\)/, 'the write no longer gives the line its position');
  assert.match(write, /rpc\('set_entourage_order'/, 'the write no longer reaches the order function');
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
  /*
    The arrows are still the path that works on a phone, by keyboard and under
    assistive tech, and the drag layer still never replaces them — it hides its
    own handle below `sm`.

    ⚖ 2026-09-23: they are no longer `<form action={serverAction}>` in the
    PANEL; they are buttons inside the island. A form action redirects, which is
    a 303 — the owner's "the whole screen refreshes… it goes back up and does
    not stay on where we are editing". What that gave up is the no-JavaScript
    path, and `the-march-moves-without-a-reload.test.ts` records why that was
    never a path anybody could finish a processional through. What this pins is
    unchanged: BOTH arrows exist, beside the drag, at every width.

    🪤 Tag boundaries: `<MoveArrow` is a substring of `<MoveArrowX`, so a bare
    match passes a renamed mount. A substring is not a mount.
  */
  assert.equal(
    (DRAG.match(/<MoveArrow[\s/>]/g) ?? []).length,
    2,
    'expected both always-available arrows (up and down) beside every line',
  );
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
  // ⚖ 2026-09-23: the refusal is RETURNED now rather than redirected with, so
  // the marker is the reason, not the query-string key it used to travel as.
  assert.match(code, /return \{ ok: false, reason: MARCH_STALE \}/, 'a stale client order is applied instead of refused');
  for (const seatThing of ['event_seat_assignments', 'seating_priority']) {
    assert.ok(!code.includes(seatThing), `the drag path touches ${seatThing}`);
  }
});

// ── ⚖ "so how to launch it on the guestlist?" (owner 2026-09-20) → and then
//    "THE GUEST LIST KEEPS PEOPLE…" (owner 2026-09-29): the march's one home is
//    the Maker's Details › Your event, in the three parts. ────────────────────

const SWITCHER = readFileSync(
  join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'view-switcher.tsx'),
  'utf8',
);
const PAGE = readFileSync(
  join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', 'page.tsx'),
  'utf8',
);
const LAUNCH = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components');
const LOAD = stripComments(readFileSync(join(LAUNCH, 'details-your-event-load.tsx'), 'utf8'));
const MARCH_UI = stripComments(readFileSync(join(LAUNCH, 'details-march.tsx'), 'utf8'));
const WEDDING_KIND = {
  words: { twoPeople: true, solemn: false, eventWord: 'wedding' },
  offeredRoles: ['guest', 'principal_sponsor', 'bridesmaid'],
};
const BIRTHDAY_KIND = {
  words: { twoPeople: false, solemn: false, eventWord: 'birthday' },
  offeredRoles: ['guest', 'host', 'vip', 'family', 'helper'],
};

test('🔑 there is a LABELLED way in — the march is an item of Details › Your event', () => {
  /*
    The panel once had no entry point at all (a role filter only), then a tab
    on the Guest list. Owner 2026-09-29: its home is the Maker — the navigator
    item, in the owner's word. Executed, not grepped.
  */
  const group = DETAILS_ITEM_GROUPS.find((g) => g.group === 'event');
  assert.ok(group?.keys.includes('march'), 'Details › Your event has no march');
  assert.equal(yourEventLabel('march', WEDDING_KIND), 'Wedding March', 'the item has no readable label');
  assert.equal(detailsItemHref('E', 'march'), '/dashboard/E/launch?tool=details&item=march');
  // An old Guest list link lands on it.
  assert.match(stripComments(PAGE), /if \(search\.gview === 'walk' \|\| search\.view === 'march'\) \{\s*redirect\(detailsItemHref\(eventId, 'march'\)\);/);
  assert.ok(!rosterDoors({ eventId: 'E', view: 'list', finished: false, hasJoinLink: true }).tabs.some((d) => /walk|march/i.test(d.key)));
});

test('the walking order is laid out in the three parts, never a whole page dropped in', () => {
  // LEFT the sections and lines · MIDDLE the aisle · RIGHT the picked line's controls
  // (DECISION_LOG "A TOOL MOVED INTO THE MAKER IS REBUILT INTO THE THREE PARTS").
  for (const part of ['MarchPieces', 'MarchAisleFocus', 'MarchControls']) {
    assert.match(MARCH_UI, new RegExp(`export function ${part}\\(`), `${part} is gone`);
  }
  // The Guest list no longer draws it, and the Maker draws the shipped panel once
  // (a picked SECTION shows its own slice of it).
  assert.doesNotMatch(stripComments(PAGE), /<EntourageOrderPanel/, 'the Guest list draws the march again');
  assert.equal((LOAD.match(/<EntourageOrderPanel/g) ?? []).length, 1);
  assert.match(MARCH_UI, /\[data-march-section\]:not\(\[data-march-section="\$\{key\}"\]\)\{display:none\}/);
});

test('⚖ a move keeps you where you made it', () => {
  /*
    The actions return a verdict and the Maker refreshes in place
    (`makerSave` → one refresh) — there is no navigation, so no way out and no
    scroll lost ("we need to always scroll back down").
  */
  for (const file of ['entourage-order-actions.ts', 'march-actions.ts']) {
    const code = stripComments(
      readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', file), 'utf8'),
    );
    assert.doesNotMatch(code, /\bredirect\s*\(/, `${file} navigates away from the view the move was made in`);
  }
  assert.match(MARCH_UI, /makerSave\(send, requestMakerRefresh\)/);
});

test("⚖ the owner's word is the ONLY word the couple sees", () => {
  /*
    Owner 2026-09-20 named it: "[Wedding March]". The Details item and the
    panel's own heading both say it; "Walking order" is never the name.
  */
  assert.equal(yourEventLabel('march', WEDDING_KIND), 'Wedding March');
  const copy = stripComments(PANEL);
  assert.match(copy, /Wedding March/, "the panel heading does not use the owner's word");
  for (const [what, src] of [['the panel', copy], ['the Details march', MARCH_UI]] as const) {
    assert.ok(!/>\s*Walking order/.test(src), `${what} still titles it "Walking order"`);
  }
});

test('🔑 a celebration with no processional is not offered one', () => {
  /*
    DERIVED from the event's own role set, never from a list of event types, so
    a new profile answers correctly the day it is added.
  */
  assert.ok(yourEventItems(WEDDING_KIND).includes('march'), 'a wedding lost its Wedding March');
  assert.ok(!yourEventItems(BIRTHDAY_KIND).includes('march'), 'the march shows on every event type');
  // ⚖ And never back in the List · Mind map switcher (owner 2026-09-21: "wedding march is repeated?").
  const switcherCode = stripComments(SWITCHER);
  assert.ok(
    !/Wedding March/.test(switcherCode) && !/key: 'walk'/.test(switcherCode),
    'Wedding March is back in the List · Mind map switcher',
  );
});
