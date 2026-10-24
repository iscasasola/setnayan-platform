/**
 * home-one-widget-per-page.test.ts — ONE WIDGET → THE ONE PAGE IT OPENS, AND EACH FACE AT ITS EXACT ITEM (owner-approved
 * 2026-10-24, `home_control_center_2026-10-24_fable.html`). Owner: *"like now, we have guests, coming and no reply
 * opening the same thing"* → one widget per destination; *"it opens the exact payment and not just the budget page"*.
 *
 *   1 · RENDERED, both versions (the phone's tiles and the md+ cards): every door inside a widget — the tile, each
 *       face, each tiny action, each card button — lands on THAT widget's one page, and no page is the door of two
 *       widgets. Countdown → Event Settings · Guests → Guests · Event Hub → the Hub (Maker or public page) · Suppliers
 *       → Suppliers · Budget → Budget · Checklist → Checklist.
 *   2 · THE TABLE ("A face opens the EXACT item"): each face's href, as the notes list it.
 *   3 · THE OTHER CALLERS STILL WORK: the params Home leans on are read by their pages as before (`?q=` by the
 *       Guests search, `?inspect=v:` and `?open=` by Suppliers, `?part=budget`, `?tab=`, the Maker's `?stage=`).
 *
 * SABOTAGE (seen red): point the Guests "no reply" face at `/vendors` (1 red) · give Suppliers' tile door
 * `/vendors?part=budget` (1 red: two widgets on one page) · drop `?q=declined` from the can't-come face (2 red).
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
  if (/^\/(details|date-selection)\b/.test(path)) return 'Event Details';
  if (/^\/guests\b/.test(path)) return 'Guests';
  if (/^\/launch\b/.test(path)) return 'Event Hub';
  if (/^\/vendors\?part=budget\b/.test(path)) return 'Budget';
  if (/^\/vendors\b/.test(path)) return 'Suppliers';
  if (/^\/checklist\b/.test(path)) return 'Checklist';
  return `elsewhere (${h})`;
}
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
    for (const key of HOME_CONTROL_KEYS) {
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
    assert.equal(owners.size, HOME_CONTROL_KEYS.length, `${version}: six widgets, six pages`);
  }
});

test('2 · each face opens the exact item the notes name', () => {
  const { tiles } = homeControlTiles(fixtureControl('e1'));
  const face = (key: HomeControlKey, id: string) => tiles.find((t) => t.key === key)?.faces.find((f) => f.id === id);
  const table: Array<[HomeControlKey, string, string]> = [
    ['count', 'count', '/dashboard/e1/details'],
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
    ['budget', 'budget-summary', '/dashboard/e1/vendors?part=budget'],
    // PR-E: the exact payment (its Pay sheet opens) and the exact task.
    ['budget', 'pay-li-1', '/dashboard/e1/vendors?part=budget&pay=li-1'],
    ['plan', 'plan-open', '/dashboard/e1/checklist#task-t1'],
    ['plan', 'plan-pct', '/dashboard/e1/checklist'],
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
  // ?part=budget — the Budget part.
  assert.equal(YOUR_TEAM_BUDGET_PART, 'budget');
  assert.match(vendors, /if \(sp\.part === YOUR_TEAM_BUDGET_PART\)/, 'Suppliers no longer opens its Budget part from ?part=');
  // ?stage= — the Maker opens the named stage.
  assert.equal(resolveHubStageSelection({ param: 'event', live: 'rsvp' }), 'event');
});
