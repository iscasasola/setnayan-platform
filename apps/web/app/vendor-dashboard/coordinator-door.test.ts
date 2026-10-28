/**
 * coordinator-door.test.ts — 🗂 the coordinator's door into the events they run, and NOTHING wider.
 *
 * Owner, verbatim, 2026-10-28: *"for coordinators, since they have access to the whole event as well. we can add that
 * additional menu for them? to enter the event dashboard?"* → *"approved"* (DECISION_LOG "COORDINATORS GET A DOOR INTO
 * THE EVENTS THEY RUN"; prototype `prototypes/coordinator_door_2026-10-28/`).
 *
 * The properties (the rule itself — which seat is LIVE — is held in `lib/events-you-run.test.ts`):
 *   1 · the Events TAB is on the bar and the rail ONLY while `runsEvents` is true — for an owner and a helper alike —
 *       last, same word, same room; and `runsEvents` is the layout's read of LIVE seats, failing closed;
 *   2 · Today's "Events you run" is drawn only from that read and only when it has a row;
 *   3 · "Open their event" (and the Coordinator pill) on the customer card show only when THIS event is one they run;
 *   4 · the "Coordinating … · Back to your shop" line renders only for a viewer the event layout admitted through the
 *       coordinator's seat, and only after its shipped admission check;
 *   5 · NO NEW PERMISSION PATH: every door is the shipped `/dashboard/<id>` address, the read is the person's own
 *       session (no admin client), the live rule is the shipped window + the hosts' switch, the admission query is
 *       unchanged, and no server action was added for any of it.
 *
 * SABOTAGE (each seen red once, then restored — the PR body has the runs).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { NAV_SLOT_DEFAULTS } from '@/lib/nav-registry-defaults';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { VendorTeamRole } from '@/lib/vendor-team';
import { barItemsForShell } from '@/app/_components/nav/bottom-nav';
import { isStoreShellWebOnlyPath } from '@/lib/store-shell';
import { EVENTS_YOU_RUN_HREF } from '@/lib/events-you-run-words';
import { COORDINATOR_ON_AREAS } from '@/lib/people-with-access';
import { VENDOR_BOTTOM_NAV_ITEMS, VENDOR_EVENTS_TAB, vendorBarItems } from './_components/vendor-bottom-nav';
import { resolveVendorDestinations } from './_components/vendor-nav-destinations';

const VD = import.meta.dirname;
const WEB = join(VD, '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const DEFAULT_SLOTS: Record<string, NavSlotLite> = Object.fromEntries(
  NAV_SLOT_DEFAULTS.map((d): [string, NavSlotLite] => [
    d.key,
    { label: d.label, icon: { kind: 'lucide', lucideName: d.lucideName ?? 'Circle', customRef: null, customUrl: null }, isHidden: false },
  ]),
);

/* ══ 1 · the tab — only while they run an event ══════════════════════════════ */

test('1 · the Events tab is on the bar ONLY while runsEvents — owner and helper, web and app shell', () => {
  const roles: (VendorTeamRole | null)[] = ['owner', 'admin', 'agent', 'viewer', null];
  for (const role of roles) {
    for (const navSlots of [undefined, DEFAULT_SLOTS]) {
      for (const shell of [false, true]) {
        const without = barItemsForShell(vendorBarItems({ role, navSlots }), shell);
        const withIt = barItemsForShell(vendorBarItems({ role, navSlots, runsEvents: true }), shell);
        assert.ok(!without.some((i) => i.key === 'events'), `${role}: Events is on the bar of a supplier who runs nothing`);
        assert.equal(withIt.at(-1)?.key, 'events', `${role}: a coordinator's bar has no Events tab last`);
        assert.equal(withIt.at(-1)?.label, 'Events');
        assert.deepEqual(withIt.slice(0, -1).map((i) => i.key), without.map((i) => i.key), `${role}: the tab moved another`);
      }
    }
  }
  // The four stay the four — the fifth is never part of every supplier's bar.
  assert.equal(VENDOR_BOTTOM_NAV_ITEMS.length, 4);
  assert.ok(!VENDOR_BOTTOM_NAV_ITEMS.includes(VENDOR_EVENTS_TAB));
  assert.equal(isStoreShellWebOnlyPath(EVENTS_YOU_RUN_HREF), false, 'the Events room is refused in the iPhone app');
});

