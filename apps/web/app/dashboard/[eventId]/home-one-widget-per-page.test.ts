/**
 * home-one-widget-per-page.test.ts — ONE WIDGET → THE ONE PAGE IT OPENS, AND EACH FACE AT ITS EXACT ITEM (owner-approved
 * 2026-10-24, `home_control_center_2026-10-24_fable.html`). Owner: *"like now, we have guests, coming and no reply
 * opening the same thing"* → one widget per destination; *"it opens the exact payment and not just the budget page"*.
 *
 *   1 · RENDERED, both versions (the phone's tiles and the md+ cards): every door inside a widget — the tile, each
 *       face, each tiny action, each card button — lands on THAT widget's one page, and no page is the door of two
 *       widgets. Countdown → Event Settings · Guests → Guests · Event Hub → the Hub (Maker or public page) · Suppliers
 *       → Suppliers · Budget → Budget · To do → Planning Stage (its To do filter, since 2026-11-01).
 *   2 · THE TABLE ("A face opens the EXACT item"): each face's href, as the notes list it.
 *   3 · THE OTHER CALLERS STILL WORK: the params Home leans on are read by their pages as before (`?q=` by the
 *       Guests search, `?inspect=v:` and `?open=` by Suppliers, the Budget page's `?pay=`, `?tab=`, the Maker's `?stage=`).
 *
 * SABOTAGE (seen red): point the Guests "no reply" face at `/vendors` (1 red) · give Suppliers' tile door
 * `/budget` (1 red: two widgets on one page) · drop `?q=declined` from the can't-come face (2 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { fixtureControl } from '@/lib/home-control-fixture';
import { rosterSearchMatches, type RosterFacts } from '@/lib/guest-roster-view';
import type { GuestRow } from '@/lib/guests';
import { resolveHubStageSelection } from '@/lib/event-hub-control';
import { YOUR_TEAM_BUDGET_PART } from '@/lib/pillar-parts';
import { HOME_CONTROL_KEYS, HOME_CONTROL_PAGE, homeControlTiles, type HomeControlKey } from './_components/home-control-faces';
import { drawHome, loadHome, slice } from './home-render.harness';

test.before(loadHome);

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, ...rel.split('/')), 'utf8'));
const PUBLIC = 'https://setnayan.com/ana-and-miguel';

/** Which of the six pages a door opens. */
function pageOf(href: string): string {
  const h = href.replace(/&amp;/g, '&');
  if (h.startsWith(PUBLIC)) return 'Event Hub';
  const path = h.replace(/^\/dashboard\/e1/, '');
  // 📅 The Countdown's page is the Date Finder since 2026-10-30 (owner: *"date finder. because we want them to find the
  // date for their event"*), opened in place on Home (`?date=find`). `/details` itself would be a door to the page that
  // was combined into Event Settings: it is counted as elsewhere.
  if (/^\?date=find$/.test(path)) return 'Date Finder';
  if (/^\/guests\b/.test(path)) return 'Guests';
  if (/^\/launch\b/.test(path)) return 'Event Hub';
  // 💰 The Budget is its own page under Home since 2026-11-01 (owner: *"Okay place it in home"*).
  if (/^\/budget\b/.test(path)) return 'Budget';
  if (/^\/vendors\b/.test(path)) return 'Suppliers';
  // ✅ To do opens Planning Stage's To do filter since the Checklist merged into it (owner 2026-11-01).
  if (/^\/schedule\?view=preparation&filter=todo\b/.test(path)) return 'Planning Stage';
  return `elsewhere (${h})`;
}
/** 🎴 The grid's widgets — the Countdown is the event card's figure and the plan is the To do list under it (Home
 *  redraw 2026-11-02, round 3); both still open their one page, checked where they are drawn. */
const GRID_KEYS = HOME_CONTROL_KEYS.filter((k) => k !== 'count' && k !== 'plan');
const hrefs = (html: string) => [...html.matchAll(/(?:href|data-home-face-href)="([^"]*)"/g)].map((m) => m[1]!);

test('1 · every door inside a widget opens THAT widget’s one page — on the phone and from md up', () => {
  const html = drawHome();
  const compact = slice(html, 'data-home-control="compact"', ['data-home-control="detail"']);
  const detail = slice(html, 'data-home-control="detail"', ['data-home-services']);
  assert.ok(compact.length > 0 && detail.length > 0, 'premise: both versions are drawn');
  for (const [version, part, marker] of [
    ['compact', compact, 'data-home-tile="'],
    ['detail', detail, 'data-home-card-key="'],
  ] as const) {
    const owners = new Map<string, HomeControlKey>();
    for (const key of GRID_KEYS) {
      const one = slice(part, `${marker}${key}"`, HOME_CONTROL_KEYS.filter((k) => k !== key).map((k) => `${marker}${k}"`));
      assert.ok(one.length > 0, `${version}: the ${key} widget is not drawn`);
      const doors = hrefs(one);
      assert.ok(doors.length > 0, `${version}: the ${key} widget has no door`);
      for (const d of doors) {
        const page = pageOf(d);
        assert.equal(page, HOME_CONTROL_PAGE[key], `${version}: ${key} opens ${d} — that is ${page}, not ${HOME_CONTROL_PAGE[key]}`);
        const was = owners.get(page);
        assert.ok(!was || was === key, `${version}: ${page} is the door of two widgets (${was} and ${key})`);
        owners.set(page, key);
      }
    }
    assert.equal(owners.size, GRID_KEYS.length, `${version}: one page per widget`);
  }
  // The card's countdown opens the Date Finder; the To do list's rows and line open Planning Stage.
  const card = slice(html, 'data-home-card-countdown', ['data-home-today=']);
  assert.deepEqual(hrefs(card).map(pageOf), ['Date Finder'], 'the card’s countdown opens another page');
  const todo = slice(html, 'data-home-todo=""', ['data-home-your-event']);
  const todoDoors = hrefs(todo);
  assert.ok(todoDoors.length > 0, 'the To do list has no door');
  for (const d of todoDoors) assert.equal(pageOf(d), 'Planning Stage', `the To do list opens ${d}`);
});

