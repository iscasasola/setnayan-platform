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
 *  · The order belongs to the LINE. Since 2026-10-01 a line is a WALK — its
 *    people share one `march_walks.walk_no` (owner: "the wedding march is a
 *    different entity").
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
    row({ guest_id: 'ninong', first_name: 'Ramon', last_name: 'Zamora', role: 'principal_sponsor_ninong', march: { walk_no: 1, place_in_walk: 0 } }),
    row({ guest_id: 'ninang', first_name: 'Rosa', last_name: 'Zamora', role: 'principal_sponsor_ninang', march: { walk_no: 1, place_in_walk: 1 } }),
    row({ guest_id: 'solo', first_name: 'Ana', last_name: 'Abad', role: 'principal_sponsor_ninang', march: null }),
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
    Both people sharing ONE walk (`march_walks`, owner 2026-10-01) is what
    makes the pair move as one.
  */
  const rows = pairedFixture().map((r) =>
    r.guest_id === 'solo' ? { ...r, march: { walk_no: 0 } } : r,
  );
  const lines = entourageLines(rows, 'principal_sponsors');
  assert.equal(lines[0]?.[0]?.id ?? lines[0]?.[1]?.id, 'solo', 'the hand-placed single is not first');
  const second = lines[1]!;
  assert.ok(second[0] && second[1], 'the pair came apart when it was ordered');
});

