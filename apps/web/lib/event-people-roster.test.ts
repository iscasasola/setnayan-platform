/**
 * event-people-roster.test — W5-C item 1.
 *
 * Two things are worth pinning here and nothing else is:
 *   · WHO SEES WHICH GROUP, because every row is a door into somebody else's
 *     list, and a row that refuses the person it is shown to is the same defect
 *     this session fixed on the owner ribbon.
 *   · AN UNREAD COUNT IS NOT ZERO, all the way to the words on screen. On a
 *     roster, "no guests yet" and "we couldn't count them" send a couple to
 *     two different places.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildPeopleGroups,
  groupCountLabel,
  rosterHeadline,
  rosterTotal,
  visibleGroupKeys,
  type PeopleViewer,
} from './event-people-roster';
import { COORDINATOR_AREAS, resolveAreaLevel, type ModeratorPermissions } from './delegate-areas';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const EVENT = 'event-alpha';

const COUPLE: PeopleViewer = { isCouple: true, delegatePermissions: null };

const coordinator: ModeratorPermissions = {
  edit_all: true,
  checkout: false,
  invite_hosts: false,
  remove_hosts: false,
  areas: COORDINATOR_AREAS,
};

/** The live production row, copied from `event_moderators` 2026-08-24. */
const LIVE_PLANNER: ModeratorPermissions = {
  edit_all: false,
  checkout: false,
  invite_hosts: false,
  remove_hosts: false,
  areas: { seat_plan: 'view' },
};

// ── WHO SEES WHAT ──────────────────────────────────────────────────────────

test('the couple see all five groups', () => {
  assert.deepEqual(
    [...visibleGroupKeys(COUPLE)].sort(),
    ['guests', 'helpers', 'hosts', 'photo_crew', 'suppliers'],
  );
});

test('a coordinator sees the groups their grant actually opens — and no others', () => {
  const keys = visibleGroupKeys({ isCouple: false, delegatePermissions: coordinator });
  assert.ok(keys.has('hosts'), 'every host can see who else is helping');
  assert.ok(keys.has('guests'), 'the default coordinator grant is guest_list: edit');
  assert.ok(keys.has('suppliers'), 'the default coordinator grant is vendors: edit');
  assert.ok(!keys.has('helpers'), '/manpower redirects a delegate — listing it is a dead end');
  assert.ok(!keys.has('photo_crew'), '/studio/papic/crew redirects a delegate');
});

test('the live external planner sees only the line her host actually granted', () => {
  // ⚠ WRITTEN THREE TIMES, AND THE SECOND VERSION WAS WRONG ON PURPOSE.
  // Rev 1 asserted she sees only "hosts" and failed. Rev 2 changed the
  // assertion to match the code and recorded the reason as "that is the
  // DECISION, not a defect", because `moderator_area_level` ended
  //   WHEN p_area IN ('guest_list','seat_plan','schedule','vendors','invitations')
  //     THEN CASE WHEN edit_all THEN 'edit' ELSE 'view' END
  // so an unnamed area resolved to 'view'.
  //
  // 🔑 IT WAS NEVER A DECISION — IT WAS A LEGACY FALLBACK NOBODY HAD RULED ON,
  // and a test comment is not where a permission gets decided. The owner ruled
  // on 2026-08-24, asked directly who may see an event's guest list: "no. only
  // the owner of the event and coordinator (by request)." This planner's host
  // granted her the seat plan and nothing else, so the guest list is not hers.
  // The fallback now applies only to rows carrying no `areas` map at all.
  const keys = visibleGroupKeys({ isCouple: false, delegatePermissions: LIVE_PLANNER });
  assert.deepEqual([...keys].sort(), ['hosts']);
  assert.ok(!keys.has('guests'), 'her host granted seat_plan, never the guest list');
  assert.ok(!keys.has('suppliers'), 'nor the suppliers');
  // The two couple-only routes stay closed to her whatever her grant says.
  assert.ok(!keys.has('helpers'));
  assert.ok(!keys.has('photo_crew'));
});

test('an area a host granted still opens, so the narrowing is not a blanket no', () => {
  // The false-positive direction: narrowing must not close a grant the host
  // DID make. `seat_plan` has no roster group of its own, so this asserts the
  // resolver rather than the roster.
  assert.equal(resolveAreaLevel(LIVE_PLANNER, 'seat_plan'), 'view');
  assert.equal(resolveAreaLevel(LIVE_PLANNER, 'guest_list'), null);
  // And a legacy row — no `areas` map — keeps the fallback it has always had.
  // This is the couple's own host row; stripping it locks a groom out.
  const legacyHost: ModeratorPermissions = {
    edit_all: true,
    checkout: true,
    invite_hosts: true,
    remove_hosts: true,
  };
  assert.equal(resolveAreaLevel(legacyHost, 'guest_list'), 'edit');
});

