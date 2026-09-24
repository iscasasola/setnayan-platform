/**
 * the-event-menu-is-one-tree.test.ts — "event menu by moment" (owner 2026-09-24).
 *
 * Owner: *"realign what the sidebar of an event is and the bottom nav and
 * hamburger menu on mobile mode so everything is easier to access by its flow.
 * like finding the logo maker at the bottom feels so far."* Binding drawing:
 * `build-sessions/prototypes/event_menu_by_moment_2026-09-24.html`.
 *
 * WHAT THIS HOLDS, and how each half fails without a sound:
 *
 *   1 · THE ACCEPTANCE TEST, in the owner's own terms — Logo Maker is row 9 of
 *       21 on a wedding's planning rail, directly under Mood Board (it was row
 *       26 of 27, +11 behind "Show more"). Counted from the REAL builders with
 *       the REAL product list, so a re-order anywhere upstream moves the count.
 *   2 · ONE TREE. The phone's tabs are picked out of the same rows the rail
 *       draws: a tab and its ☰ row can never say two words for one page. And
 *       the registry defaults — which the bar overlays FIRST — must say the
 *       same word, or the bar would still disagree with nothing thrown.
 *   3 · THE BOUNDARY. Product rows reach three client components from a server
 *       layout. They must be plain strings — a function across that boundary
 *       took production down for ~7 hours on 2026-09-23.
 *   4 · NOTHING SILENTLY LOST. Every product the Suite offers the event is a
 *       row; an unknown future product goes to the END, never nowhere; a kind
 *       without a surface loses exactly those rows, and an emptied moment
 *       loses its heading.
 *   5 · THE MOMENT STRIP finds the right moment from the path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildCustomerMenuTree,
  buildEventMenuSections,
  eventMenuRows,
  eventMomentForPath,
  type EventStudioRow,
} from './customer-menu';
import { railToolsSignedIn } from './studio-rail';
import { NAV_SLOT_DEFAULTS } from './nav-registry-defaults';
import { toProfile, type ProfileRow, type EventTypeProfile } from './event-type-profile';
import { stripComments } from './strip-comments';
import { SUITE_NAV_ON } from './studio-hub';
import { buildCustomerNavGroups } from '@/app/dashboard/[eventId]/_components/customer-nav-config';

const WEB = join(import.meta.dirname, '..');
const EVENT_ID = 'S89E-TESTEVENT';
const BASE = `/dashboard/${EVENT_ID}`;

function rowProfile(eventType: string, enabledSurfaces: string[]): EventTypeProfile {
  const row: ProfileRow = {
    event_type: eventType,
    terminology: null,
    enabled_surfaces: enabledSurfaces,
    marketplace_enabled: true,
    event_class: null,
    layer_mode: null,
    multi_day: null,
    onboarding_flow_key: null,
    role_set_key: null,
    template_pack_key: null,
    monogram_set_key: null,
    reveal_pack_key: null,
    budget_taxonomy_key: null,
    schedule_seed_key: null,
    statutory_pack_key: null,
  };
  return toProfile(row);
}

const WEDDING = rowProfile('wedding', [
  'website', 'save_the_date', 'rsvp', 'seating', 'budget', 'schedule',
  'monogram', 'day_of', 'gallery', 'livestream', 'song',
]);
// A kind with no seating, monogram, livestream or song — the thinnest shape.
const DATE = rowProfile('date', ['website', 'rsvp', 'budget', 'schedule', 'day_of', 'gallery']);

/** Exactly what `layout.tsx` hands the three client components. */
function studioRowsFor(profile: EventTypeProfile): EventStudioRow[] {
  return railToolsSignedIn({ eventId: EVENT_ID, count: 1, profile }).map((t) => ({
    key: t.key,
    href: t.href,
    name: t.name,
  }));
}

function rail(profile: EventTypeProfile, phase: 'plan' | 'dayof' | 'after' = 'plan') {
  return buildCustomerNavGroups(EVENT_ID, {
    phase,
    websiteEnabled: true,
    seatingEnabled: profile.enabledSurfaces.includes('seating'),
    studioRows: studioRowsFor(profile),
  });
}

/* ══ 1 · THE OWNER'S SENTENCE ══════════════════════════════════════════════ */

