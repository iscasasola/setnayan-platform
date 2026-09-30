/**
 * the-event-menu-is-one-tree.test.ts — THE EVENT MENU IS FIVE ROWS (Stage D,
 * owner 2026-09-29: *"so basically. this is what an event needs. Guestlist ·
 * Your Team · Event Hub Maker · Our Services"*; *"on mobile mode. we do not
 * want that sub bottom nav anymore"*). Supersedes the 2026-09-24 "by moment"
 * tree this file used to hold.
 *
 * WHAT THIS HOLDS, and how each half fails without a sound:
 *
 *   1 · THE OWNER'S LIST — Home · Guest list · Your Team · Event Hub Maker ·
 *       Our Services on a wedding's rail, in that order, in every phase, from
 *       the REAL builders with the REAL product list. (The interim Seat plan
 *       row left in train n, 2026-09-29 — its Details home is on main.)
 *   2 · ONE TREE. The phone's tabs are the same rows under the same words, and
 *       the registry defaults — which the bar and the rail overlay FIRST —
 *       say the same words too.
 *   3 · THE BOUNDARY. Product rows reach client components from a server
 *       layout. They must be plain strings (the 2026-09-23 outage).
 *   4 · NOTHING SILENTLY LOST. Every product page the event is offered lights
 *       a row — Our Services, or the row that holds it — including an unknown
 *       future product; no row opens a page twice.
 *   5 · EVERY OLD ROW'S PAGE LIGHTS ITS NEW HOME on the rail (one resolver).
 *   6 · 3D PLAN LIVES IN SEAT PLAN — and the Seat plan is Details › Your
 *       event › Seat plan, so its pages (and /seating) light the Event Hub
 *       Maker, or Our Services where there is no Maker; the `pa3d` key
 *       survives; the seat plan still opens both 3D doors.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildCustomerMenuTree,
  buildEventMenuSections,
  eventMenuRows,
  eventMenuRowClaims,
  PHONE_BAR_SHORT,
  STUDIO_ABSORBED,
  type EventStudioRow,
} from './customer-menu';
import { activeRailKey } from '@/app/_components/frontdoor/rail-active';
import { eventRailMatchRows } from '@/app/dashboard/[eventId]/_components/event-rail-match-rows';
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

/* ══ 1 · THE OWNER'S LIST ═════════════════════════════════════════════════ */

const OUR_SERVICES = SUITE_NAV_ON ? 'More Services' : 'Studio';

test('the rail is the owner’s five — nothing more — in every phase', () => {
  /*
    Counted the way the drawing counts: row 1 is the "Events" focus row above
    the event, row 2 is the event's name (Details), then every menu row.
    NEXT_PUBLIC_SUITE is on in production (read 2026-09-22); the word follows
    the one flag branch in lib/studio-hub.ts either way.
  */
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    const labels = ['Events', ...rail(WEDDING, phase).flatMap((g) => g.items.map((i) => i.label))];
    assert.deepEqual(
      labels,
      ['Events', 'Details', 'Home', 'Guests', 'Your Team', 'Event Hub Maker', OUR_SERVICES],
      `${phase}: ${labels.join(' · ')}`,
    );
  }
});

test('the rows that left are gone from every phase — their homes hold them', () => {
  const gone = [
    'papic', 'galleries', 'editorial', 'budget', 'hosts', 'checkin', 'schedule',
    'mood-board', 'palogo', 'pakanta', 'panood', 'patiktok', 'pa3d', 'setnayan-ai', 'refer',
  ];
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    const keys = rail(WEDDING, phase).flatMap((g) => g.items.map((i) => i.key));
    for (const k of gone) assert.ok(!keys.includes(k), `${phase}: "${k}" is a menu row again`);
  }
});

/* ══ 2 · ONE TREE — THE PHONE PICKS FROM IT ═══════════════════════════════ */