test('2 · each face opens the exact item the notes name', () => {
  const { tiles } = homeControlTiles(fixtureControl('e1'));
  const face = (key: HomeControlKey, id: string) => tiles.find((t) => t.key === key)?.faces.find((f) => f.id === id);
  const table: Array<[HomeControlKey, string, string]> = [
    ['guests', 'guests-coming', '/dashboard/e1/guests?q=coming'],
    ['guests', 'guests-noreply', '/dashboard/e1/guests?q=no+reply'],
    ['guests', 'guests-toinvite', '/dashboard/e1/guests/send'],
    ['guests', 'guests-declined', '/dashboard/e1/guests?q=declined'],
    ['guests', 'guests-total', '/dashboard/e1/guests'],
    ['hub', 'hub-now', PUBLIC],
    // Owner 2026-10-24: a tap on the Event Hub tile opens the Event Hub — from EVERY face, the next page's too.
    ['hub', 'hub-next', PUBLIC],
    ['sup', 'sup-booked', '/dashboard/e1/vendors'],
    // PR-E: the exact quote — that supplier's workspace on its Quote tab.
    ['sup', 'sup-decide', '/dashboard/e1/vendors/v-lumiere/workspace?tab=quote'],
    ['sup', 'sup-replied', '/dashboard/e1/vendors?tab=shortlist'],
    ['budget', 'budget-summary', '/dashboard/e1/budget'],
    // PR-E: the exact payment (its Pay sheet opens) and the exact task.
    // (₱8,000 · li-1 is late, so it is Now's — the card's Pay opens it; the Budget card starts at the next one.)
    ['budget', 'pay-li-2', '/dashboard/e1/budget?pay=li-2'],
  ];
  for (const [key, id, href] of table) {
    const f = face(key, id);
    assert.ok(f, `${key}: the "${id}" face is missing`);
    assert.equal(f!.href, href, `${key}/${id} opens ${f!.href}, the notes say ${href}`);
  }
  // Each face's tiny action opens the same exact item as the face (Remind → the no-reply list, no reminder flow).
  for (const t of tiles) for (const f of t.faces) if (f.action?.href) assert.equal(pageOf(f.action.href), HOME_CONTROL_PAGE[t.key], `${t.key}/${f.id}: its action leaves the widget's page`);
  assert.equal(face('guests', 'guests-noreply')!.action!.href, '/dashboard/e1/guests?q=no+reply', '"Remind" lands on the no-reply list');
  // The Event Hub's two buttons (owner 2026-10-24): Pick what shows (a sheet in place, no page) · Maker (same tab).
  // The tile itself is the View — every face opens the public page.
  const hub = tiles.find((t) => t.key === 'hub')!;
  assert.deepEqual(hub.side?.map((a) => [a.label, a.href, Boolean(a.external), a.sheet ?? null]), [
    ['Pick what shows', null, false, 'hub-pick'],
    ['Maker', '/dashboard/e1/launch', false, null],
  ]);
  for (const f of hub.faces) assert.ok(f.href === PUBLIC && f.external, `hub/${f.id}: a tap does not open the Event Hub`);
});

test('3 · the params Home leans on still answer for every caller', () => {
  // ?q= — the Guests search reads the reply words, so the coming / no reply / can't come faces filter exactly.
  const facts = { roleNames: null, hasSides: false, groupsOf: () => [], tableOf: () => null, songsOf: () => [] } as unknown as RosterFacts;
  const row = (rsvp_status: string) => ({ guest_id: rsvp_status, first_name: 'A', last_name: 'B', role: 'guest', rsvp_status, invitation_sent_at: 'x', entry_source: null, passed_away: false }) as unknown as GuestRow;
  assert.ok(rosterSearchMatches('coming', row('attending'), facts) && !rosterSearchMatches('coming', row('declined'), facts), '?q=coming');
  assert.ok(rosterSearchMatches('no reply', row('pending'), facts) && !rosterSearchMatches('no reply', row('attending'), facts), '?q=no reply');
  assert.ok(rosterSearchMatches('declined', row('declined'), facts) && !rosterSearchMatches('declined', row('attending'), facts), '?q=declined');
  // ?inspect=v: and ?open= — Suppliers resolves both, as it always has.
  const vendors = src('vendors/page.tsx');
  assert.match(vendors, /sp\.inspect\.startsWith\('v:'\)/, 'Suppliers no longer reads ?inspect=v:');
  assert.match(vendors, /initialOpenTile=\{sp\.open \?\? null\}/, 'Suppliers no longer reads ?open=');
  // ?pay= — the Budget page opens that payment's sheet; an old `?part=budget` Suppliers link forwards there.
  assert.equal(YOUR_TEAM_BUDGET_PART, 'budget');
  assert.match(vendors, /if \(sp\.part === YOUR_TEAM_BUDGET_PART\) redirect\(budgetPageHref\(eventId, \{ pay: sp\.pay \}\)\);/, 'an old ?part=budget link no longer reaches the Budget page');
  // ?stage= — the Maker opens the named stage.
  assert.equal(resolveHubStageSelection({ param: 'event', live: 'rsvp' }), 'event');
});