test('an unplaced line sorts after every placed one, and never as position zero', () => {
  // `walk ?? 0` would rank everyone untouched ABOVE the line the couple
  // deliberately placed. Here the pair has no walk yet; the solo one does.
  const rows = pairedFixture().map((r) =>
    r.guest_id === 'solo' ? { ...r, march: { walk_no: 5 } } : { ...r, march: null },
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
    row({ guest_id: 'maid', first_name: 'Mia', last_name: 'Cruz', role: 'maid_of_honor', march: { walk_no: 0 } }),
    row({ guest_id: 'bearer', first_name: 'Bo', last_name: 'Cruz', role: 'ring_bearer', march: { walk_no: 0 } }),
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
const COLUMNS_SRC = readFileSync(join(process.cwd(), 'lib', 'roster-columns.ts'), 'utf8');

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
  // ⤷ 2026-09-30, the full-width list: after ☐ and Name the header draws one
  // cell per SLOT, and every column stays one a slot can show — so "removes no
  // column" is now: the whole vocabulary is still offered, and the header draws
  // a cell for every slot.
  assert.match(head, /desk\.columns\.map\(/, 'the header no longer draws a cell per slot');
  const vocab = /export const ROSTER_COLUMNS = \[([\s\S]*?)\] as const/.exec(COLUMNS_SRC)?.[1] ?? '';
  const columns = (vocab.match(/'[a-z]+'/g) ?? []).length;
  assert.ok(columns >= 8, `the roster is down to ${columns} columns`);
  for (const c of ['rsvp', 'seat', 'contact']) assert.ok(vocab.includes(`'${c}'`), `the ${c} column is gone`);

  // Rows are emitted per GUEST, never per pair: no mount is conditioned on a
  // partner, and nothing skips a row because somebody else already showed it.
  assert.ok(
    !/pair_with_guest_id[^\n]*\?[^\n]*null\s*:\s*<DesktopRow/.test(ROSTER),
    'a roster row is now conditional on pairing',
  );
  /* ⚖ SUPERSEDED 2026-09-30 (DECISION_LOG "WALKING TOGETHER IS NOT BEING A
     COUPLE"): the roster used to show "walks with <name>" + Unpair under each
     paired guest. "Walks with" now lives ONLY in the Maker's Wedding March —
     no row shows it and no row edits it. Asserted on the comment-stripped
     source so this note cannot convict itself. */
  const code = stripComments(ROSTER);
  assert.doesNotMatch(code, /<PartnerLine[\s/>]|walks with/, 'a Guest list row shows "walks with" again');
  assert.doesNotMatch(code, /\b(?:unpairGuestAction|pairSelectedGuests)\b/, 'a Guest list row edits a pairing again');
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

/* 🚶 2026-10-06: the ↑↓ panel and its drag layer were retired; the Wedding March
   is the drag maker. The PROPERTIES these held stay held — on the maker. */
const MAKER = readFileSync(
  join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components', 'details-march.tsx'),
  'utf8',
);
const MARCH_LOAD = readFileSync(join(process.cwd(), 'lib', 'march-sections.ts'), 'utf8');

test('🔑 the arranging is reachable WITHOUT knowing to filter first — every section is drawn', () => {
  /*
    It was built and it was hidden: the panel rendered only under a role filter,
    so on the default view the one place to arrange the processional did not
    exist. The maker draws EVERY section the march has — nothing filters it.
  */
  assert.match(stripComments(MARCH_LOAD), /return groups\s*\.map\(\(g, gi\) => \(\{/, 'the march maker draws only some sections');
  // The one filter drops a section left EMPTY (everyone in it is drawn elsewhere) — never a role or a view.
  assert.deepEqual([...stripComments(MARCH_LOAD).matchAll(/\.filter\(\(sec\) => ([^)]*)\)/g)].map((m) => m[1]), ['sec.rows.length > 0']);
  assert.match(stripComments(MAKER), /\{shown\.map\(\(sec\) => \{/, 'the maker no longer draws every section it is handed');
  assert.doesNotMatch(stripComments(MAKER), /shown\.filter\(/, 'the maker filters the sections it is handed');
});

test('the maker heads each section with its printed NAME, not a raw key', () => {
  // A first draft rendered `key.replace(/_/g, ' ')` — a key, not a heading.
  // The heading is `buildEntourage`'s (`groupHeading`, the couple's own role words).
  assert.match(stripComments(MARCH_LOAD), /label: g\.label,/, 'the march section is not the printed heading');
  assert.match(stripComments(MAKER), /\{sec\.label\}/, 'the maker prints something other than the heading');
  assert.doesNotMatch(stripComments(MAKER), /\.replace\(\/_\/g/, 'the maker prints a raw key');
});

test('⚖ the drag works on a phone AND without a pointer — and no buttons are drawn for it (owner 2026-10-06)', () => {
  /*
    The arrows were the always-available path. The owner retired them for this
    item ("no need to the toolbar. we can just drag the names"), so the paths
    they guaranteed must live in the drag itself: a long-press lifts on touch
    (a plain swipe still scrolls), and the keyboard can do every drop.
  */
  const code = stripComments(MAKER);
  assert.match(code, /const LONG_PRESS_MS = 250;/, 'touch no longer lifts on a long-press');
  assert.match(code, /pointerType !== 'mouse'/, 'touch and mouse are no longer told apart');
  assert.match(code, /touch-pan-y/, 'a name blocks the page scroll before it is lifted');
  assert.match(code, /onKeyDown=\{onKeyDown\}/, 'the keyboard path is not mounted');
  assert.doesNotMatch(code, /ArrowUp aria-hidden|<button[^>]*>\s*Walk (earlier|later)/, 'the ↑↓ buttons are back');
});

test('🚶 a whole SECTION moves by dragging its header — never the groom’s or the bride’s side (controller 2026-10-06)', () => {
  /*
    Retiring the ↑↓ panel removed the only way to reorder sections; the drag
    maker carries it now, through the SAME shipped writers.
  */
  const code = stripComments(MAKER);
  assert.match(code, /case 'section':\s*return moveEntourageSection\(eventId, step\.section, step\.direction\);/, 'a header drag does not reach moveEntourageSection');
  assert.match(code, /case 'sections-default':\s*return resetEntourageSections\(eventId\);/, 'the usual order cannot be put back');
  assert.match(code, /const fixed = isMarchOnlyGroup\(sec\.key\);/);
  assert.match(code, /data-march-drag=\{fixed \? undefined : `section\|\$\{sec\.key\}`\}/, 'a header is not draggable, or the couple’s sides are');
  // One line, shown only when the order was changed — not a toolbar.
  assert.match(code, /\{sectionsMoved\(shownPrinted\) \? \(/);
  const actions = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', 'march-actions.ts'), 'utf8'));
  assert.match(actions, /export async function moveEntourageSection\(/);
  assert.match(actions, /export async function resetEntourageSections\(/);
});

test('a held name answers the keyboard, and says what it did', () => {
  // 🔑 A handle that only drags is a control half the room cannot use — and a
  // reorder nobody can hear is indistinguishable from a dead one.
  const code = stripComments(MAKER);
  for (const [what, re] of [
    ['grab with Space', /e\.key === ' '/],
    ['move with arrows', /e\.key === 'ArrowUp' \|\| e\.key === 'ArrowDown'/],
    ['cancel with Escape', /e\.key === 'Escape'/],
    ['announce its state', /aria-pressed=\{carried\?\.key === p\.id\}/],
    ['announce the move', /aria-live="polite"/],
  ] as const) {
    assert.match(code, re, `the march maker cannot ${what}`);
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

test('🚶 the Wedding March is ONE item whose page is the drag maker — never a list of its names (owner 2026-10-06)', () => {
  /*
    Owner: "i don't need this to expand the names. the wedding march should just
    be the drag drop … wedding march maker." The three-part list (lines as
    navigator pieces, the aisle, a line's ↑↓ controls) is retired for this item.
  */
  assert.match(MARCH_UI, /export function MarchMaker\(/, 'the march maker is gone');
  for (const part of ['MarchPieces', 'MarchAisleFocus', 'MarchControls']) {
    assert.doesNotMatch(MARCH_UI, new RegExp(`export function ${part}\\(`), `${part} is back — the item expands into its lines again`);
  }
  const PARTS = stripComments(readFileSync(join(LAUNCH, 'details-your-event-parts.tsx'), 'utf8'));
  assert.doesNotMatch(PARTS, /march:\s*<MarchPieces|\bMarchPieces\b/, 'the navigator lists the march’s lines again');
  assert.match(PARTS, /march: \(\s*<MarchMaker\s+eventId=\{eventId\}\s+sections=\{input\.march\.sections\}/, 'the item’s page is not the maker');
  // No toolbar, no buttons, no ↑↓ in the maker — a drag of a name is the only edit.
  // (The keyboard's ↑ / ↓ keys move a HELD name — they are keys, not drawn arrows.)
  assert.doesNotMatch(MARCH_UI, /<ArrowUp|<ArrowDown|Walk earlier|Walk later|PickMenu|<button[^>]*>\s*(Move|Swap|Pair|Add)\b/);
  // The Guest list does not draw the march, and neither does the Maker any more (its arrows are retired).
  assert.doesNotMatch(stripComments(PAGE), /<EntourageOrderPanel/, 'the Guest list draws the march again');
  assert.equal((LOAD.match(/<EntourageOrderPanel/g) ?? []).length, 0, 'the ↑↓ panel is back in the Maker');
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
  assert.match(MARCH_UI, /await makerSave\(\s*\(\) => \(lab \? Promise\.resolve\(LAB_SAVED\) : callStep\(eventId, step\)/);
  assert.match(MARCH_UI, /lab \? LAB_NO_RENDER : requestMakerRefresh,\s*\);/);
});

test("⚖ the owner's word is the ONLY word the couple sees", () => {
  /*
    Owner 2026-09-20 named it: "[Wedding March]". The Details item and the
    panel's own heading both say it; "Walking order" is never the name.
  */
  assert.equal(yourEventLabel('march', WEDDING_KIND), 'Wedding March');
  // 🚶 Since 2026-10-06 the maker is the march's only screen; it names itself in the owner's word.
  assert.match(MARCH_UI, /Wedding March/, "the march maker does not use the owner's word");
  assert.ok(!/>\s*Walking order/.test(MARCH_UI), 'the march maker titles it "Walking order"');
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
