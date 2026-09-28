/**
 * people-redesign-holds.test.ts — the People redesign's promises, held
 * (owner 2026-09-28, people-redesign.html; "build it").
 *
 * Source-read, not rendered: every component here imports `../actions`, which
 * reaches `server-only` code, and `server-only` does not resolve under the unit
 * runner. So each assertion reads the CODE (comments stripped by the repo's one
 * stripper — a rule stated in prose is not a rule the page renders), and every
 * anchor is a string, never a line number.
 *
 * ⚠ RUN IT BY GLOB. This path contains `(account)`, which node's test runner
 * reads as a pattern: `tsx --test "app/**\/people/*.test.ts"` and check that
 * "# tests" is not 0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { TOURS, TOUR_KEYS } from '@/lib/tours';

const WEB = join(__dirname, '..', '..', '..', '..');
const read = (rel: string) => {
  const src = readFileSync(join(WEB, rel), 'utf8');
  assert.ok(src.length > 400, `${rel} is missing or a stub`);
  return { src, code: stripComments(src) };
};

const PAGE = read('app/dashboard/(account)/people/page.tsx');
const ROSTER_LIB = read('lib/people-roster.ts');
const ROSTER_VIEW = read('app/dashboard/(account)/people/_components/people-roster-view.tsx');
const FOLLOW_LIB = read('lib/people-follows.ts');
const FOLLOW_VIEW = read('app/dashboard/(account)/people/_components/follow-list-view.tsx');
const FIND = read('app/dashboard/(account)/people/_components/find-or-invite.tsx');
const RAIL = read('app/dashboard/(account)/_components/account-rail-context.tsx');
const ACTIONS = read('app/dashboard/(account)/people/actions.ts');
const FOLLOW_BUTTON = read('app/u/_components/follow-button.tsx');
const SAMAHAN = read('app/dashboard/(account)/people/_components/samahan-people-section.tsx');
const PICKER = read('app/dashboard/(account)/people/_components/people-view-picker.tsx');
const CELEBRANTS = read('lib/event-celebrants.server.ts');

const count = (hay: string, needle: string | RegExp) =>
  typeof needle === 'string' ? hay.split(needle).length - 1 : (hay.match(needle) ?? []).length;

// ── 1 · a refused read reaches the render ──────────────────────────────────

test('🔴 a refused People read is flagged by every read that can refuse it', () => {
  const c = ROSTER_LIB.code;
  for (const read of ['getPeopleRoster.me', 'getPeopleRoster.connections', 'getPeopleRoster.names']) {
    const at = c.indexOf(`'${read}'`);
    assert.ok(at > 0, `${read} is no longer logged — re-anchor`);
    const before = c.slice(Math.max(0, at - 160), at);
    assert.match(before, /connectionsUnavailable = true;/, `${read} fails without flagging connectionsUnavailable`);
  }
  assert.match(c, /return \{ people, mySamahan, samahanUnavailable, connectionsUnavailable, counts \}/);
});

test('🔴 …and the flag decides the sentence — "Nobody here yet" is never said about a refusal', () => {
  const c = ROSTER_VIEW.code;
  assert.match(c, /const emptyLine = roster\.connectionsUnavailable \? REFUSED_LINE : EMPTY_LINE;/);
  // EMPTY_LINE is defined once and used once — through `emptyLine` and nowhere else.
  assert.equal(count(c, /\bEMPTY_LINE\b/g), 2, 'the new-account sentence is reachable without the flag');
  assert.equal(count(c, 'Nobody here yet'), 1, 'the empty sentence is spelled a second time, bypassing the flag');
  assert.match(c, /const EMPTY_LINE = 'Nobody here yet/);
  assert.ok(c.includes('{emptyLine}'), 'the chosen sentence is not rendered');
  // The Following / Followers views the same way.
  const f = FOLLOW_VIEW.code;
  const refused = f.indexOf('list.unavailable ?');
  const empty = f.indexOf('list.rows.length === 0 ?');
  assert.ok(refused > 0 && empty > refused, 'a refused follow read can fall through to the empty line');
});

// ── 2 · the roster, redesigned ─────────────────────────────────────────────

test('the facet pill row is gone, "Confirm" became Accept, and alaga are not drawn here', () => {
  const c = ROSTER_VIEW.code;
  assert.ok(!c.includes('FACETS'), 'the facet pill row came back — one dropdown, never pills');
  assert.ok(!c.includes('aria-pressed'), 'a pressed-chip row came back');
  assert.ok(!/>\s*Confirm\s*</.test(c), '"Confirm" is back — the owner’s word is Accept');
  assert.match(c, />\s*Accept\s*</);
  assert.match(c, /roster\.people\.filter\(\(p\) => p\.kind === 'connection'\)/, 'alaga rows are drawn again');
  // "Waiting for them" is its own section, LAST.
  const sections = c.slice(c.indexOf('const SECTIONS'), c.indexOf('const EMPTY_LINE'));
  assert.ok(sections.lastIndexOf("key: 'waiting_them'") > sections.lastIndexOf("key: 'unlabelled'"));
});

test('🔴 a request says where it came from — through the narrow recipient door, never events', () => {
  const c = ROSTER_LIB.code;
  assert.match(c, /created_by_event_id/, 'the roster no longer reads where a request came from');
  // Owner 2026-09-28: ANY celebrant recipient sees the event name — events_host
  // answers hosts only, so it cannot be the door.
  assert.match(c, /rpc\('connection_request_events'\)/);
  assert.equal(/\.from\('events_host'\)/.test(c), false, 'the co-host-only read came back');
  assert.equal(/\.from\('events'\)/.test(c), false, 'a bare events read — authenticated is denied columns there');
  assert.match(ROSTER_VIEW.code, /connectionRequestSentence\(p\.name, p\.fromEvent\)/);
});

test('🔴 an incoming request never shows MY name as theirs', () => {
  // declared_name on a row somebody else made is the name THEY typed for ME.
  assert.match(ROSTER_LIB.code, /\(iDeclared \? r\.declared_name\?\.trim\(\) : null\)/);
});

// ── 3 · Following / Followers ──────────────────────────────────────────────

test('🔴 follow reads are scoped to ME explicitly — RLS also admits the admin', () => {
  const c = FOLLOW_LIB.code;
  assert.ok(count(c, ".eq('follower_user_id', userId)") >= 2, 'a following read is not scoped to me');
  assert.ok(count(c, ".eq('followed_user_id', userId)") >= 2, 'a followers read is not scoped to me');
  assert.match(c, /rpc\('follow_people_names'/, 'names bypass the edge-scoped door');
});

test('🔒 no user_id leaves the server — rows carry the public handle', () => {
  const type = FOLLOW_LIB.code.slice(
    FOLLOW_LIB.code.indexOf('export type FollowRow'),
    FOLLOW_LIB.code.indexOf('export type FollowList'),
  );
  assert.match(type, /publicId: string;/);
  assert.ok(!/user_?[iI]d/.test(type), 'a FollowRow carries an account id to the browser');
  // …and the action resolves the handle server-side.
  const act = ACTIONS.code.slice(ACTIONS.code.indexOf('export async function setFollowByPublicId'));
  assert.match(act, /\.eq\('public_id', publicId\)/);
  assert.match(act, /followUser\(theirId\)/);
  assert.match(act, /unfollowUser\(theirId\)/);
});

test('Follow is offered only toward a public profile, beside Add, in the name search', () => {
  const c = FIND.code;
  assert.match(c, /h\.followable \? \(/, 'Follow is drawn for a private profile — a door that will not open');
  assert.match(c, /setFollowByPublicId\(\{ publicId: hit\.publicId, follow: true \}\)/);
  assert.match(c, /addPersonByPublicId\(\{ publicId: hit\.publicId \}\)/);
  assert.match(c, /onClick=\{\(\) => followPicked\(h\)\}/);
  assert.match(c, /onClick=\{\(\) => addPicked\(h\)\}/);
});

test('🔴 the one-way sentence that stopped being true was retired in the SAME PR', () => {
  // follow-button.tsx's own docblock demanded it the day a follower list shipped.
  assert.ok(
    !FOLLOW_BUTTON.code.includes('Following a storyteller is one-way'),
    'the retired sentence is back — a follower list exists now',
  );
  assert.match(FOLLOW_BUTTON.code, /they’ll see you among their followers/);
});

// ── 4 · one picker, one rail ───────────────────────────────────────────────

test('the picker is the shared PickMenu, keyed by view — and the rail lights by the same resolver', () => {
  assert.match(PICKER.code, /<PickMenu[\s\S]*value=\{view\}/, 'the picker is handed something other than the view KEY');
  assert.match(PAGE.code, /resolvePeopleView\(sp\.view, gates\)/);
  const r = RAIL.code;
  assert.match(r, /resolvePeopleView\(searchParams\?\.get\('view'\), gates\)/);
  assert.match(r, /href: peopleViewHref\(v, gates\)/);
  assert.ok(!r.includes('#alaga'), 'the rail points at #alaga again — no element carries that id');
  assert.ok(!r.includes('#connection-tree'), 'a hash-anchor rail row came back; it never lit');
  assert.match(r, /v !== 'requests' \|\| requestsWaiting !== 0/, 'Requests shows with nobody waiting, or hides on a refusal');
});

test('the Samahan chip says Add — one word per concept', () => {
  const c = SAMAHAN.code;
  assert.ok(!/>\s*Connect\s*</.test(c), 'the second-degree chip says Connect again');
  assert.match(c, /pendingLabel="…"\s*>[\s{}]*Add\s*</);
});

test('a first-visit tour on the shipped MiniTour', () => {
  assert.ok(TOUR_KEYS.includes('customer_people_v1'));
  assert.equal(TOURS.customer_people_v1.slides.length, 3);
  assert.match(PAGE.code, /<MiniTour tourKey="customer_people_v1" \/>/);
});

// ── 5 · the event's Add ───────────────────────────────────────────────────

test('🔴 an Add from an event re-decides everything on the server', () => {
  const c = ACTIONS.code;
  const body = c.slice(c.indexOf('export async function addCelebrantFromEvent'), c.indexOf('export async function setFollowByPublicId'));
  assert.match(body, /\.from\('event_members'\)[\s\S]{0,120}\.eq\('user_id', user\.id\)/, 'the sender is not checked to be at the event');
  assert.match(body, /celebrantAccountsFor\(admin, eventId\)/, 'the target is not checked to be a celebrant');
  assert.match(body, /\.eq\('public_id', publicId\)/);
  assert.match(body, /fromEvent: \{\s*eventId,/);
  // The stamp reaches the insert.
  assert.match(c, /created_by_event_id: fromEvent\?\.eventId \?\? null,/);
});

test('🔴 a celebrant is the MAIN role only — an extra-role-only celebrant is not listed', () => {
  // Controller ruling 2026-09-28: the guest-side list uses the same rule as
  // public.is_event_celebrant (guests.role ∈ celebrant/bride/groom), so the list,
  // the celebrant lock and the request's event name agree on who a celebrant is.
  const c = CELEBRANTS.code;
  const body = c.slice(c.indexOf('export async function celebrantAccountsFor'), c.indexOf('export type CelebrantRow'));
  assert.match(body, /\.in\('role', \[\.\.\.HONOREE_ROLES\]\)/, 'the query no longer keys on the main role');
  assert.ok(!body.includes('extra_roles'), 'extra roles count as celebrant again — a listed person whose request arrives unnamed');
  assert.match(body, /\.filter\(\(g\) => g\.role !== null && isHonoreeRole\(g\.role\)\)/);
  assert.match(c, /const HONOREE_ROLES: readonly GuestRole\[\] = \['celebrant', 'bride', 'groom'\];/);
});