/** The rail's (and ☰'s) words — the full names. */
const FIVE = [
  ['home', 'Home'], ['guests', 'Guests'], ['explore', 'Your Team'],
  ['launch', 'Event Hub Maker'], ['studio', OUR_SERVICES],
] as const;
/** The phone bar's words — the four (owner 2026-09-30: "the menu changes also
 *  on the mobile view"): the rail's rows minus the Maker, one short word. */
const BAR_FOUR = [
  ['home', 'Home'], ['guests', 'Guests'], ['explore', 'Your Team'],
  ['studio', SUITE_NAV_ON ? 'More' : 'Studio'],
] as const;
const BARS = { plan: BAR_FOUR, dayof: BAR_FOUR, after: BAR_FOUR } as const;

for (const phase of ['plan', 'dayof', 'after'] as const) {
  test(`the ${phase} phone bar is the owner's four, in the tree's own words`, () => {
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
      // One page, one word — save the owner's one short bar word, which lives
      // in ONE map (`PHONE_BAR_SHORT`) and nowhere else.
      const expected = PHONE_BAR_SHORT[tab.key] ?? row!.label;
      assert.equal(tab.label, expected, `${phase}: one page, two words (${row!.label} / ${tab.label})`);
    }
  });
}

test('the bar\'s registry defaults say the tree\'s words — the bar overlays them FIRST', () => {
  /*
    `customer-bottom-nav.tsx` renders `slot?.label ?? m.label`, and prod
    `nav_slot_override` holds no rows, so these defaults ARE what a phone
    shows. A stale "Overview" or "Guests" here would survive every tree test.
    The rail overlays `customer.sidebar.<key>` the same way.
  */
  const bySlot = new Map(NAV_SLOT_DEFAULTS.map((s) => [s.key, s]));
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    for (const [key, label] of BARS[phase]) {
      const slot = bySlot.get(`customer.bottom-nav.${key}`);
      assert.ok(slot, `customer.bottom-nav.${key} has no registry default — admin cannot rename the ${key} tab`);
      assert.equal(slot!.label, label, `customer.bottom-nav.${key} says "${slot!.label}", the tree says "${label}"`);
    }
  }
  for (const [key, label] of FIVE) {
    const slot = bySlot.get(`customer.sidebar.${key}`);
    assert.ok(slot, `customer.sidebar.${key} has no registry default`);
    assert.equal(slot!.label, label, `customer.sidebar.${key} says "${slot!.label}", the tree says "${label}"`);
  }
  // The retired slots are gone, so /admin/menus offers no rename for a dead tab.
  for (const retired of [
    'customer.bottom-nav.seats', 'customer.bottom-nav.now', 'customer.bottom-nav.checkin',
    'customer.bottom-nav.papic', 'customer.bottom-nav.schedule', 'customer.bottom-nav.review',
    'customer.bottom-nav.galleries', 'customer.bottom-nav.launch',
  ]) {
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
  assert.equal((layout.match(/studioRows=\{studioRows\}/g) ?? []).length, 1, 'the one bottom bar');
  const inputs = layout.slice(layout.indexOf('const eventRailInputs'));
  assert.match(inputs.slice(0, inputs.indexOf('};')), /studioRows,/, 'the rail (eventRailInputs)');
});

/* ══ 4 · NOTHING SILENTLY LOST ═════════════════════════════════════════════ */

for (const [label, profile] of [['wedding', WEDDING], ['date', DATE]] as const) {
  test(`${label}: every product page the event is offered lights a row, and no row opens a page twice`, () => {
    const matchRows = eventRailMatchRows({
      eventId: EVENT_ID, websiteEnabled: true,
      seatingEnabled: profile.enabledSurfaces.includes('seating'),
      studioRows: studioRowsFor(profile),
    });
    for (const r of studioRowsFor(profile)) {
      if (r.key === '__all__') continue;
      const lit = activeRailKey(matchRows, r.href.split('?')[0]!);
      assert.ok(lit, `${r.key} (${r.href}) lights no row — a page with no home in the menu`);
    }
    const rows = rail(profile).flatMap((g) => g.items);
    const hrefs = rows.map((r) => r.href);
    assert.equal(new Set(hrefs).size, hrefs.length, `two rows open one page: ${hrefs.join(' ')}`);
  });
}