test('somebody with no membership at all sees nothing', () => {
  assert.deepEqual([...visibleGroupKeys({ isCouple: false, delegatePermissions: null })], []);
});

test('the roster never invents a permission for the two couple-only routes', () => {
  // Every shape of delegate, including the fail-open-tail one, must be refused
  // helpers and photo_crew — those routes have no delegate area to consult, so
  // admitting them here would be inventing a rule rather than mirroring one.
  const shapes: ModeratorPermissions[] = [
    coordinator,
    LIVE_PLANNER,
    { edit_all: true, checkout: true, invite_hosts: true, remove_hosts: true },
    { edit_all: true, checkout: true, invite_hosts: true, remove_hosts: true, areas: { helpers: 'edit' } as never },
  ];
  for (const perms of shapes) {
    const keys = visibleGroupKeys({ isCouple: false, delegatePermissions: perms });
    assert.ok(!keys.has('helpers'), 'a delegate was offered the hired-help list');
    assert.ok(!keys.has('photo_crew'), 'a delegate was offered the camera crew list');
  }
});

// ── AN UNREAD COUNT IS NOT ZERO ────────────────────────────────────────────

test('null and 0 read as different sentences', () => {
  assert.equal(groupCountLabel(0, 'guest', 'guests'), 'No guests yet');
  assert.notEqual(groupCountLabel(null, 'guest', 'guests'), 'No guests yet');
  assert.ok(
    !/\b0\b|\bno\b/i.test(groupCountLabel(null, 'guest', 'guests')),
    'a failed read is being reported as an empty list',
  );
  assert.equal(groupCountLabel(1, 'guest', 'guests'), '1 guest');
  assert.equal(groupCountLabel(2, 'guest', 'guests'), '2 guests');
});

test('the total excludes what it could not read, and SAYS it did', () => {
  const groups = buildPeopleGroups(EVENT, COUPLE, {
    hosts: 2,
    guests: null,
    suppliers: 3,
    helpers: 0,
    photo_crew: 1,
  });
  assert.deepEqual(rosterTotal(groups), { total: 6, unmeasured: 1 });
  const head = rosterHeadline(groups);
  assert.match(head, /6 people so far/);
  assert.match(
    head,
    /couldn’t count/,
    'the headline printed a confident total while a whole group was unread',
  );
});

test('a clean read gets a clean headline — no hedging that was not earned', () => {
  const groups = buildPeopleGroups(EVENT, COUPLE, {
    hosts: 2, guests: 40, suppliers: 3, helpers: 0, photo_crew: 0,
  });
  assert.equal(rosterHeadline(groups), '45 people so far');
});

test('everything unread says so instead of printing zero people', () => {
  const groups = buildPeopleGroups(EVENT, COUPLE, {});
  assert.ok(
    !/^0 people/.test(rosterHeadline(groups)),
    'five failed reads rendered as an event with nobody in it',
  );
  assert.match(rosterHeadline(groups), /nobody has been removed/);
});

test('a viewer with no groups is told so, not shown an empty roster', () => {
  const groups = buildPeopleGroups(EVENT, { isCouple: false, delegatePermissions: null }, {});
  assert.equal(groups.length, 0);
  assert.match(rosterHeadline(groups), /shared with you/);
});

// ── THE SCREEN ITSELF ──────────────────────────────────────────────────────

const PAGE = 'app/dashboard/[eventId]/people/page.tsx';
const pageSrc = readFileSync(join(ROOT, PAGE), 'utf8');

test('every group links into the route that already owns it — nothing is rebuilt', () => {
  const groups = buildPeopleGroups(EVENT, COUPLE, {});
  assert.deepEqual(
    groups.map((g) => g.href),
    [
      `/dashboard/${EVENT}/hosts`,
      `/dashboard/${EVENT}/guests`,
      `/dashboard/${EVENT}/vendors`,
      `/dashboard/${EVENT}/manpower`,
      `/dashboard/${EVENT}/studio/papic/crew`,
    ],
  );
});

// ⚠ THE RULE IS UNCHANGED; ITS REASON WAS WRONG. This test was written on the
// belief that messaging the guests was an open owner question. It is not — the
// day-of announcement ships and is gated on the couple or a `schedule: 'edit'`
// delegate. The assertion stays because a SECOND composer here would be a
// second writer of the same row, which is the real defect it prevents.
test('⛔ NO SECOND COMPOSER — the announcement already has a home, and one writer', () => {
  const moduleSrc = readFileSync(join(ROOT, 'lib/event-people-roster.ts'), 'utf8');
  for (const src of [pageSrc, moduleSrc]) {
    // Match the SHAPES a messaging surface takes, not one spelling of one word.
    assert.ok(
      !/<form|action=\{|useState|broadcast|sendTo|recipients|message[A-Z]/.test(
        src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ''),
      ),
      'a compose, send or recipient surface appeared on the roster — the day-of ' +
        'announcement already has one composer, and a second writer of the same row is the defect',
    );
  }
});

