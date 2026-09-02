import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activeRailKey, railMatchRows } from './rail-active';
import type { RailMatchRow } from './rail-active';
import { railToolsSignedIn } from '@/lib/studio-rail';
import { addOnHref } from '@/lib/add-ons-catalog';
import { eventRailMatchRows } from '@/app/dashboard/[eventId]/_components/event-rail-match-rows';

/**
 * studio-rows-are-lit.test.ts — the Studio rows read as "you are here", and
 * exactly ONE row in the whole rail ever does.
 *
 * ─── THE DEBT THIS PAYS ──────────────────────────────────────────────────
 * From 2026-08-21 the Studio rows pointed at real in-app routes and were left
 * deliberately UNLIT, because the rail resolves in two components that cannot
 * see each other: `FrontDoorShell` (account rows + Studio) and
 * `EventRailContext` (the event menu). Run separately they double-light, and
 * two lit rows tell the reader they are in two places at once — not a smaller
 * bug than zero.
 *
 * 🔑 THE FIX IS ONE LIST AND ONE RESOLVER, SO THAT IS WHAT THIS ASSERTS —
 * against the REAL builders, never a copy of them. A first cut of the sibling
 * rail guard declared its own row list, and a mutation deleting `exact: true`
 * from the real one passed everything. Testing the primitive is not testing
 * the caller.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL = join(HERE, 'front-door-shell.tsx');
const RAIL_CTX = join(
  HERE, '..', '..', 'dashboard', '[eventId]', '_components', 'event-rail-context.tsx',
);
const LAYOUT = join(HERE, '..', '..', 'dashboard', '[eventId]', 'layout.tsx');

/** Strip comments — this change QUOTES the strings it removed, and a raw-source
 *  guard would report the defect it just fixed. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n');
}

const EVENT_ID = 'S89E-TESTEVENT';
const BASE = `/dashboard/${EVENT_ID}`;

/** The real Studio rows for somebody with exactly one organiser event. */
function studioRows(): RailMatchRow[] {
  return railToolsSignedIn({ eventId: EVENT_ID, count: 1, profile: null })
    .filter((t) => t.href !== '/dashboard')
    .map((t) => ({ key: t.key, href: t.href }));
}

/** The real event-menu rows, from the builder the layout calls. */
function eventRows(): RailMatchRow[] {
  return eventRailMatchRows({
    eventId: EVENT_ID,
    websiteEnabled: true,
    monogramEnabled: true,
    slug: 'test-event',
    guestCount: 10,
  });
}

/** The WHOLE rail, exactly as `FrontDoorShell` composes it inside an event. */
function wholeRail(): RailMatchRow[] {
  return [
    ...railMatchRows({ signedIn: true, hasShop: false, isAdmin: false }),
    ...studioRows(),
    ...eventRows(),
  ];
}

test('the two halves really do overlap — the premise, measured, not assumed', () => {
  const studio = studioRows();
  const events = eventRows();
  assert.ok(studio.length >= 5, `only ${studio.length} Studio rows — the builder returned a stub.`);
  assert.ok(events.length >= 5, `only ${events.length} event rows — the builder returned a stub.`);

  /*
    If this ever drops to zero the rest of this file is vacuous: there would be
    nothing for one resolver to arbitrate and every assertion below would pass
    for a reason unrelated to what it claims to test. Measured 2026-08-23: two
    Studio URLs are also claimed by an event row.
  */
  const contested = studio.filter((s) =>
    events.some((e) => activeRailKey([e], s.href) !== null),
  );
  assert.ok(
    contested.length > 0,
    'no Studio URL is claimed by an event row — this whole guard is vacuous, ' +
      'because there is nothing left for one resolver to settle.',
  );
});

test('every Studio row lights ITSELF on its own page, and nothing else does', () => {
  const rail = wholeRail();
  for (const row of studioRows()) {
    assert.equal(
      activeRailKey(rail, row.href),
      row.key,
      `${row.href} must light "${row.key}" — a Studio row dark on its own page ` +
        'is the debt this closes; a DIFFERENT row lit there is the double-light it replaced.',
    );
  }
});