test('1 · the rail says the same: an Events row only while runsEvents, same word, same room', () => {
  for (const role of ['owner', 'viewer', null] as const) {
    for (const navSlots of [undefined, DEFAULT_SLOTS]) {
      const without = resolveVendorDestinations({ role, navSlots });
      const withIt = resolveVendorDestinations({ role, navSlots, runsEvents: true });
      assert.ok(!without.some((r) => r.key === 'events'), `${role}: the rail has Events for a supplier who runs nothing`);
      assert.equal(withIt.at(-1)?.label, 'Events');
      assert.equal(withIt.at(-1)?.href, VENDOR_EVENTS_TAB.href, 'the rail row and the tab open different rooms');
    }
  }
  // Both registries carry the slot, so an admin rename reaches both and a default is never missing.
  for (const key of ['vendor.bottom-nav.events', 'vendor.sidebar.events']) {
    const slot = NAV_SLOT_DEFAULTS.find((d) => d.key === key);
    assert.equal(slot?.label, 'Events', `${key} is not in the nav registry`);
    assert.equal(slot?.route, EVENTS_YOU_RUN_HREF);
  }
});

test('1 · the layout reads LIVE seats, fails closed, and tells the bar AND the rail', () => {
  const layout = src('app/vendor-dashboard/layout.tsx');
  assert.match(
    layout,
    /readEventsYouRun\(supabase, user\.id\)\s*\.then\(\(r\) => r\.events\.length > 0\)\s*\.catch\(\(\) => false\)/,
    'the tab must come from the live-seat read and HIDE on a refused read — never a dead tab',
  );
  assert.match(layout, /<VendorBottomNav[\s\S]*?runsEvents=\{runsEvents\}/, 'the bar is not told');
  assert.match(layout, /<VendorRailContext[\s\S]*?runsEvents=\{runsEvents\}/, 'the rail is not told');
  assert.match(src('app/vendor-dashboard/_components/vendor-rail-context.tsx'), /resolveVendorDestinations\(\{[\s\S]*?runsEvents,?[\s\S]*?\}\)/);
});

/* ══ 2 · Today — "Events you run" only from that read ═════════════════════════ */