test('Logo Maker is row 9 of 21 on a wedding planning rail, directly under Mood Board', () => {
  /*
    Counted the way the drawing counts: row 1 is the "Events" focus row above
    the event, row 2 is the event's name (Details), then every menu row.
  */
  const labels = ['Events', ...rail(WEDDING).flatMap((g) => g.items.map((i) => i.label))];
  const at = labels.indexOf('Logo Maker') + 1;
  assert.equal(labels.length, 21, `the rail is ${labels.length} rows: ${labels.join(' · ')}`);
  assert.equal(at, 9, `Logo Maker is row ${at} — the owner found row 26 "so far"`);
  assert.equal(labels[at - 2], 'Mood Board', 'Logo Maker must sit directly under Mood Board');
  assert.deepEqual(labels, [
    'Events', 'Details',
    'Overview', 'Papic', 'Galleries',
    'Your Team', 'Budget',
    'Mood Board', 'Logo Maker', 'Pakanta',
    'Guests', 'Hosts', 'Event Hub Controller',
    'Schedule', 'Seat plan', '3D Plan', 'Live Studio', 'Patiktok',
    // NEXT_PUBLIC_SUITE is on in production (read 2026-09-22); the word
    // follows the one flag branch in lib/studio-hub.ts either way.
    'Setnayan AI', SUITE_NAV_ON ? 'Suite' : 'Studio', 'Refer a couple',
  ]);
});

test('Check-in joins The day on the day; Editorial joins the spine after it', () => {
  const day = rail(WEDDING, 'dayof').find((g) => g.key === 'day')!.items.map((i) => i.key);
  assert.deepEqual(day, ['schedule', 'checkin', 'seat', 'pa3d', 'panood', 'patiktok']);
  const spine = rail(WEDDING, 'after').find((g) => g.key === 'spine')!.items.map((i) => i.key);
  assert.deepEqual(spine, ['home', 'papic', 'galleries', 'editorial']);
  assert.ok(
    !rail(WEDDING).flatMap((g) => g.items).some((i) => i.key === 'checkin' || i.key === 'editorial'),
    'Check-in or Editorial shows before its moment',
  );
});

/* ══ 2 · ONE TREE — THE PHONE PICKS FROM IT ═══════════════════════════════ */

const BARS = {
  plan: [['home', 'Overview'], ['papic', 'Papic'], ['explore', 'Your Team'], ['guests', 'Guests'], ['launch', 'Event Hub Controller']],
  dayof: [['now', 'Overview'], ['papic', 'Papic'], ['checkin', 'Check-in'], ['launch', 'Event Hub Controller'], ['schedule', 'Schedule']],
  after: [['home', 'Overview'], ['papic', 'Papic'], ['galleries', 'Galleries'], ['review', 'Your Team'], ['launch', 'Event Hub Controller']],
} as const;

for (const phase of ['plan', 'dayof', 'after'] as const) {
  test(`the ${phase} phone bar is the owner-approved five, in the tree's own words`, () => {
    const bar = buildCustomerMenuTree(EVENT_ID, {
      phase,
      websiteEnabled: true,
      seatingEnabled: true,
      studioRows: studioRowsFor(WEDDING),
    });
    assert.deepEqual(bar.map((m) => [m.key, m.label]), BARS[phase]);
    // Every tab opens a page the ☰ list also opens, under the SAME word.
    const rows = rail(WEDDING, phase).flatMap((g) => g.items);
    for (const tab of bar) {
      const path = tab.href.split('?')[0];
      const row = rows.find((r) => r.href === path);
      assert.ok(row, `${phase}: the ${tab.key} tab opens ${path}, which no ☰ row opens`);
      assert.equal(row!.label, tab.label, `${phase}: one page, two words (${row!.label} / ${tab.label})`);
    }
  });
}

test('the bar\'s registry defaults say the tree\'s words — the bar overlays them FIRST', () => {
  /*
    `customer-bottom-nav.tsx` renders `slot?.label ?? m.label`, and prod
    `nav_slot_override` holds no rows, so these defaults ARE what a phone
    shows. A stale "Now" or "Review" here would survive every tree test.
  */
  const bySlot = new Map(NAV_SLOT_DEFAULTS.map((s) => [s.key, s]));
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    for (const [key, label] of BARS[phase]) {
      const slot = bySlot.get(`customer.bottom-nav.${key}`);
      assert.ok(slot, `customer.bottom-nav.${key} has no registry default — admin cannot rename the ${key} tab`);
      assert.equal(slot!.label, label, `customer.bottom-nav.${key} says "${slot!.label}", the tree says "${label}"`);
    }
  }
  // The retired slots are gone, so /admin/menus offers no rename for a dead tab.
  for (const retired of ['customer.bottom-nav.seats', 'customer.bottom-nav.studio']) {
    assert.ok(!bySlot.has(retired), `${retired} is still offered for a tab that no longer renders`);
  }
});

