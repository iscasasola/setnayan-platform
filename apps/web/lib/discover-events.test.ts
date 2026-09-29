/**
 * discover-events.test.ts — Discover's new shelves (DECISION_LOG 2026-09-29).
 *
 * Three things are held here, and the first two are EXECUTED, not grepped:
 *
 *   1 · THE ALLOW-LIST — only PUBLIC, not archived, slugged, dated, not-yet-
 *       finished (Manila day) events the viewer is not already in.
 *   2 · THE LAYERS AND THEIR ORDER — your people's events first, soonest first;
 *       everything else after, the viewer's region first, then soonest; capped;
 *       one event in one place. People to follow: public only, never yourself
 *       or anyone you follow, most-followed first.
 *   3 · THE LAYER SPLIT AND THE HONEST READ — the decision module is pure (no
 *       `server-only`, no Supabase), the loader checks every read's `error`,
 *       scopes the viewer's own reads to the viewer, and the render says
 *       "couldn't load" for a failed read rather than "none".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

import {
  DISCOVER_CAPS,
  datePlate,
  isDiscoverable,
  pickViewerRegion,
  selectDiscoverShelves,
  selectPeopleToFollow,
  type DiscoverEventRow,
  type DiscoverHost,
  type DiscoverRelation,
  type PersonCandidate,
} from './discover-events-core';

const TODAY = '2026-10-01';
const NOW = Date.parse('2026-10-01T04:00:00Z');

let n = 0;
function ev(over: Partial<DiscoverEventRow> = {}): DiscoverEventRow {
  n += 1;
  return {
    event_id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    slug: `event-${n}`,
    display_name: `Event ${n}`,
    event_date: '2026-10-20',
    event_end_date: null,
    event_date_precision: 'day',
    event_type: 'birthday',
    region: null,
    archived: false,
    landing_page_visibility: 'public',
    scheduled_launch_at: null,
    monogram_text: null,
    rsvp_ask_config: { whoCanRsvp: 'anyone' },
    ...over,
  };
}

const ctx = { todayISO: TODAY, now: NOW, memberEventIds: new Set<string>() };

function shelves(
  events: DiscoverEventRow[],
  opts: {
    hosts?: Map<string, DiscoverHost[]>;
    people?: Map<string, DiscoverRelation>;
    members?: Set<string>;
    region?: string | null;
    caps?: { people: number; world: number };
  } = {},
) {
  return selectDiscoverShelves({
    events,
    hostsByEvent: opts.hosts ?? new Map(),
    people: opts.people ?? new Map(),
    memberEventIds: opts.members ?? new Set(),
    viewerRegion: opts.region ?? null,
    todayISO: TODAY,
    now: NOW,
    caps: opts.caps,
  });
}

// ─── 1 · THE ALLOW-LIST ──────────────────────────────────────────────────────

test('only PUBLIC lists — unlisted, invited_accounts, private and unknown never do', () => {
  assert.equal(isDiscoverable(ev(), ctx), true);
  for (const v of ['unlisted', 'invited_accounts', 'private', 'friends', '', null]) {
    assert.equal(
      isDiscoverable(ev({ landing_page_visibility: v }), ctx),
      false,
      `visibility ${JSON.stringify(v)} must never reach Discover`,
    );
  }
});

test('a private event whose scheduled launch is due reads as public (resolveEffectiveVisibility)', () => {
  const due = ev({ landing_page_visibility: 'private', scheduled_launch_at: '2026-09-30T00:00:00Z' });
  const notYet = ev({ landing_page_visibility: 'private', scheduled_launch_at: '2026-12-30T00:00:00Z' });
  assert.equal(isDiscoverable(due, ctx), true);
  assert.equal(isDiscoverable(notYet, ctx), false);
});

test('archived, slugless, dateless and finished events are refused', () => {
  assert.equal(isDiscoverable(ev({ archived: true }), ctx), false);
  assert.equal(isDiscoverable(ev({ slug: null }), ctx), false);
  assert.equal(isDiscoverable(ev({ slug: '  ' }), ctx), false);
  assert.equal(isDiscoverable(ev({ event_date: null }), ctx), false);
  assert.equal(isDiscoverable(ev({ event_date: '2026-09-30' }), ctx), false, 'yesterday is over');
});

test('upcoming is decided by the Manila calendar day — today and an ongoing multi-day event still list', () => {
  assert.equal(isDiscoverable(ev({ event_date: TODAY }), ctx), true, 'today is not finished');
  assert.equal(
    isDiscoverable(ev({ event_date: '2026-09-29', event_end_date: '2026-10-01' }), ctx),
    true,
    'a multi-day event is not over until its last day',
  );
});

test('an event the viewer is already a member of never lists', () => {
  const mine = ev();
  assert.equal(
    isDiscoverable(mine, { ...ctx, memberEventIds: new Set([mine.event_id]) }),
    false,
  );
  const s = shelves([mine], { members: new Set([mine.event_id]) });
  assert.equal(s.world.length + s.people.length, 0);
});

// ─── 2 · LAYERS, ORDER, CAPS ────────────────────────────────────────────────

test("an event hosted by someone you follow goes on YOUR shelf, not the world's — once", () => {
  const theirs = ev({ event_date: '2026-11-01' });
  const other = ev({ event_date: '2026-10-05' });
  const hosts = new Map([[theirs.event_id, [{ userId: 'u-ana', name: 'Ana', publicSlug: 'ana' }]]]);
  const s = shelves([theirs, other, theirs], {
    hosts,
    people: new Map([['u-ana', 'follow']]),
  });
  assert.deepEqual(s.people.map((c) => c.key), [theirs.event_id]);
  assert.deepEqual(s.world.map((c) => c.key), [other.event_id]);
  assert.equal(s.people[0]!.relation, 'follow');
});

test('connected outranks follow on a card with two of your people', () => {
  const e = ev();
  const hosts = new Map([
    [
      e.event_id,
      [
        { userId: 'u-a', name: 'A', publicSlug: 'a' },
        { userId: 'u-b', name: 'B', publicSlug: 'b' },
      ],
    ],
  ]);
  const s = shelves([e], {
    hosts,
    people: new Map<string, DiscoverRelation>([
      ['u-a', 'follow'],
      ['u-b', 'connected'],
    ]),
  });
  assert.equal(s.people[0]!.relation, 'connected');
});

test('your people\'s shelf is soonest first', () => {
  const late = ev({ event_date: '2026-12-12' });
  const soon = ev({ event_date: '2026-10-17' });
  const mid = ev({ event_date: '2026-11-07' });
  const hosts = new Map(
    [late, soon, mid].map((e) => [e.event_id, [{ userId: 'u-p', name: 'P', publicSlug: 'p' }]]),
  );
  const s = shelves([late, soon, mid], { hosts, people: new Map([['u-p', 'follow']]) });
  assert.deepEqual(s.people.map((c) => c.key), [soon.event_id, mid.event_id, late.event_id]);
});

test('the world is the viewer\'s region first, each group soonest first', () => {
  const ncrLate = ev({ event_date: '2026-12-01', region: 'ncr' });
  const cebuSoon = ev({ event_date: '2026-10-03', region: 'c-visayas' });
  const ncrSoon = ev({ event_date: '2026-10-10', region: 'NCR' }); // another spelling of the same region
  const none = ev({ event_date: '2026-10-02', region: null });
  const s = shelves([ncrLate, cebuSoon, ncrSoon, none], { region: 'ncr' });
  assert.deepEqual(s.world.map((c) => c.key), [
    ncrSoon.event_id,
    ncrLate.event_id,
    none.event_id,
    cebuSoon.event_id,
  ]);
});

test('no region (or signed out) — the world is soonest first only', () => {
  const a = ev({ event_date: '2026-12-01', region: 'ncr' });
  const b = ev({ event_date: '2026-10-03', region: 'c-visayas' });
  const c = ev({ event_date: '2026-10-10', region: null });
  const s = shelves([a, b, c], { region: null });
  assert.deepEqual(s.world.map((x) => x.key), [b.event_id, c.event_id, a.event_id]);
});

test('each shelf is capped', () => {
  const many = Array.from({ length: 40 }, (_, i) =>
    ev({ event_date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}` }),
  );
  const s = shelves(many);
  assert.equal(s.world.length, DISCOVER_CAPS.world);
  const small = shelves(many, { caps: { people: 1, world: 3 } });
  assert.equal(small.world.length, 3);
});

test("the viewer's region is their MOST RECENT membership that has one", () => {
  assert.equal(
    pickViewerRegion([
      { region: 'ncr', joined_at: '2026-01-01T00:00:00Z' },
      { region: 'c-visayas', joined_at: '2026-09-01T00:00:00Z' },
      { region: null, joined_at: '2026-09-20T00:00:00Z' },
      { region: 'not-a-region', joined_at: '2026-09-25T00:00:00Z' },
    ]),
    'c-visayas',
  );
  assert.equal(pickViewerRegion([{ region: null, joined_at: '2026-09-20T00:00:00Z' }]), null);
  assert.equal(pickViewerRegion([]), null);
});

// ─── THE CARD ───────────────────────────────────────────────────────────────

test('only a PUBLIC-profile host is ever named, and no user id reaches a card', () => {
  const e = ev();
  const hosts = new Map([
    [
      e.event_id,
      [
        { userId: 'u-private', name: null, publicSlug: null },
        { userId: 'u-public', name: 'Jun Santos', publicSlug: 'jun' },
      ],
    ],
  ]);
  const card = shelves([e], { hosts }).world[0]!;
  assert.deepEqual(card.host, { name: 'Jun Santos', slug: 'jun' });
  const json = JSON.stringify(card);
  assert.ok(!json.includes('u-private') && !json.includes('u-public'), 'a user id leaked onto a card');

  const e2 = ev();
  const onlyPrivate = new Map([[e2.event_id, [{ userId: 'u-x', name: 'Secret Name', publicSlug: null }]]]);
  const c2 = shelves([e2], { hosts: onlyPrivate }).world[0]!;
  assert.equal(c2.host, null);
  assert.ok(!JSON.stringify(c2).includes('Secret Name'));
});

test('the card offers Ask to join ONLY when the host chose "Anyone, I approve"', () => {
  const anyone = ev({ rsvp_ask_config: { whoCanRsvp: 'anyone' } });
  const listOnly = ev({ rsvp_ask_config: { whoCanRsvp: 'guest_list' } });
  const unset = ev({ rsvp_ask_config: null });
  const s = shelves([anyone, listOnly, unset]);
  const byKey = new Map(s.world.map((c) => [c.key, c]));
  assert.equal(byKey.get(anyone.event_id)!.askHref, `/join/${anyone.event_id}`);
  assert.equal(byKey.get(listOnly.event_id)!.askHref, null);
  assert.equal(byKey.get(unset.event_id)!.askHref, null);
  assert.ok(!('rsvp_ask_config' in byKey.get(anyone.event_id)!), 'the raw config must not ride on the card');
});

test('the card opens /{slug}', () => {
  const e = ev({ slug: 'ana-turns-30' });
  assert.equal(shelves([e]).world[0]!.href, '/ana-turns-30');
});

test('the date plate honours precision and names the year only when it is not this year', () => {
  assert.equal(datePlate('2026-10-17', 'day', TODAY), 'Sat 17 Oct');
  assert.equal(datePlate('2027-01-09', 'day', TODAY), 'Sat 9 Jan 2027');
  assert.equal(datePlate('2026-11-01', 'month', TODAY), 'Nov 2026');
  assert.equal(datePlate('2027-01-01', 'year', TODAY), '2027');
  assert.equal(datePlate(null, 'day', TODAY), 'Date to come');
});

// ─── PEOPLE TO FOLLOW ───────────────────────────────────────────────────────

function person(over: Partial<PersonCandidate>): PersonCandidate {
  return {
    userId: 'u',
    slug: 's',
    displayName: 'Name',
    followersCount: 0,
    publicId: 'S89U-X',
    publicProfileEnabled: true,
    deletedAt: null,
    ...over,
  };
}

test('people to follow: public only, never you, never someone you follow, most followed first', () => {
  const picked = selectPeopleToFollow(
    [
      person({ userId: 'me', slug: 'me', followersCount: 999 }),
      person({ userId: 'followed', slug: 'f', followersCount: 500 }),
      person({ userId: 'private', slug: 'p', followersCount: 400, publicProfileEnabled: false }),
      person({ userId: 'gone', slug: 'g', followersCount: 300, deletedAt: '2026-01-01' }),
      person({ userId: 'noslug', slug: null, followersCount: 200 }),
      person({ userId: 'small', slug: 'small', followersCount: 3 }),
      person({ userId: 'big', slug: 'big', followersCount: 120 }),
    ],
    { viewerId: 'me', exclude: new Set(['followed']) },
  );
  assert.deepEqual(picked.map((p) => p.userId), ['big', 'small']);
});

test('people to follow is capped', () => {
  const many = Array.from({ length: 30 }, (_, i) =>
    person({ userId: `u${i}`, slug: `s${i}`, followersCount: i }),
  );
  assert.equal(
    selectPeopleToFollow(many, { viewerId: null, exclude: new Set() }).length,
    DISCOVER_CAPS.peopleToFollow,
  );
});

// ─── 3 · THE LAYER SPLIT AND THE HONEST READ (source) ───────────────────────

const HERE = __dirname;
const strip = stripComments;
const CORE = strip(readFileSync(join(HERE, 'discover-events-core.ts'), 'utf8'));
const LOADER = strip(readFileSync(join(HERE, 'discover-events.ts'), 'utf8'));
const RENDER = strip(
  readFileSync(join(HERE, '..', 'app', '_components', 'frontdoor', 'front-door-discover.tsx'), 'utf8'),
);
const FEED = strip(
  readFileSync(join(HERE, '..', 'app', '_components', 'frontdoor', 'front-door-feed.tsx'), 'utf8'),
);
const DOOR = strip(
  readFileSync(join(HERE, '..', 'app', '_components', 'frontdoor', 'front-door.tsx'), 'utf8'),
);

test('the decision module is pure — no server-only, no Supabase, no I/O', () => {
  assert.ok(CORE.length > 2000, 'the core was not read');
  assert.doesNotMatch(CORE, /server-only/);
  assert.doesNotMatch(CORE, /supabase/i);
  assert.doesNotMatch(CORE, /\bfetch\(|next\/headers/);
});

test('the loader is server-only and delegates every decision to the core', () => {
  assert.match(LOADER, /^import 'server-only';/m);
  assert.match(LOADER, /selectDiscoverShelves\(/);
  assert.match(LOADER, /selectPeopleToFollow\(/);
  assert.match(LOADER, /pickViewerRegion\(/);
  assert.match(LOADER, /filterPubliclyVisibleEvents\(/, 'the shared public gate must run');
  assert.doesNotMatch(LOADER, /\.sort\(/, 'ordering belongs to the core, where a test executes it');
});

test("the viewer's own rows are scoped to the viewer — RLS is never the fence", () => {
  assert.match(LOADER, /from\('user_follows'\)[\s\S]{0,120}\.eq\('follower_user_id', me\)/);
  assert.match(LOADER, /from\('user_unfollows'\)[\s\S]{0,120}\.eq\('follower_user_id', me\)/);
  assert.match(LOADER, /from\('event_members'\)[\s\S]{0,80}\.eq\('user_id', me\)/);
  assert.doesNotMatch(
    LOADER,
    /\.eq\('followed_user_id'/,
    'Discover must never read who follows anybody — only the viewer\'s own list',
  );
});

test('every read checks its error, and a failure becomes "unavailable", never an empty shelf', () => {
  const reads = (LOADER.match(/await (?:admin|supabase|candidateEvents)\b/g) ?? []).length;
  const destructured = (LOADER.match(/\{ data(?:: \w+)?, error(?:: \w+)? \}/g) ?? []).length;
  assert.ok(destructured >= 4, `expected the loader to bind { data, error } on its reads (found ${destructured}, reads ${reads})`);
  for (const site of ['follows', 'memberships', 'hosts', 'hostNames', 'world', 'peopleToFollow']) {
    assert.match(LOADER, new RegExp(`logQueryError\\('discover-events\\.${site}'`), `${site} read is not error-checked`);
  }
  assert.match(LOADER, /status: 'unavailable'/);
  assert.match(RENDER, /status === 'unavailable'/);
  assert.match(RENDER, /couldn&rsquo;t load/);
  assert.match(RENDER, /couldn’t (check|load)/);
});

test('the shelves render in the ruled order: your people → the world → shops → people to follow → stories', () => {
  const before = FEED.indexOf('{beforeShops}');
  const shops = FEED.indexOf('Open your shop');
  const after = FEED.indexOf('{afterShops}');
  const uploads = FEED.indexOf('New uploads');
  assert.ok(before > -1 && shops > -1 && after > -1 && uploads > -1, 'a slot or section is missing');
  assert.ok(before < shops && shops < after && after < uploads, 'the Discover layers are out of order');

  const people = RENDER.indexOf('data-discover-shelf="people"');
  const world = RENDER.indexOf('data-discover-shelf="world"');
  assert.ok(people > -1 && world > people, 'your people must come before the world');

  assert.match(DOOR, /beforeShops=\{discover \? <DiscoverEventShelves/);
  assert.match(DOOR, /afterShops=\{discover \? <PeopleToFollowShelf/);
  assert.match(DOOR, /<MiniTour tourKey="discover_upcoming_v1" \/>/);
});

test('the people shelf never mounts for a stranger', () => {
  assert.match(LOADER, /people: null/);
  assert.match(RENDER, /\{people \? \(/);
});

test('UI copy never says "website" or "site"', () => {
  const copy = readFileSync(
    join(HERE, '..', 'app', '_components', 'frontdoor', 'front-door-discover.tsx'),
    'utf8',
  )
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
    .join('\n');
  assert.doesNotMatch(copy, /\bweb ?site\b|\bsite\b/i);
});