test('2 · Today draws "Events you run" only when the live read has a row', () => {
  const page = src('app/vendor-dashboard/page.tsx');
  assert.match(page, /readEventsYouRunWithNeeds\(supabase, user\.id\)\.catch\(\(\) => \(\{ events: \[\], measured: false \}\)\)/);
  assert.match(page, /eventsYouRun=\{eventsYouRun\}/, 'Today is not handed the rows');
  const screen = src('app/vendor-dashboard/_components/supplier-today-first-screen.tsx');
  assert.match(screen, /eventsYouRun = \[\]/, 'an absent list must default to none');
  assert.match(
    screen,
    /\{eventsYouRun\.length > 0 \? \(\s*<div data-today-events-you-run>/,
    'the section is drawn without a live row',
  );
});

/* ══ 3 · the customer card ══════════════════════════════════════════════════ */

test('3 · "Open their event" and the Coordinator pill — only for an event THIS person runs, on both shells', () => {
  const card = src('app/vendor-dashboard/clients/[eventId]/page.tsx');
  // (2026-10-29: `.some` → `.find`, so the pill can say WHICH seat — Coordinator or Co-host — from the same row.)
  assert.match(
    card,
    /const runThisEvent = \(await eventsYouRunP\)\.events\.find\(\(e\) => e\.eventId === eventId\) \?\? null;\s*const runsThisEvent = runThisEvent !== null;/,
    'the button is not decided by the live read for THIS event',
  );
  const mounts = [...card.matchAll(/<OpenTheirEvent\b/g)].length;
  const gated = [...card.matchAll(/runsThisEvent \? \(?\s*(?:<div[^>]*>\s*)?<OpenTheirEvent\b/g)].length;
  assert.equal(mounts, 2, 'expected one door per shell (flag-off action row, flag-on header)');
  assert.equal(gated, mounts, 'a door is drawn without runsThisEvent');
  assert.match(card, /runsThisEvent \? \(\s*<Badge tone="quiet" data="coordinator">\{runThisEvent\?\.seatWord \?\? 'Coordinator'\}<\/Badge>/);
  const btn = src('app/vendor-dashboard/clients/[eventId]/_components/open-their-event.tsx');
  assert.match(btn, /href=\{`\/dashboard\/\$\{eventId\}`\}/, 'the door is not the shipped event dashboard');
  assert.match(btn, /min-h-11/, 'the door is under 44 px');
});

/* ══ 4 · inside the event — the line, for a coordinator only ════════════════ */

test('4 · the coordinating line renders only for a seat-admitted coordinator with a shop, after the shipped check', () => {
  const layout = src('app/dashboard/[eventId]/layout.tsx');
  // The admission query is the shipped one, untouched.
  assert.match(
    layout,
    /\.from\('event_moderators'\)\s*\.select\('moderator_id, role_subtype, permissions_json'\)\s*\.eq\('event_id', eventId\)\s*\.eq\('user_id', user\.id\)\s*\.not\('accepted_at', 'is', null\)\s*\.is\('removed_at', null\)/,
    'the event layout’s admission query changed',
  );
  // The flag is set ONLY inside the non-couple branch, AFTER a missing seat has already 404'd.
  const notFoundAt = layout.indexOf('if (!moderator) {\n      notFound();');
  const setAt = layout.indexOf('coordinatorSeat = seat.role_subtype === COORDINATOR_SEAT_ROLE;');
  assert.ok(notFoundAt > 0 && setAt > notFoundAt, 'the line is decided before (or without) the shipped admission check');
  assert.equal([...layout.matchAll(/(?<!let )coordinatorSeat = /g)].length, 1, 'something else sets coordinatorSeat');
  assert.match(layout, /let coordinatorSeat = false;/, 'the line must default to off');
  assert.equal([...layout.matchAll(/<CoordinatingLine\b/g)].length, 1);
  assert.match(
    layout,
    /\{coordinatorSeat && switcherData\.context\.hasVendor \? \(\s*<CoordinatingLine\b/,
    'the line is drawn for someone who is not a coordinator with a shop',
  );
  const line = src('app/dashboard/[eventId]/_components/coordinating-line.tsx');
  assert.match(line, /href="\/vendor-dashboard"/, 'Back to your shop must go to the shop');
  assert.match(line, /Back to your shop/);
  assert.match(line, /min-h-11/, 'the way back is under 44 px');
});

/* ══ 5 · no new permission path ═════════════════════════════════════════════ */

test('5 · no new permission path — the shipped window, the hosts’ switch, the person’s own session', () => {
  const rule = src('lib/events-you-run.ts');
  assert.match(rule, /permissionsWithinWindow\(row\.permissions_json/, 'the live rule does not apply the shipped window');
  // 👥 (owner 2026-10-29) A co-host seat is a run seat only through the SHIPPED full-co-host rule (the SQL mirror),
  // and still inside the shipped window — never a new kind list of our own.
  assert.match(rule, /if \(!row\.role_subtype \|\| !seatIsFullCohost\(row\.role_subtype\)\) return false;/, 'a non-co-host seat slips through');
  assert.match(rule, /RUN_SEAT_ROLES: readonly string\[\] = \[COORDINATOR_SEAT_ROLE, \.\.\.FULL_COHOST_SEAT_KINDS\]/);
  assert.match(src('lib/events-you-run.server.ts'), /\.in\('role_subtype', \[\.\.\.RUN_SEAT_ROLES\]\)/, 'the read asks for other seats');
  assert.match(rule, /coordinatorHasHostAccess\(areaCells\(perms\)\)/, 'the live rule ignores the hosts’ switch');
  assert.match(rule, /href: `\/dashboard\/\$\{ev\.event_id\}`/, 'a row opens somewhere other than the event dashboard');
  const read = src('lib/events-you-run.server.ts');
  assert.doesNotMatch(read, /createAdminClient|supabase\/admin|service_role/i, 'the door read must be the person’s own session');
  assert.match(read, /\.eq\('user_id', userId\)/);
  // The event layout must not consult the door to ADMIT anyone — the door follows access, never the reverse.
  assert.doesNotMatch(src('app/dashboard/[eventId]/layout.tsx'), /readEventsYouRun|seatRunsTheEvent|eventsYouRun\(/);
  // +0 server actions: none of the door's files is a server-action module.
  const door = [
    'lib/events-you-run.ts',
    'lib/events-you-run-words.ts',
    'lib/events-you-run.server.ts',
    'app/vendor-dashboard/events/page.tsx',
    'app/vendor-dashboard/_components/events-you-run-rows.tsx',
    'app/vendor-dashboard/_components/events-you-run-screen.tsx',
    'app/vendor-dashboard/clients/[eventId]/_components/open-their-event.tsx',
    'app/dashboard/[eventId]/_components/coordinating-line.tsx',
  ];
  for (const f of door) assert.doesNotMatch(src(f), /['"]use server['"]/, `${f} is a server-action module`);
});

test('5 · words — supplier never vendor, event never celebration, in every visible string of the door', () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx$/.test(n)) files.push(p);
    }
  };
  walk(join(VD, 'events'));
  for (const f of [
    'app/vendor-dashboard/_components/events-you-run-rows.tsx',
    'app/vendor-dashboard/_components/events-you-run-screen.tsx',
    'app/vendor-dashboard/clients/[eventId]/_components/open-their-event.tsx',
    'app/dashboard/[eventId]/_components/coordinating-line.tsx',
    'lib/events-you-run-words.ts',
  ])
    files.push(join(WEB, f));
  for (const f of files) {
    const text = stripComments(readFileSync(f, 'utf8'));
    const strings = [...text.matchAll(/'([^'\n]*)'|"([^"\n]*)"|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '');
    for (const s of strings) {
      if (/^[@./]|^(use|data-)|className|^[\w-]+$/.test(s)) continue;
      assert.doesNotMatch(s, /\bvendors?\b/i, `${relative(WEB, f)} says "vendor": ${s}`);
      assert.doesNotMatch(s, /celebration/i, `${relative(WEB, f)} says "celebration": ${s}`);
    }
  }
});

/* ══ 6 · what needs them — the events board's own read (owner 2026-10-28) ═══════ */

test('6 · the rows print WHAT NEEDS THEM from the board’s own attention read; a refusal is said', () => {
  const rows = src('app/vendor-dashboard/_components/events-you-run-rows.tsx');
  assert.match(rows, /data-needs="">\{e\.needs\}/, 'the row prints something other than what needs them');
  assert.doesNotMatch(rows.split('export function CheckinDeskRows')[0]!, /\{e\.status\}/, 'the countdown is back on the row');
  const read = src('lib/events-you-run.server.ts');
  for (const shipped of ['readEventDecisionCounts(supabase, ids)', 'readEventUnreadCounts(supabase)', 'readChecklistItems(supabase, e.eventId)', 'summarizeEventDecisions(', 'checklistOverdueCount(items, e.anchor, todayIso)']) {
    assert.ok(read.includes(shipped), `the needs line does not reuse the shipped read: ${shipped}`);
  }
  assert.match(
    read,
    /if \(counts === null \|\| unread === null \|\| items === null \|\| items === undefined\) \{\s*summaries\.set\(e\.eventId, null\)/,
    'a refused read must reach the row as null ("Couldn’t load"), never as zeros',
  );
  // The surfaces that PRINT it read the needs; the tab and the door only ask whether (no attention reads).
  assert.match(src('app/vendor-dashboard/page.tsx'), /readEventsYouRunWithNeeds\(supabase, user\.id\)/);
  assert.match(src('app/vendor-dashboard/events/page.tsx'), /readEventsYouRunWithNeeds\(supabase, user\.id\)/);
  assert.doesNotMatch(src('app/vendor-dashboard/layout.tsx'), /readEventsYouRunWithNeeds/);
});

/* ══ 7 · the Check-in desk, one tap from the coordinator's event and their Hub ══ */

test('7 · the shipped Check-in desk admits a live coordinator (no new permission)', () => {
  const desk = src('app/dashboard/[eventId]/guests/checkin/page.tsx');
  assert.match(desk, /\.in\('member_type', \['couple', 'coordinator'\]\)/, 'the desk no longer admits a coordinator member');
  assert.match(desk, /isDelegateWithoutArea\(viewer, 'guest_list'\)/, 'the desk’s own guest-list rule moved');
  // A live coordinator = the hosts' switch ON, which shares the guest list (so the desk opens for every row we draw).
  assert.ok(COORDINATOR_ON_AREAS.includes('guest_list'), 'the switch no longer shares the guest list — the desk would refuse');
});

test('7 · the coordinating line carries Check-in only when the desk’s own rule admits the seat', () => {
  const layout = src('app/dashboard/[eventId]/layout.tsx');
  assert.match(
    layout,
    /if \(coordinatorSeat\) \{\s*coordinatorCheckInP = applyDelegateAccessWindow\(supabase, eventId, seat\.permissions_json \?\? null, false\)\s*\.then\(\(p\) => resolveAreaLevel\(p, 'guest_list'\) !== null\)\s*\.catch\(\(\) => false\);/,
    'the Check-in door is not the desk’s own rule (window + guest list), or fails open',
  );
  assert.match(layout, /checkInHref=\{coordinatorCheckIn \? `\/dashboard\/\$\{eventId\}\/guests\/checkin` : null\}/);
  const line = src('app/dashboard/[eventId]/_components/coordinating-line.tsx');
  assert.match(line, /\{checkInHref \? \(\s*<Link\s+href=\{checkInHref\}/, 'Check-in is drawn without an address');
  assert.equal([...line.matchAll(/min-h-11/g)].length, 2, 'both doors on the line must be 44 px');
});

test('7 · the supplier Hub opens the desk for each event they run — and for nobody else', () => {
  const hub = src('app/vendor-dashboard/on-the-day/page.tsx');
  assert.match(hub, /readEventsYouRun\(supabase, user\.id\)\.catch\(\(\) => \(\{ events: \[\], measured: false \}\)\)/);
  assert.match(hub, /<CheckinDeskRows events=\{runEvents\} \/>/);
  const rows = src('app/vendor-dashboard/_components/events-you-run-rows.tsx');
  assert.match(rows, /checkinDeskHref = \(eventId: string\) => `\/dashboard\/\$\{eventId\}\/guests\/checkin`/, 'the Hub opens something other than the shipped desk');
  assert.match(rows, /const live = events\.filter\(\(e\) => e\.rank !== 2\);\s*if \(live\.length === 0\) return null;/, 'rows drawn with no live event');
});