test('the page only COUNTS what the viewer may open', () => {
  // The gate decides the queries, not just the markup: a count somebody may not
  // see is still a disclosure, and running the read anyway is how one leaks.
  const stripped = pageSrc.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  for (const key of ['hosts', 'guests', 'suppliers', 'helpers', 'photo_crew']) {
    assert.ok(
      stripped.includes(`shown.has('${key}')`),
      `the ${key} count runs without checking whether this viewer may see it`,
    );
  }
});

test('the suppliers count keeps a refusal instead of reusing the 0-on-error helper', () => {
  const stripped = pageSrc.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  assert.ok(
    !stripped.includes('getConfirmedVendorCount'),
    'the roster went back to the helper that returns 0 on a failed read — on this ' +
      'screen that says "you have booked nobody"',
  );
  assert.match(stripped, /counts\.suppliers = null;/);
});

test('the roster is reachable — a page ships with its doorway', () => {
  const hosts = readFileSync(join(ROOT, 'app/dashboard/[eventId]/hosts/page.tsx'), 'utf8');
  assert.match(hosts, /\/people`/, 'nothing links to the roster, so nobody can find it');
  const menu = readFileSync(join(ROOT, 'lib/customer-menu.ts'), 'utf8');
  assert.match(menu, /\$\{base\}\/people`/, 'the roster lights no menu item');
});


// ── THE ANNOUNCEMENT CHAIN, PINNED ─────────────────────────────────────────
//
// 🛑 WHY THIS IS IN THIS FILE. A claim in the roster's own docblock said
// messaging the guests was an open owner question. It was not — the feature
// ships. The correction is only as durable as the evidence for it, so the
// chain is asserted here rather than described.
//
// 🔑 AND IT HAS BROKEN BEFORE, IN THE EXACT PLACE THIS WATCHES. The loader's
// own header records it: the composer shipped "for months", the table was
// live, the privacy control was active — and NOTHING ON THE GUEST SITE EVER
// READ IT, so a coordinator could write "phones down, the ceremony is
// starting" and only the couple's dashboard would show it. A writer with no
// reader is invisible to every test that checks one end.

test('the day-of announcement runs end to end: composer → row → the Event Hub', () => {
  // 1 · THE COMPOSER writes the row.
  const composer = read('app/dashboard/[eventId]/_actions/day-of-broadcast.ts');
  assert.match(composer, /from\('coordinator_broadcasts'\)\s*\n?\s*\.insert\(/,
    'the day-of composer stopped writing the announcement row');

  // 2 · THE GUEST SIDE reads it. This is the half that was missing for months.
  const loaders = read('app/[slug]/_lib/loaders.ts');
  assert.match(loaders, /loadDayOfBroadcast/);
  assert.match(loaders, /from\('coordinator_broadcasts'\)/,
    'the guest-side reader stopped reading the announcement — the composer is writing to nobody');

  // 3 · AND IT IS MOUNTED. A loader nothing renders is the same absence with a
  // longer stack trace.
  const page = read('app/[slug]/page.tsx');
  assert.match(page, /loadDayOfBroadcast\(/, 'the Event Hub stopped loading the announcement');
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /<DayOfAnnouncement/, 'the announcement is loaded and never rendered');
});

test('an announcement is for the day, and is the latest one — not a feed', () => {
  const loaders = read('app/[slug]/_lib/loaders.ts');
  // Outside the live window it returns nothing, so a stale "we are running
  // late" cannot haunt the page for a month.
  assert.match(loaders, /if \(!isLive\) return null;/,
    'the announcement outlived the day — a stale one now sits on the page forever');
  // One, never a scrollback of operational chatter competing with the couple.
  assert.match(loaders, /\.limit\(1\)/);
});

test('only the couple or a schedule-edit delegate may write one', () => {
  // The question the roster docblock wrongly called open, answered in code:
  // a coordinator nobody promoted holds no schedule grant, so cannot send.
  const authority = read('lib/coordinator-broadcasts-server.ts');
  assert.match(authority, /member_type', 'couple'/);
  assert.match(
    authority,
    /resolveAreaLevel\(perms, 'schedule'\) === 'edit'/,
    'the broadcast authority stopped requiring a schedule-edit grant — anyone ' +
      'the event admits could now announce to the guests',
  );
});