test('the three measured overlaps resolve the way a person would read them', () => {
  const rail = wholeRail();
  /*
    THE COLLISION SET, ENUMERATED. These are the only URLs where a Studio row
    and an event row both match, and each is settled by the shipped specificity
    rule rather than by a special case:
  */
  // The 3D plan is its own page. Neither row is exact-vs-prefix here — both
  // claim by prefix — so length settles it, and 3D Plan's href is longer.
  assert.equal(activeRailKey(rail, `${BASE}/seating/lab`), 'pa3d');
  // Seat plan still owns the family it claims.
  assert.equal(activeRailKey(rail, `${BASE}/seating`), 'seat');
  /*
    THE PAIR THAT FORCED "EXACT BEATS PREFIX" — RE-MEASURED 2026-09-02 (EH3).

    It used to be `pawebsite` (href `/website`) against the event menu's
    "Launch" row, which claimed that whole family by prefix from the LONGER href
    `/website/editor`. On length alone Launch lit both, leaving the Studio row
    dark on the page it opens, and "exact beats prefix" is what settled it.

    🔤 THE EVENT-MENU ROW HAS LEFT THE FAMILY. It is now "Event Hub" → `/launch`
    with `matchPrefix` narrowed to match, because the three names one place wore
    (Launch · Services · Editorial) collapsed into one word pointed at the
    controller. So `/website/*` is no longer contested at all: the Studio row
    owns the website family outright, which is the answer a person reads — on
    the editor you are inside the website, and the row that opens the website is
    the one that should be lit.

    ⚠ THE SPECIFICITY RULE IS NOT WHAT CHANGED, and this is why the two lines
    below were REPOINTED rather than deleted. `exact` is still the first key —
    `/website` still resolves by it — and deleting the pair would leave that
    rule with nothing measuring it.

    ⭐ RE-MEASURED AGAIN 2026-09-02 (EH6), AND THE PAIR IS NOW A SINGLE ROW.
    The owner's one-door ruling pointed the Studio row at the controller the
    menu row already opened — same word, same page — so the two would have TIED
    on `/launch`, and a tie is broken by list position. Rather than let
    composition order decide, the Studio group's duplicate is dropped inside an
    event and the menu row inherits the `/website` family through `matchPrefix`.

    🔑 SO THE WEBSITE FAMILY IS STILL LIT — by 'launch' now, not 'pawebsite'.
    That is the whole visible change: one row, one word, every page still
    claimed. The three lines below were REPOINTED rather than deleted for the
    same reason as last time — `exact` is still the first key and deleting them
    would leave that rule with nothing measuring it.
  */
  assert.equal(activeRailKey(rail, `${BASE}/website`), 'launch');
  assert.equal(activeRailKey(rail, `${BASE}/website/editor`), 'launch');
  assert.equal(activeRailKey(rail, `${BASE}/website/anything-else`), 'launch');
  // And the same row lights on the controller, which is its href.
  assert.equal(activeRailKey(rail, `${BASE}/launch`), 'launch');

  /*
    ⛔ AND NO SECOND ROW CLAIMS THE CONTROLLER. This is the assertion that
    fails if somebody restores the Studio duplicate: the tie would return, and
    with it a rail that answers "you are here" by accident of list order.
  */
  const claimants = rail.filter((r) => activeRailKey([r], `${BASE}/launch`) !== null);
  assert.deepEqual(
    claimants.map((r) => r.key),
    ['launch'],
    'more than one rail row opens the Event Hub — one door means one row',
  );
});

test('ONE DOOR: the Studio row and the event-menu row open the same page', () => {
  /*
    Owner ruling 2026-09-02, verbatim: *"i look at the roles of each. if it is
    the same then adjust. Like in papic. when they enter an event, the menu of
    papic description page becomes the control center of papic. i think that
    should be the same for events hub."*

    Both rows wear the word "Event Hub". Before this they went to two pages —
    `/website` and `/launch` — which is one word offered twice, flagged for the
    owner in EH3 rather than guessed at. This asserts the ruling: same word,
    same destination.

    🔑 ASKED OF THE REAL BUILDERS. The Studio row's href comes from
    `addOnHref('landing-page')` through `railToolsSignedIn`, and the menu row's
    from `buildCustomerNavGroups` — so repointing either one alone fails here.
  */
  const menuHub = eventRows().find((r) => r.key === 'launch');
  assert.ok(menuHub, 'the event menu lost its Event Hub row entirely');
  assert.equal(
    addOnHref('landing-page', EVENT_ID),
    menuHub!.href,
    'the product card and the menu slot are two doors again — the ruling was one',
  );
  assert.equal(menuHub!.href, `${BASE}/launch`, 'and the one door is the controller');

  // The rail's Studio group must not carry the duplicate back. Outside an event
  // it SHOULD still be there — there is no menu row to duplicate, and it is the
  // product's only door.
  assert.equal(
    studioRows().find((r) => r.key === 'pawebsite'),
    undefined,
    'the Studio rail carries the website row again, beside a menu row for the same page',
  );
  assert.ok(
    railToolsSignedIn({ eventId: null, count: 0, profile: null }).some((t) => t.key === 'pawebsite'),
    'the website row vanished with NO event too — that drops the product from the rail entirely',
  );
});

test('exactly one row is lit anywhere on the rail — never two, never none by accident', () => {
  const rail = wholeRail();
  const everyDestination = [...new Set(rail.map((r) => r.href.split('?')[0]!))];
  for (const url of everyDestination) {
    const winner = activeRailKey(rail, url);
    assert.notEqual(winner, null, `${url} is a row's own destination and lit NOTHING.`);
    const claimants = rail.filter((r) => activeRailKey([r], url) !== null);
    assert.ok(
      claimants.length >= 1,
      `${url} matched no row at all, yet the resolver returned ${winner}.`,
    );
    // The point: however many CLAIM it, the resolver returns ONE key.
    assert.equal(typeof winner, 'string');
  }
});