test('a thin kind drops its rows, and an empty section is never drawn', () => {
  const groups = rail(DATE);
  const keys = groups.flatMap((g) => g.items.map((i) => i.key));
  assert.ok(!keys.includes('seat'), 'Seat plan shows for a kind without seating');
  assert.ok(groups.every((g) => g.items.length > 0), 'a section renders over nothing');
});

test('an unknown future product lights Our Services — never nowhere', () => {
  const rows = eventMenuRows(
    buildEventMenuSections(EVENT_ID, {
      websiteEnabled: true,
      studioRows: [...studioRowsFor(WEDDING), { key: 'panew', href: `${BASE}/studio/panew`, name: 'Panew' }],
    }),
  );
  const studio = rows.find((r) => r.key === 'studio')!;
  assert.ok(eventMenuRowClaims(studio).includes(`${BASE}/studio/panew`), 'an unplaced product was dropped');
  assert.ok(!rows.some((r) => r.key === 'panew'), 'a product became a menu row again');
});

/* ══ 5 · EVERY OLD ROW'S PAGE LIGHTS ITS NEW HOME ══════════════════════════ */

test('each page that lost its row lights the pillar that holds it (one resolver)', () => {
  const matchRows = eventRailMatchRows({
    eventId: EVENT_ID, websiteEnabled: true, seatingEnabled: true, studioRows: studioRowsFor(WEDDING),
  });
  const HOMES: Array<[string, string]> = [
    ['', 'home'],
    ['/guests', 'guests'], ['/guests/checkin', 'guests'], ['/hosts', 'guests'],
    ['/event-qr', 'guests'], ['/people', 'guests'],
    ['/vendors', 'explore'], ['/budget', 'explore'],
    ['/launch', 'launch'], ['/website/editor', 'launch'], ['/story', 'launch'],
    ['/schedule', 'launch'], ['/studio/mood-board', 'launch'], ['/monogram', 'launch'],
    ['/suite', 'studio'], ['/studio', 'studio'], ['/galleries', 'studio'],
    ['/studio/papic', 'studio'], ['/studio/patiktok', 'studio'], ['/studio/pakanta', 'studio'],
    ['/studio/setnayan-ai', 'studio'],
    // Train n: the Seat plan row left — /seating is Details › Your event ›
    // Seat plan, so it lights the Maker (the page lands the couple there).
    ['/seating', 'launch'],
  ];
  for (const [p, key] of HOMES) {
    assert.equal(activeRailKey(matchRows, `${BASE}${p}`), key, `${p || '(home)'} does not light ${key}`);
  }
});

test('the Refer a couple row went to the account menu, behind the programme toggle', () => {
  const layout = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/layout.tsx'), 'utf8'));
  assert.match(layout, /referHref=\{referralEnabled \? `\/dashboard\/\$\{eventId\}\/refer` : null\}/);
  const switcher = stripComments(
    readFileSync(join(WEB, 'app/_components/account-switcher/account-switcher.tsx'), 'utf8'),
  );
  assert.match(switcher, /referHref \? \(\s*<Link\s+href=\{referHref\}/, 'the account menu draws no Refer a couple link');
});

/* ══ 6 · 3D PLAN LIVES IN SEAT PLAN — WHICH LIVES IN THE MAKER ════════════ */

const THREE_D_PAGES = ['/seating/lab', '/seating/lab?mode=play', '/plan3d'];

test('no surface draws a 3D Plan row — rail and ☰, phone bar', () => {
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    const rows = rail(WEDDING, phase).flatMap((g) => g.items);
    assert.ok(
      !rows.some((r) => r.key === 'pa3d' || r.label === '3D Plan'),
      `${phase}: the rail / ☰ still draws a 3D Plan row`,
    );
    const bar = buildCustomerMenuTree(EVENT_ID, {
      phase, websiteEnabled: true, seatingEnabled: true, studioRows: studioRowsFor(WEDDING),
    });
    assert.ok(!bar.some((m) => (m.key as string) === 'pa3d' || m.label === '3D Plan'), `${phase}: the phone bar has a 3D Plan tab`);
  }
});