/* ══ 3 · THE SERVER → CLIENT BOUNDARY ════════════════════════════════════ */

test('product rows cross the boundary as plain strings, and the layout sends nothing else', () => {
  for (const row of studioRowsFor(WEDDING)) {
    assert.deepEqual(Object.keys(row).sort(), ['href', 'key', 'name']);
    for (const v of Object.values(row)) assert.equal(typeof v, 'string');
  }
  const layout = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/layout.tsx'), 'utf8'));
  assert.match(
    layout,
    /\(t\)\s*=>\s*\(\{\s*key:\s*t\.key,\s*href:\s*t\.href,\s*name:\s*t\.name\s*\}\)/,
    'the layout no longer narrows the product rows to key · href · name before ' +
      'handing them to client components — a function or component riding along ' +
      'is the 2026-09-23 outage',
  );
  // Every client consumer is handed the same list — the #5938 lesson: a caller
  // that is not passed the input silently loses the rows gated on it.
  assert.equal((layout.match(/studioRows=\{studioRows\}/g) ?? []).length, 2, 'bottom bar + moment strip');
  const inputs = layout.slice(layout.indexOf('const eventRailInputs'));
  assert.match(inputs.slice(0, inputs.indexOf('};')), /studioRows,/, 'the rail (eventRailInputs)');
});

/* ══ 4 · NOTHING SILENTLY LOST ═════════════════════════════════════════════ */

for (const [label, profile] of [['wedding', WEDDING], ['date', DATE]] as const) {
  test(`${label}: every product the Suite offers is a ✦ row, and nothing is listed twice`, () => {
    const offered = studioRowsFor(profile)
      .map((r) => r.key)
      .filter((k) => k !== 'pawebsite' && k !== '__all__');
    const rows = rail(profile).flatMap((g) => g.items);
    const products = rows.filter((r) => r.studio).map((r) => r.key);
    assert.deepEqual([...products].sort(), [...offered].sort());
    const hrefs = rows.map((r) => r.href);
    assert.equal(new Set(hrefs).size, hrefs.length, `two rows open one page: ${hrefs.join(' ')}`);
  });
}

test('a thin kind drops its rows, and an emptied moment drops its heading', () => {
  const groups = rail(DATE);
  const keys = groups.flatMap((g) => g.items.map((i) => i.key));
  for (const gone of ['seat', 'pa3d', 'panood', 'palogo', 'pakanta']) {
    assert.ok(!keys.includes(gone), `${gone} shows for a kind without its surface`);
  }
  assert.ok(groups.every((g) => g.items.length > 0), 'a moment renders a heading over nothing');
});

test('an unknown future product lands at the end — never nowhere', () => {
  const rows = eventMenuRows(
    buildEventMenuSections(EVENT_ID, {
      websiteEnabled: true,
      studioRows: [
        ...studioRowsFor(WEDDING),
        { key: 'panew', href: `${BASE}/studio/panew`, name: 'Panew' },
      ],
    }),
  );
  const end = buildEventMenuSections(EVENT_ID, {
    studioRows: [{ key: 'panew', href: `${BASE}/studio/panew`, name: 'Panew' }],
  }).find((s) => s.key === 'end')!;
  assert.ok(rows.some((r) => r.key === 'panew'), 'an unplaced product was dropped');
  assert.ok(end.rows.some((r) => r.key === 'panew' && r.studio), 'it must sit in the end of the list, marked ✦');
});

/* ══ 5 · THE MOMENT STRIP ═════════════════════════════════════════════════ */

test('the phone strip docks the moment the page belongs to', () => {
  const sections = buildEventMenuSections(EVENT_ID, {
    websiteEnabled: true,
    studioRows: studioRowsFor(WEDDING),
  });
  const at = (p: string) => eventMomentForPath(`${BASE}${p}`, sections)?.key ?? null;
  // The acceptance test's phone half: open Mood Board, Logo Maker is one tap.
  const look = eventMomentForPath(`${BASE}/studio/mood-board`, sections)!;
  assert.deepEqual(look.rows.map((r) => r.key), ['mood-board', 'palogo', 'pakanta']);
  assert.equal(at('/monogram'), 'look');
  assert.equal(at('/seating/lab'), 'day');
  assert.equal(at('/guests'), 'invite');
  assert.equal(at('/vendors'), 'book');
  assert.equal(at('/studio/papic'), 'spine');
  // Overview is the front page, not a moment; unlisted pages dock nothing.
  assert.equal(at(''), null);
  assert.equal(at('/messages'), null);
});