test('a row pointing at the picker is not a destination', () => {
  /*
    🪤 WITH TWO OR MORE ORGANISER EVENTS EVERY STUDIO HREF COLLAPSES TO
    `/dashboard` — the board that IS the picker. Ranked, eight rows would all
    match the events page and tie with "Your events"; the winner would then
    depend on array order, which is not a decision anybody made.
  */
  // ⚠ THE PICKER CASE IS eventId = null. `railToolsSignedIn` points a row at
  // THIS event whenever it has one, whatever the count — the count only decides
  // what to do when no single event is known. Getting this wrong is how a test
  // asserts a branch it never reaches.
  const many = railToolsSignedIn({ eventId: null, count: 2, profile: null });
  assert.ok(
    many.some((t) => t.href === '/dashboard'),
    'the picker case no longer produces /dashboard hrefs — re-read this guard.',
  );
  const rail = [
    ...railMatchRows({ signedIn: true, hasShop: false, isAdmin: false }),
    ...many.filter((t) => t.href !== '/dashboard').map((t) => ({ key: t.key, href: t.href })),
  ];
  assert.equal(
    activeRailKey(rail, '/dashboard'),
    'events',
    'the events board must light "Your events", never a Studio row aimed at the picker.',
  );
});

test('there is ONE resolver in the rail, and the child does not keep a second', () => {
  /*
    The mechanism, not the outcome. Both files can be correct today and one
    `activeRailKey(` added back to the child restores the second answer with
    nothing thrown — it would simply light a different row than the shell.
  */
  const shell = code(SHELL);
  const child = code(RAIL_CTX);
  const layout = code(LAYOUT);

  assert.equal(
    (shell.match(/activeRailKey\(/g) || []).length,
    1,
    'the shell must resolve exactly once, over the union.',
  );
  assert.ok(
    !/activeRailKey\(/.test(child),
    'the event rail context resolved its own key again — that is the double-light returning.',
  );
  assert.match(
    child,
    /useRailActiveKey\(\)/,
    'the event rail context must READ the one published key.',
  );
  assert.match(
    shell,
    /RailActiveKeyProvider/,
    'the shell must publish the resolved key to whatever the context group draws.',
  );

  /*
    🪤 THE BEHAVIOUR TESTS ABOVE COMPOSE THE RAIL THEMSELVES, SO THEY CANNOT
    SEE THE SHELL STOP COMPOSING IT. Measured: deleting the Studio rows from
    the shell's own union, and deleting the on-state from the Studio rows,
    BOTH left this file green — a guard decorative for the two things it
    exists to protect. Testing the primitive is not testing the caller, which
    the sibling rail guard already had to learn once.

    So the composition is read out of the shell's real source. The block is
    sliced rather than substring-matched, because `...tools` appears elsewhere
    in this file and a file-level match would be satisfied by the wrong line.
  */
  const unionStart = shell.indexOf('const matchRows = [');
  assert.ok(unionStart >= 0, 'the shell no longer declares one match list.');
  const union = shell.slice(unionStart, shell.indexOf('];', unionStart));
  assert.match(union, /railMatchRows\(/, 'the union lost the account rows.');
  assert.match(
    union,
    /\.\.\.tools\b/,
    'the union lost the Studio rows — they go dark again, which is the debt this closes.',
  );
  assert.match(
    union,
    /\.\.\.\(contextMatchRows/,
    'the union lost the event menu — the shell is arbitrating against half the rail.',
  );

  /*
    And the Studio rows must actually WEAR the state. A row can win the
    resolver and still render no `data-on`, in which case nothing on screen
    changes and every behaviour test above still passes.
  */
  const rowsStart = shell.indexOf('{tools.map((t) => (');
  assert.ok(rowsStart >= 0, 'the shell no longer renders the Studio rows from `tools`.');
  const rowsJsx = shell.slice(rowsStart, shell.indexOf('))}', rowsStart));
  assert.match(
    rowsJsx,
    /\{\.\.\.rowProps\(t\.key\)\}/,
    'the Studio rows render without data-on / aria-current — they resolve correctly ' +
      'and look exactly as dark as before.',
  );

  /*
    And the layout must hand the SHELL the same rows it hands the MENU. Two
    separately-built lists would let the shell arbitrate against a menu that is
    not quite the one on screen — the gap this replaces, wearing a fix's
    clothes.
  */
  assert.match(layout, /contextMatchRows=\{eventRailMatchRows\(eventRailInputs\)\}/);
  assert.match(layout, /<EventRailContext\s+\{\.\.\.eventRailInputs\}/);
});