test('the 3D pages light the Event Hub Maker on the rail, exactly as /seating does', () => {
  const matchRows = eventRailMatchRows({
    eventId: EVENT_ID, websiteEnabled: true, seatingEnabled: true, studioRows: studioRowsFor(WEDDING),
  });
  for (const p of ['/seating', ...THREE_D_PAGES.map((x) => x.split('?')[0]!), '/plan3d/anything']) {
    assert.equal(activeRailKey(matchRows, `${BASE}${p}`), 'launch', `${p} does not light the Maker on the rail`);
  }
});

test('the 3D pages light Home on the phone (the Maker has no tab), as /seating does', () => {
  const bar = buildCustomerMenuTree(EVENT_ID, {
    websiteEnabled: true, seatingEnabled: true, studioRows: studioRowsFor(WEDDING),
  });
  assert.ok(!bar.some((m) => m.key === 'launch'), 'the Maker is a phone tab again');
  const maker = bar.find((m) => m.key === 'home')!.activeMatch as string[];
  for (const p of ['/seating', '/seating/lab', '/plan3d']) {
    assert.ok(maker.includes(`${BASE}${p}`), `${p} lights no tab on the phone`);
  }
  assert.ok(!bar.some((m) => (m.key as string) === 'seat'), 'the phone bar grew a Seat plan tab');
});

test('with no Maker, /seating and the 3D pages light Our Services — never nowhere', () => {
  const rows = eventMenuRows(
    buildEventMenuSections(EVENT_ID, { websiteEnabled: false, seatingEnabled: true, studioRows: studioRowsFor(WEDDING) }),
  );
  assert.ok(!rows.some((r) => r.key === 'launch' || r.key === 'seat'), 'a Maker or Seat plan row with no Maker');
  const studio = eventMenuRowClaims(rows.find((r) => r.key === 'studio')!);
  for (const p of ['/seating', '/seating/lab', '/plan3d']) {
    assert.ok(studio.includes(`${BASE}${p}`), `${p} lights nothing where there is no Maker`);
  }
});

test('the pa3d key survives — still offered, absorbed by rule, and never silently lost', () => {
  // Still in the Suite-parity product list (`studio-menu-adapts-to-event`).
  assert.ok(studioRowsFor(WEDDING).some((r) => r.key === 'pa3d'), 'pa3d left railToolsSignedIn — the Suite parity breaks');
  assert.equal(STUDIO_ABSORBED.pa3d?.into, 'launch', 'pa3d is no longer absorbed into the Maker (the Seat plan’s home) by the documented rule');
  /*
    ⚠ NOT A DROP. With the host row absent (no Maker) but the product
    offered, its pages light Our Services — not nowhere.
  */
  const rows = eventMenuRows(
    buildEventMenuSections(EVENT_ID, { seatingEnabled: false, studioRows: studioRowsFor(WEDDING) }),
  );
  const studio = rows.find((r) => r.key === 'studio')!;
  assert.ok(eventMenuRowClaims(studio).includes(`${BASE}/plan3d`), 'the 3D Plan is lost with no Maker row');
});

test('the seat plan still opens the 3D view, and the 3D view opens /plan3d', () => {
  const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
  const editor = src('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  const frame = src('app/dashboard/[eventId]/seating/_components/seating-frame.tsx');
  const lab = src('app/dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx');
  assert.match(editor, /labUrl\s*=\s*`\/dashboard\/\$\{eventId\}\/seating\/lab`/, 'the 2D seat plan lost its URL to the 3D view');
  assert.match(editor, /<SeatingViewSegment\b/, 'the 2D seat plan lost its List · 2D · 3D segment');
  assert.match(frame, /key:\s*'3d',\s*label:\s*'3D'/, 'the segment lost its 3D option');
  assert.match(lab, /href=\{`\/dashboard\/\$\{eventId\}\/plan3d`\}/, 'the 3D view lost its door to the 3D Plan control centre');
});
